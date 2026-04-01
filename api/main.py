import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, text
import httpx
from jose import jwt, JWTError
from pydantic import BaseModel
from database import init_db, get_db, AsyncSessionLocal
from models import Observation, User
from schemas import ObservationCreate, ObservationOut
from pipeline import format_thesis, generate_steel_man, generate_stress_test, generate_metadata, call_bullshit, negate_thesis, ACTIVE_MODEL
from config import settings


# ─── Auth helpers ────────────────────────────────────────────────────────────

bearer = HTTPBearer(auto_error=False)


def _make_jwt(user: User) -> str:
    payload = {
        "sub": user.id,
        "name": user.name,
        "email": user.email,
        "avatar": user.avatar_url,
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
        user = await db.get(User, payload["sub"])
        return user
    except JWTError:
        return None


async def require_user(user: User | None = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


# ─── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with AsyncSessionLocal() as db:
        # Add new columns if they don't exist (SQLite migration)
        for col, definition in [
            ("user_id", "TEXT"),
            ("parent_id", "TEXT"),
            ("challenge_type", "TEXT"),
            ("bs_score", "REAL"),
            ("bs_verdict", "TEXT"),
        ]:
            try:
                await db.execute(text(f"ALTER TABLE observations ADD COLUMN {col} {definition}"))
                await db.commit()
            except Exception:
                await db.rollback()

        from sqlalchemy import update
        await db.execute(
            update(Observation)
            .where(Observation.status.in_(["formatting", "researching"]))
            .values(status="error", error_detail="Pipeline interrupted by server restart")
        )
        await db.commit()
    yield


app = FastAPI(title="Steel Man API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pipeline ────────────────────────────────────────────────────────────────

async def _run_pipeline(observation_id: str, raw_input: str, input_type: str, image_b64: str | None = None, image_media_type: str = "image/jpeg"):
    async with AsyncSessionLocal() as db:
        try:
            thesis = await format_thesis(raw_input, input_type, image_b64, image_media_type)
            obs = await db.get(Observation, observation_id)
            if not obs:
                return
            obs.thesis = thesis
            obs.status = "researching"
            await db.commit()

            steel_man, sources = await generate_steel_man(thesis)
            obs = await db.get(Observation, observation_id)
            if not obs:
                return
            obs.summary = steel_man
            if sources:
                obs.sources = sources

            try:
                meta = await generate_metadata(thesis, steel_man, image_b64, image_media_type)
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
                await db.delete(obs)
                await db.commit()
            print(f"Pipeline error for {observation_id} (auto-deleted): {e}")


# ─── Auth routes ─────────────────────────────────────────────────────────────

class GoogleAuthBody(BaseModel):
    id_token: str


@app.post("/auth/google")
async def auth_google(body: GoogleAuthBody, db: AsyncSession = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={body.id_token}")
    if resp.status_code != 200:
        raise HTTPException(401, f"Invalid Google token: {resp.text}")
    info = resp.json()
    if settings.google_client_id and info.get("aud") != settings.google_client_id:
        raise HTTPException(401, f"Token audience mismatch: {info.get('aud')}")

    google_id = info["sub"]
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            google_id=google_id,
            name=info.get("name", ""),
            email=info.get("email", ""),
            avatar_url=info.get("picture"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update name/avatar in case they changed
        user.name = info.get("name", user.name)
        user.avatar_url = info.get("picture", user.avatar_url)
        await db.commit()

    return {"token": _make_jwt(user), "user": {"id": user.id, "name": user.name, "avatar": user.avatar_url}}


@app.get("/auth/me")
async def auth_me(user: User = Depends(require_user)):
    return {"id": user.id, "name": user.name, "avatar": user.avatar_url, "email": user.email}


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


# ─── Observations ─────────────────────────────────────────────────────────────

@app.post("/observations", response_model=ObservationOut, status_code=201)
async def create_observation(
    body: ObservationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    image_b64 = body.image_data
    image_media_type = body.image_media_type or "image/jpeg"

    obs = Observation(
        raw_input=body.raw_input,
        input_type=body.input_type,
        thesis=body.raw_input[:120],
        status="formatting",
        image_data=image_b64,
        image_media_type=image_media_type,
        model_used=ACTIVE_MODEL,
        user_id=current_user.id if current_user else None,
        parent_id=body.parent_id,
        challenge_type=body.challenge_type,
    )
    db.add(obs)
    await db.commit()
    await db.refresh(obs)
    asyncio.create_task(_run_pipeline(obs.id, obs.raw_input, obs.input_type, image_b64, image_media_type))
    return obs


@app.get("/observations", response_model=list[ObservationOut])
async def list_observations(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    query = select(Observation).order_by(desc(Observation.created_at)).limit(100)
    result = await db.execute(query)
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
    if obs.stress_test and isinstance(obs.stress_test, dict) and "verdict" in obs.stress_test:
        return obs.stress_test
    try:
        result, sources = await generate_stress_test(obs.thesis or obs.raw_input, obs.summary or "")
    except Exception as e:
        raise HTTPException(500, f"Stress test generation failed: {str(e)}")
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


@app.post("/observations/{obs_id}/bullshit")
async def bullshit_check(obs_id: str, db: AsyncSession = Depends(get_db)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    if obs.status != "complete":
        raise HTTPException(400, "Research not complete")
    if obs.bs_score is not None:
        return {"bs_score": obs.bs_score, "bs_verdict": obs.bs_verdict}
    try:
        result = await call_bullshit(obs.thesis or obs.raw_input, obs.summary or "")
    except Exception as e:
        raise HTTPException(500, f"BS check failed: {str(e)}")
    obs.bs_score = result.get("bs_score")
    obs.bs_verdict = result.get("bs_verdict")
    await db.commit()
    return {"bs_score": obs.bs_score, "bs_verdict": obs.bs_verdict}


@app.get("/observations/{obs_id}/challenges", response_model=list[ObservationOut])
async def get_challenges(obs_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Observation)
        .where(Observation.parent_id == obs_id)
        .order_by(Observation.created_at)
    )
    return result.scalars().all()


@app.get("/observations/{obs_id}/counter-thesis")
async def get_counter_thesis(obs_id: str, db: AsyncSession = Depends(get_db)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    counter = await negate_thesis(obs.thesis or obs.raw_input)
    return {"counter_thesis": counter}


@app.delete("/observations/{obs_id}", status_code=204)
async def delete_observation(obs_id: str, db: AsyncSession = Depends(get_db)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    await db.delete(obs)
    await db.commit()
