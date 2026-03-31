import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from database import init_db, get_db, AsyncSessionLocal
from models import Observation
from schemas import ObservationCreate, ObservationOut
from pipeline import format_thesis, generate_steel_man, generate_stress_test, generate_metadata, ACTIVE_MODEL
from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Steel Man API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _run_pipeline(observation_id: str, raw_input: str, input_type: str, image_b64: str | None = None, image_media_type: str = "image/jpeg"):
    """Background task: format thesis → steel man."""
    async with AsyncSessionLocal() as db:
        try:
            # Step 1: format thesis
            thesis = await format_thesis(raw_input, input_type, image_b64, image_media_type)
            obs = await db.get(Observation, observation_id)
            if not obs:
                return
            obs.thesis = thesis
            obs.status = "researching"
            await db.commit()

            # Step 2: steel man (with search grounding for sources)
            steel_man, sources = await generate_steel_man(thesis)
            obs = await db.get(Observation, observation_id)
            if not obs:
                return
            obs.summary = steel_man
            if sources:
                obs.sources = sources

            # Step 3: metadata (score, tags, evidence type)
            try:
                meta = await generate_metadata(thesis, steel_man)
                obs.score = meta.get("score")
                obs.tags = meta.get("tags")
                obs.evidence_type = meta.get("evidence_type")
            except Exception as meta_err:
                print(f"Metadata generation failed (non-fatal): {meta_err}")

            obs.status = "complete"
            await db.commit()

        except Exception as e:
            obs = await db.get(Observation, observation_id)
            if obs:
                obs.status = "error"
                obs.error_detail = str(e)[:500]
                await db.commit()
            print(f"Pipeline error for {observation_id}: {e}")


@app.get("/health")
async def health():
    import os
    db_path = settings.database_url.split("///")[-1]
    return {
        "status": "ok",
        "database_url": settings.database_url,
        "db_exists": os.path.exists(db_path),
        "db_dir_exists": os.path.exists(os.path.dirname(db_path) or "."),
        "db_dir_contents": os.listdir(os.path.dirname(db_path) or ".") if os.path.exists(os.path.dirname(db_path) or ".") else [],
        "app_data_exists": os.path.exists("/app/data"),
        "app_data_contents": os.listdir("/app/data") if os.path.exists("/app/data") else [],
    }


@app.post("/observations", response_model=ObservationOut, status_code=201)
async def create_observation(body: ObservationCreate, db: AsyncSession = Depends(get_db)):
    image_b64 = body.image_data
    image_media_type = body.image_media_type or "image/jpeg"

    if image_b64:
        print(f"[create_observation] image received, type={image_media_type}, b64_len={len(image_b64)}")
    else:
        print(f"[create_observation] text input, type={body.input_type}")

    obs = Observation(
        raw_input=body.raw_input,
        input_type=body.input_type,
        thesis=body.raw_input[:120],
        status="formatting",
        image_data=image_b64,
        image_media_type=image_media_type,
        model_used=ACTIVE_MODEL,
    )
    db.add(obs)
    await db.commit()
    await db.refresh(obs)
    asyncio.create_task(_run_pipeline(obs.id, obs.raw_input, obs.input_type, image_b64, image_media_type))
    return obs


@app.get("/observations", response_model=list[ObservationOut])
async def list_observations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Observation).order_by(desc(Observation.created_at)).limit(100))
    return result.scalars().all()


@app.get("/observations/{obs_id}", response_model=ObservationOut)
async def get_observation(obs_id: str, db: AsyncSession = Depends(get_db)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    return obs


@app.post("/observations/{obs_id}/stress-test")
async def create_stress_test(obs_id: str, db: AsyncSession = Depends(get_db)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    if obs.status != "complete":
        raise HTTPException(400, "Research not complete")
    # Return cached result if already generated
    if obs.stress_test and isinstance(obs.stress_test, dict) and "verdict" in obs.stress_test:
        return obs.stress_test
    try:
        result, sources = await generate_stress_test(obs.thesis or obs.raw_input, obs.summary or "")
    except Exception as e:
        print(f"Stress test failed for {obs_id}: {e}")
        raise HTTPException(500, f"Stress test generation failed: {str(e)}")
    # Merge stress test sources with existing sources
    if sources:
        existing = obs.sources or []
        seen = {s["url"] for s in existing}
        for s in sources:
            if s["url"] not in seen:
                existing.append(s)
                seen.add(s["url"])
        obs.sources = existing
    obs.stress_test = result
    await db.commit()
    return result


@app.delete("/observations/{obs_id}", status_code=204)
async def delete_observation(obs_id: str, db: AsyncSession = Depends(get_db)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    await db.delete(obs)
    await db.commit()
