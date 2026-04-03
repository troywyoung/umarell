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
from pipeline import format_thesis, format_challenge_thesis, generate_steel_man, generate_stress_test, generate_counterpoint, generate_pva_take, generate_metadata, call_bullshit, negate_thesis, ACTIVE_MODEL
from config import settings


# ─── Auth helpers ────────────────────────────────────────────────────────────

bearer = HTTPBearer(auto_error=False)


def _is_admin(user: User) -> bool:
    return bool(settings.admin_email and user.email and user.email.lower() == settings.admin_email.lower())


def _make_jwt(user: User) -> str:
    payload = {
        "sub": user.id,
        "name": user.name,
        "email": user.email,
        "avatar": user.avatar_url,
        "is_admin": _is_admin(user),
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
            ("episode_tag", "TEXT"),
            ("episode_title", "TEXT"),
            ("category", "TEXT"),
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


app = FastAPI(title="Steelman API", lifespan=lifespan)

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
            # If this is a challenge, fetch parent context
            result = await db.execute(select(Observation).where(Observation.id == observation_id))
            obs = result.scalar_one_or_none()
            if not obs:
                return
            parent_context = None
            if obs.parent_id:
                p_result = await db.execute(select(Observation).where(Observation.id == obs.parent_id))
                parent = p_result.scalar_one_or_none()
                print(f"[pipeline] challenge {observation_id[:8]}, parent_id={obs.parent_id[:8]}, parent_found={parent is not None}, parent_thesis={(parent.thesis[:60] if parent and parent.thesis else 'NONE')}")
                if parent and parent.thesis:
                    parent_context = f"ORIGINAL CLAIM: {parent.thesis}"
                    if parent.summary:
                        parent_context += f"\n\nORIGINAL STEEL MAN:\n{parent.summary}"

            if parent_context:
                parent_thesis = parent_context.split("\n")[0].replace("ORIGINAL CLAIM: ", "")
                thesis = await format_challenge_thesis(raw_input, parent_thesis)
                print(f"[pipeline] challenge thesis: {thesis[:100]}")
            else:
                thesis = await format_thesis(raw_input, input_type, image_b64, image_media_type)

            obs = await db.get(Observation, observation_id)
            if not obs:
                return
            obs.thesis = thesis
            obs.status = "researching"
            await db.commit()

            if parent_context:
                steel_man_data, sources = await generate_steel_man(thesis, challenge_context=parent_context)
            else:
                steel_man_data, sources = await generate_steel_man(thesis)
            obs = await db.get(Observation, observation_id)
            if not obs:
                return
            # Store as JSON string for backward compat (summary is Text column)
            import json as _json
            obs.summary = _json.dumps(steel_man_data)
            if sources:
                obs.sources = sources

            # Build plain text version for metadata scoring
            sm_text = steel_man_data.get("bottom_line", "")
            if steel_man_data.get("bullets"):
                sm_text += "\n" + "\n".join(steel_man_data["bullets"])

            try:
                meta = await generate_metadata(thesis, sm_text, image_b64, image_media_type)
                obs.score = meta.get("score")
                obs.tags = meta.get("tags")
                obs.evidence_type = meta.get("evidence_type")
                obs.category = meta.get("category")
            except Exception as meta_err:
                print(f"Metadata generation failed (non-fatal): {meta_err}")

            obs.status = "complete"
            await db.commit()

        except Exception as e:
            err_msg = str(e)
            obs = await db.get(Observation, observation_id)
            if obs:
                obs.status = "error"
                if "[PAYWALL]" in err_msg:
                    obs.error_detail = "This article is behind a paywall. Paste the text directly instead."
                elif "[COOKIE_WALL]" in err_msg:
                    obs.error_detail = "This site requires cookie consent from our servers. Paste the article text directly instead."
                elif "[Could not fetch URL" in err_msg or "[Could not fetch Reddit" in err_msg:
                    obs.error_detail = "Couldn't read this URL. Try pasting the text directly."
                else:
                    obs.error_detail = err_msg[:500]
                await db.commit()
                print(f"Pipeline error for {observation_id}: {err_msg[:200]}")


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

    return {"token": _make_jwt(user), "user": {"id": user.id, "name": user.name, "avatar": user.avatar_url, "is_admin": _is_admin(user)}}


class AnonAuthBody(BaseModel):
    anon_id: str


@app.post("/auth/anon")
async def auth_anon(body: AnonAuthBody, db: AsyncSession = Depends(get_db)):
    import re
    if not re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', body.anon_id):
        raise HTTPException(400, "Invalid anon_id")
    google_id = f"anon_{body.anon_id}"
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            google_id=google_id,
            name="Anon",
            email=f"anon_{body.anon_id}@anon.local",
            avatar_url=None,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return {"token": _make_jwt(user), "user": {"id": user.id, "name": user.name, "avatar": user.avatar_url, "is_admin": False}}


@app.get("/auth/me")
async def auth_me(user: User = Depends(require_user)):
    return {"id": user.id, "name": user.name, "avatar": user.avatar_url, "email": user.email, "is_admin": _is_admin(user)}


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


async def _attach_user_names(db: AsyncSession, observations: list[Observation]) -> list[dict]:
    import json as _json
    user_ids = {o.user_id for o in observations if o.user_id}
    user_map: dict[str, str] = {}
    if user_ids:
        result = await db.execute(select(User).where(User.id.in_(user_ids)))
        for u in result.scalars():
            user_map[u.id] = u.name
    out = []
    for o in observations:
        d = ObservationOut.model_validate(o).model_dump()
        # Episode posts show "PvA", regular posts show the user's name
        d["user_name"] = "PvA" if o.episode_tag else (user_map.get(o.user_id) if o.user_id else None)
        # Parse pva_take from briefing field
        if o.briefing:
            try:
                d["pva_take"] = _json.loads(o.briefing)
            except (ValueError, TypeError):
                pass
        out.append(d)
    return out


@app.get("/observations")
async def list_observations(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    query = select(Observation).order_by(desc(Observation.created_at)).limit(100)
    result = await db.execute(query)
    return await _attach_user_names(db, list(result.scalars().all()))


@app.get("/observations/{obs_id}")
async def get_observation(obs_id: str, db: AsyncSession = Depends(get_db)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    rows = await _attach_user_names(db, [obs])
    return rows[0]


class ObservationEdit(BaseModel):
    raw_input: str
    input_type: str = "text"
    image_data: str | None = None
    image_media_type: str | None = None


@app.put("/observations/{obs_id}")
async def edit_observation(
    obs_id: str,
    body: ObservationEdit,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    if obs.user_id and current_user and obs.user_id != current_user.id and not _is_admin(current_user):
        raise HTTPException(403, "You can only edit your own observations")
    obs.raw_input = body.raw_input
    obs.input_type = body.input_type
    obs.thesis = None
    obs.summary = None
    obs.score = None
    obs.tags = None
    obs.evidence_type = None
    obs.stress_test = None
    obs.sources = None
    obs.status = "formatting"
    obs.error_detail = None
    await db.commit()
    await db.refresh(obs)
    image_b64 = body.image_data
    image_media_type = body.image_media_type or "image/jpeg"
    asyncio.create_task(_run_pipeline(obs.id, obs.raw_input, obs.input_type, image_b64, image_media_type))
    rows = await _attach_user_names(db, [obs])
    return rows[0]


def _parse_summary(obs) -> dict:
    """Parse summary field — handles both new JSON format and legacy plain text."""
    import json as _json
    if not obs.summary:
        return {"bottom_line": "", "bullets": []}
    try:
        return _json.loads(obs.summary)
    except (ValueError, TypeError):
        # Legacy format: plain bullet text
        bullets = [l.replace("•", "").replace("-", "").strip() for l in obs.summary.split("\n") if l.strip()]
        return {"bottom_line": bullets[0] if bullets else "", "bullets": bullets[1:] if len(bullets) > 1 else bullets}


@app.post("/observations/{obs_id}/stress-test")
async def create_stress_test(obs_id: str, db: AsyncSession = Depends(get_db)):
    """Legacy endpoint — redirects to counterpoint."""
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    if obs.status != "complete":
        raise HTTPException(400, "Research not complete")
    if obs.stress_test and isinstance(obs.stress_test, dict) and "verdict" in obs.stress_test:
        return obs.stress_test
    sm_json = _parse_summary(obs)
    try:
        result, sources = await generate_counterpoint(obs.thesis or obs.raw_input, sm_json)
    except Exception as e:
        raise HTTPException(500, f"Counterpoint generation failed: {str(e)}")
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


@app.post("/observations/{obs_id}/counterpoint")
async def create_counterpoint(obs_id: str, db: AsyncSession = Depends(get_db)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    if obs.status != "complete":
        raise HTTPException(400, "Research not complete")
    # Return cached if exists
    if obs.stress_test and isinstance(obs.stress_test, dict) and "strength" in obs.stress_test:
        return obs.stress_test
    sm_json = _parse_summary(obs)
    try:
        result, sources = await generate_counterpoint(obs.thesis or obs.raw_input, sm_json)
    except Exception as e:
        raise HTTPException(500, f"Counterpoint generation failed: {str(e)}")
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


class PvaTakeRequest(BaseModel):
    voice: str = "all"  # "troy", "brian", "alex", or "all"


@app.post("/observations/{obs_id}/pva-take")
async def create_pva_take(obs_id: str, body: PvaTakeRequest = PvaTakeRequest(), db: AsyncSession = Depends(get_db)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    if obs.status != "complete":
        raise HTTPException(400, "Research not complete")
    # Check cache — return if same voice already generated
    import json as _json
    existing_pva = None
    if obs.briefing:
        try:
            existing_pva = _json.loads(obs.briefing)
            if existing_pva.get("voice") == body.voice:
                return existing_pva
        except (ValueError, TypeError):
            pass
    sm_json = _parse_summary(obs)
    try:
        result = await generate_pva_take(obs.thesis or obs.raw_input, sm_json, voice=body.voice)
    except Exception as e:
        raise HTTPException(500, f"PvA take generation failed: {str(e)}")
    obs.briefing = _json.dumps(result)
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


@app.get("/observations/{obs_id}/challenges")
async def get_challenges(obs_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Observation)
        .where(Observation.parent_id == obs_id)
        .order_by(Observation.created_at)
    )
    return await _attach_user_names(db, list(result.scalars().all()))


@app.get("/observations/{obs_id}/counter-thesis")
async def get_counter_thesis(obs_id: str, db: AsyncSession = Depends(get_db)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    counter = await negate_thesis(obs.thesis or obs.raw_input)
    return {"counter_thesis": counter}


@app.delete("/observations/{obs_id}", status_code=204)
async def delete_observation(
    obs_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    if obs.user_id and current_user and obs.user_id != current_user.id and not _is_admin(current_user):
        raise HTTPException(403, "You can only delete your own observations")
    await db.delete(obs)
    await db.commit()


# ─── Episode seed ───────────────────────────────────────────────────────────

class EpisodeSeed(BaseModel):
    episode_title: str          # "The War on Slop"
    episode_tag: str            # "the-war-on-slop"
    claims: list[str]           # 5 raw claims to steelman
    author_name: str = "PvA"   # displayed as user_name
    admin_key: str | None = None  # fallback auth for seeding


@app.post("/episodes/seed")
async def seed_episode(
    body: EpisodeSeed,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    """Create multiple observations for an episode, each runs through the pipeline.
    Requires auth OR admin_key in body."""
    if not current_user and not body.admin_key:
        raise HTTPException(401, "Not authenticated")
    if body.admin_key and body.admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")
    user_id = current_user.id if current_user else None
    created = []
    for claim in body.claims:
        obs = Observation(
            raw_input=claim,
            input_type="text",
            thesis=claim[:200],
            status="formatting",
            model_used=ACTIVE_MODEL,
            user_id=user_id,
            episode_tag=body.episode_tag,
            episode_title=body.episode_title,
        )
        db.add(obs)
        await db.commit()
        await db.refresh(obs)
        asyncio.create_task(_run_pipeline(obs.id, obs.raw_input, obs.input_type))
        created.append(obs.id)
    return {"episode_tag": body.episode_tag, "observations": created, "count": len(created)}


# ─── Admin: retag episode ───────────────────────────────────────────────────

class RetagEpisodeBody(BaseModel):
    old_tag: str | None = None   # if None, retags ALL episode posts
    new_tag: str
    new_title: str
    admin_key: str

@app.post("/admin/retag-episode")
async def retag_episode(body: RetagEpisodeBody, db: AsyncSession = Depends(get_db)):
    if body.admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")
    query = select(Observation).where(Observation.episode_tag != None)
    if body.old_tag:
        query = query.where(Observation.episode_tag == body.old_tag)
    result = await db.execute(query)
    obs_list = list(result.scalars().all())
    for obs in obs_list:
        obs.episode_tag = body.new_tag
        obs.episode_title = body.new_title
    await db.commit()
    return {"retagged": len(obs_list), "new_tag": body.new_tag, "new_title": body.new_title}


# ─── Scoring benchmark ──────────────────────────────────────────────────────

SCORE_BENCHMARKS = [
    # (take, expected_min, expected_max, label)
    # Verifiable truths → should score near 100
    ("Apples are a type of fruit.",                                                90, 100, "pure verified fact"),
    ("Regular sleep of 7-9 hours improves cognitive performance.",                 85,  97, "scientifically established"),
    # Well-evidenced, widely supported
    ("Social media has increased political polarization.",                          68,  84, "strong academic consensus"),
    # Directionally supported, contestable
    ("The newsletter subscription boom peaked around 2022-2023.",                  57,  73, "observable trend, some debate"),
    ("Podcasting rewards authenticity over production quality.",                    42,  58, "conventional wisdom, weak evidence"),
    # Arguable but counterexamples exist
    ("No media operator has ever genuinely benefited from taking VC money.",       44,  62, "hyperbolic, counterexamples exist"),
    # Speculative / thin
    ("Every major ad holding company will be gone within 8 years.",                28,  46, "bold prediction, no evidence yet"),
    # Demonstrably false / unsupported
    ("Bari Weiss is single-handedly destroying CBS News.",                          8,  26, "hyperbolic, unsupported"),
    ("Canada will be a global superpower by 2030.",                                 3,  16, "contradicts all data"),
    # Vague non-take
    ("AI will change everything over the next decade.",                            55,  82, "broadly true but vague — conviction score rewards truth"),
]

@app.post("/admin/test-scoring")
async def test_scoring(admin_key: str):
    """Run benchmark takes through the scoring prompt and report pass/fail. Use this to validate prompt changes before rescoring production."""
    if admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")

    results = []
    for take, lo, hi, label in SCORE_BENCHMARKS:
        try:
            meta = await generate_metadata(take, "")
            score = meta.get("score")
            passed = lo <= score <= hi if score is not None else False
            results.append({
                "take": take,
                "label": label,
                "score": score,
                "expected": f"{lo}–{hi}",
                "pass": passed,
            })
        except Exception as e:
            results.append({"take": take, "label": label, "score": None, "expected": f"{lo}–{hi}", "pass": False, "error": str(e)})

    passes = sum(1 for r in results if r["pass"])
    return {
        "pass_rate": f"{passes}/{len(results)}",
        "results": results,
    }


# ─── Migration: rescore all observations ────────────────────────────────────

class RescoreBody(BaseModel):
    admin_key: str
    dry_run: bool = False

def _rank_normalize(raw_scores: list[float], lo: float = 22.0, hi: float = 91.0) -> list[float]:
    """Map raw scores to [lo, hi] via percentile rank, preserving relative ordering.
    Ties get the average rank of their group so identical raw scores get identical output scores."""
    n = len(raw_scores)
    if n == 0:
        return []
    if n == 1:
        return [(lo + hi) / 2]
    sorted_vals = sorted(set(raw_scores))
    # assign each unique value its mean percentile position
    rank_map: dict[float, float] = {}
    pos = 0
    for val in sorted_vals:
        group = [i for i, s in enumerate(raw_scores) if s == val]
        mean_rank = (pos + pos + len(group) - 1) / 2  # 0-indexed mean rank
        rank_map[val] = mean_rank
        pos += len(group)
    return [round(lo + (rank_map[s] / (n - 1)) * (hi - lo)) for s in raw_scores]


@app.post("/admin/rescore")
async def rescore_all(body: RescoreBody, db: AsyncSession = Depends(get_db)):
    """Re-run generate_metadata on every complete observation using the current scoring prompt."""
    if body.admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")

    result = await db.execute(
        select(Observation).where(Observation.status == "complete", Observation.thesis != None)
    )
    obs_list = list(result.scalars().all())

    updated, failed = 0, 0
    scores_out = []
    for obs in obs_list:
        try:
            sm_text = obs.summary or ""
            meta = await generate_metadata(obs.thesis or obs.raw_input, sm_text)
            if not body.dry_run:
                obs.score = meta.get("score")
                obs.tags = meta.get("tags")
                obs.evidence_type = meta.get("evidence_type")
                obs.category = meta.get("category")
            scores_out.append(meta.get("score"))
            updated += 1
        except Exception as e:
            print(f"[rescore] failed {obs.id}: {e}")
            failed += 1

    if not body.dry_run:
        await db.commit()

    valid = sorted(s for s in scores_out if s is not None)
    from collections import Counter
    top = Counter(valid).most_common(5)
    return {
        "total": len(obs_list), "updated": updated, "failed": failed,
        "dry_run": body.dry_run,
        "range": [min(valid), max(valid)] if valid else [],
        "mean": round(sum(valid) / len(valid), 1) if valid else None,
        "unique": len(set(valid)),
        "most_common": top,
    }


# ─── Migration: backfill hard_facts ─────────────────────────────────────────

@app.post("/admin/backfill-hard-facts")
async def backfill_hard_facts(
    admin_key: str,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Re-generate steelman for complete observations missing hard_facts (or all if force=true).
    Runs sequentially to avoid hammering the LLM API."""
    import json as _json
    if admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")

    result = await db.execute(
        select(Observation)
        .where(Observation.status == "complete")
        .where(Observation.summary.isnot(None))
    )
    observations = list(result.scalars().all())

    # Filter — force=True re-runs everything; otherwise only missing/empty hard_facts
    def _needs_backfill(obs) -> bool:
        if force:
            return True
        try:
            parsed = _json.loads(obs.summary)
            # Re-run if hard_facts missing, empty, or no fact has a parenthetical source
            facts = parsed.get("hard_facts", [])
            if not facts:
                return True
            import re
            return not any(re.search(r'\([^)]+\)', f) for f in facts)
        except (ValueError, TypeError):
            return True

    to_backfill = [obs for obs in observations if _needs_backfill(obs)]

    updated = 0
    errors = 0
    for obs in to_backfill:
        try:
            steel_man_data, sources = await generate_steel_man(obs.thesis or obs.raw_input)
            obs_fresh = await db.get(Observation, obs.id)
            if not obs_fresh:
                continue
            obs_fresh.summary = _json.dumps(steel_man_data)
            if sources:
                existing = obs_fresh.sources or []
                seen = {s["url"] for s in existing}
                for s in sources:
                    if s["url"] not in seen:
                        existing.append(s)
                        seen.add(s["url"])
                obs_fresh.sources = existing
            await db.commit()
            updated += 1
            print(f"[backfill] updated {obs.id[:8]} — {(obs.thesis or '')[:60]}")
        except Exception as e:
            errors += 1
            print(f"[backfill] failed {obs.id[:8]}: {e}")

    return {"total": len(to_backfill), "updated": updated, "errors": errors}


@app.post("/admin/backfill-categories")
async def backfill_categories(
    admin_key: str,
    db: AsyncSession = Depends(get_db),
):
    """Assign category to all complete observations missing one."""
    if admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")

    result = await db.execute(
        select(Observation)
        .where(Observation.status == "complete")
        .where(Observation.category.is_(None))
        .where(Observation.thesis.isnot(None))
    )
    observations = list(result.scalars().all())

    updated = 0
    errors = 0
    for obs in observations:
        try:
            sm_text = ""
            import json as _json
            try:
                parsed = _json.loads(obs.summary or "")
                sm_text = parsed.get("bottom_line", "") + " " + " ".join(parsed.get("bullets", []))
            except Exception:
                sm_text = obs.summary or ""
            meta = await generate_metadata(obs.thesis or obs.raw_input, sm_text)
            obs_fresh = await db.get(Observation, obs.id)
            if obs_fresh:
                obs_fresh.category = meta.get("category")
                await db.commit()
                updated += 1
                print(f"[cat-backfill] {obs.id[:8]} → {meta.get('category')} — {(obs.thesis or '')[:50]}")
        except Exception as e:
            errors += 1
            print(f"[cat-backfill] failed {obs.id[:8]}: {e}")

    return {"total": len(observations), "updated": updated, "errors": errors}


@app.post("/admin/unpin-episodes")
async def unpin_episodes(admin_key: str, db: AsyncSession = Depends(get_db)):
    """Clear episode_tag and episode_title from all observations so they flow into the regular feed."""
    if admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")

    result = await db.execute(
        select(Observation).where(Observation.episode_tag.isnot(None))
    )
    observations = list(result.scalars().all())

    for obs in observations:
        obs.episode_tag = None
        obs.episode_title = None

    await db.commit()
    return {"unpinned": len(observations)}


@app.post("/admin/restore-episodes")
async def restore_episodes(admin_key: str, db: AsyncSession = Depends(get_db)):
    """Restore episode_tag/episode_title on the two known episode batches identified by creation timestamp."""
    if admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")

    from datetime import datetime, timezone

    # April 1 batch — 7 posts at 15:21 UTC
    result1 = await db.execute(
        select(Observation).where(
            Observation.user_id.is_(None),
            Observation.created_at >= datetime(2026, 4, 1, 15, 21, 0, tzinfo=timezone.utc),
            Observation.created_at < datetime(2026, 4, 1, 15, 22, 0, tzinfo=timezone.utc),
        )
    )
    batch1 = list(result1.scalars().all())
    for obs in batch1:
        obs.episode_tag = "pva-2026-04-01"
        obs.episode_title = "PvA April 1"

    # April 2 batch — 10 posts at 17:30 UTC
    result2 = await db.execute(
        select(Observation).where(
            Observation.user_id.is_(None),
            Observation.created_at >= datetime(2026, 4, 2, 17, 30, 0, tzinfo=timezone.utc),
            Observation.created_at < datetime(2026, 4, 2, 17, 31, 0, tzinfo=timezone.utc),
        )
    )
    batch2 = list(result2.scalars().all())
    for obs in batch2:
        obs.episode_tag = "pva-2026-04-02"
        obs.episode_title = "PvA April 3"

    await db.commit()
    return {"restored_apr1": len(batch1), "restored_apr3": len(batch2)}
