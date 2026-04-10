import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, text
import httpx
from jose import jwt, JWTError
from pydantic import BaseModel
import re
from database import init_db, get_db, get_instance_db, get_instance_engine, AsyncSessionLocal, Base
from models import Observation, User, Take, Instance, InstanceConfig, InstancePrompt, PodcastFeed, PromptTestSuite, PromptTestQuery
from schemas import ObservationCreate, ObservationOut, TakeCreate, TakeOut
from pipeline import format_thesis, format_challenge_thesis, generate_steel_man, generate_stress_test, generate_counterpoint, generate_pva_take, generate_metadata, call_bullshit, negate_thesis, generate_joke, evaluate_take, ACTIVE_MODEL
from config import settings
from whatsapp import router as whatsapp_router
from sms import router as sms_router
from prompts import get_all_prompts, get_prompt, update_prompt
from design_tokens import get_design_tokens, update_design_token
from ui_copy import get_ui_copy, update_ui_copy
from simplified_tokens import (
    get_simplified_tokens_from_full,
    apply_simplified_tokens_to_full,
    SIMPLIFIED_TOKENS,
    TOKEN_LABELS,
    TOKEN_DESCRIPTIONS
)


# ─── Auth helpers ────────────────────────────────────────────────────────────

bearer = HTTPBearer(auto_error=False)


def _is_admin(user: User) -> bool:
    if not settings.admin_email or not user.email:
        return False
    admin_emails = {e.strip().lower() for e in settings.admin_email.split(",") if e.strip()}
    return user.email.lower() in admin_emails


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
    # Initialize main meta database
    await init_db()

    # Initialize instance databases
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Instance).where(Instance.is_active == True))
        instances = result.scalars().all()
        for instance in instances:
            engine, _ = get_instance_engine(instance.key)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

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
            # Added later — must be here or Railway PostgreSQL won't have them
            ("pinned", "BOOLEAN DEFAULT false"),
            ("brazen_score", "REAL"),
            ("specificity", "REAL"),
            ("arguability", "REAL"),
            ("originality", "REAL"),
            ("is_hot_take", "BOOLEAN DEFAULT false"),
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
        # Fix any NULL pinned/is_hot_take values so model_validate doesn't fail
        await db.execute(
            update(Observation)
            .where(Observation.pinned.is_(None))
            .values(pinned=False)
        )
        await db.execute(
            update(Observation)
            .where(Observation.is_hot_take.is_(None))
            .values(is_hot_take=False)
        )
        await db.commit()

        # One-time fix: restore null summaries from backup data file
        import json as _json_restore
        import os as _os_restore
        _restore_path = _os_restore.path.join(_os_restore.path.dirname(__file__), "summary_restore_data.json")
        if _os_restore.path.exists(_restore_path):
            with open(_restore_path) as _f:
                _restore_items = _json_restore.load(_f)
            _restored = 0
            for _item in _restore_items:
                _obs = await db.get(Observation, _item["id"])
                if _obs and not _obs.summary:
                    _obs.summary = _item["summary"]
                    _restored += 1
            if _restored:
                await db.commit()
                print(f"[startup] restored {_restored} null summaries from backup data")

        # One-time fix: restore YouTube URL as episode source for existing episode posts
        # that had their sources overwritten by Gemini grounding URLs
        import json as _startup_json
        ep_result = await db.execute(
            select(Observation).where(Observation.episode_tag.isnot(None))
        )
        ep_obs = ep_result.scalars().all()
        import re as _re_startup
        for ep_ob in ep_obs:
            # Fix missing episode_title: derive from episode_tag slug
            if not ep_ob.episode_title and ep_ob.episode_tag:
                ep_ob.episode_title = _re_startup.sub(r"-+", " ", ep_ob.episode_tag).strip().title()
            # Fix missing episode source URL
            sources = ep_ob.sources or []
            has_episode_source = any(s.get("title") == "episode" for s in sources if isinstance(s, dict))
            if not has_episode_source and ep_ob.raw_input and (
                "youtube.com" in ep_ob.raw_input or "youtu.be" in ep_ob.raw_input
            ):
                ep_ob.sources = [{"url": ep_ob.raw_input, "title": "episode"}] + sources
        await db.commit()

        # Seed default "hot-takes" instance if it doesn't exist
        result = await db.execute(select(Instance).where(Instance.key == "hot-takes"))
        hot_takes = result.scalar_one_or_none()

        if not hot_takes:
            from prompts import PROMPTS
            from design_tokens import DESIGN_TOKENS

            # Create instance
            hot_takes = Instance(
                key="hot-takes",
                display_name="Hot Takes",
                subdirectory=None,
                database_name=None,
                is_active=True
            )
            db.add(hot_takes)
            await db.flush()

            # Seed prompts
            for prompt_key, prompt_config in PROMPTS.items():
                prompt = InstancePrompt(
                    instance_id=hot_takes.id,
                    prompt_key=prompt_key,
                    name=prompt_config["name"],
                    description=prompt_config["description"],
                    system=prompt_config["system"],
                    max_tokens=prompt_config["max_tokens"],
                    is_default=True
                )
                db.add(prompt)

            # Seed design tokens
            design_config = InstanceConfig(
                instance_id=hot_takes.id,
                config_type="design_tokens",
                config_data=DESIGN_TOKENS
            )
            db.add(design_config)

            await db.commit()

            # Initialize the instance's own database tables
            engine, _ = get_instance_engine("hot-takes")
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        else:
            # Instance already exists — refresh any default (non-user-modified) prompts
            # so code changes to PROMPTS take effect on redeploy
            from prompts import PROMPTS as _PROMPTS
            result2 = await db.execute(
                select(InstancePrompt).where(
                    InstancePrompt.instance_id == hot_takes.id,
                    InstancePrompt.is_default == True,  # noqa: E712
                )
            )
            existing_defaults = {p.prompt_key: p for p in result2.scalars().all()}
            for prompt_key, prompt_config in _PROMPTS.items():
                if prompt_key in existing_defaults:
                    p = existing_defaults[prompt_key]
                    p.system = prompt_config["system"]
                    p.max_tokens = prompt_config["max_tokens"]
                    p.name = prompt_config["name"]
                    p.description = prompt_config["description"]
                else:
                    db.add(InstancePrompt(
                        instance_id=hot_takes.id,
                        prompt_key=prompt_key,
                        name=prompt_config["name"],
                        description=prompt_config["description"],
                        system=prompt_config["system"],
                        max_tokens=prompt_config["max_tokens"],
                        is_default=True,
                    ))
            await db.commit()
    yield


app = FastAPI(title="Steelman API", lifespan=lifespan)
app.include_router(whatsapp_router)
app.include_router(sms_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Instance routing middleware ─────────────────────────────────────────────

@app.middleware("http")
async def instance_routing_middleware(request: Request, call_next):
    """Extract instance key from path, strip prefix, and store in request state."""
    path = request.url.path

    # Pattern: /{instance_key}/... where instance_key doesn't start with known meta routes
    match = re.match(r'^/([a-z0-9-]+)(/.*)?$', path)
    if match:
        potential_instance = match.group(1)
        # Exclude meta routes that aren't instance-specific
        if potential_instance not in ["admin", "auth", "health", "instance", "observations", "takes", "episodes", "webhook", "podcasts", "news-bundles", "cards", "legal", "evaluate"]:
            request.state.instance_key = potential_instance
            # Rewrite the path to strip the instance prefix so routes match normally
            new_path = match.group(2) or "/"
            request.scope["path"] = new_path
            request.scope["raw_path"] = new_path.encode("utf-8")
        else:
            request.state.instance_key = None
    else:
        request.state.instance_key = None

    response = await call_next(request)
    return response


async def get_instance_key(request: Request) -> str:
    """Get instance key from request state, defaulting to 'hot-takes'."""
    return getattr(request.state, "instance_key", None) or "hot-takes"


async def get_instance_db_session(request: Request) -> AsyncSession:
    """Get database session for the current instance."""
    instance_key = await get_instance_key(request)
    async for session in get_instance_db(instance_key):
        yield session


# ─── Pipeline ────────────────────────────────────────────────────────────────

async def _run_pipeline(observation_id: str, raw_input: str, input_type: str, image_b64: str | None = None, image_media_type: str = "image/jpeg", instance_key: str = "hot-takes"):
    _, session_maker = get_instance_engine(instance_key)
    async with session_maker() as db:
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
                # Preserve original episode/article sources before overwriting with search results
                episode_source = next((s for s in (obs.sources or []) if s.get("title") == "episode"), None)
                article_source = next((s for s in (obs.sources or []) if s.get("title") == "article"), None)
                pinned = [s for s in [article_source, episode_source] if s]
                obs.sources = pinned + sources

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
                obs.brazen_score = meta.get("brazen_score")
                obs.specificity = meta.get("specificity")
                obs.arguability = meta.get("arguability")
                obs.originality = meta.get("originality")
                dims = [obs.brazen_score or 0, obs.specificity or 0, obs.arguability or 0, obs.originality or 0]
                obs.is_hot_take = bool((obs.score or 0) >= 85 and sum(dims) / len(dims) >= 70)
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


# ─── Legal pages ─────────────────────────────────────────────────────────────

_LEGAL_STYLE = """
  body { font-family: -apple-system, sans-serif; max-width: 680px; margin: 60px auto; padding: 0 24px 80px; color: #1a1a1a; line-height: 1.7; }
  h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px; }
  h2 { font-size: 16px; font-weight: 700; margin: 32px 0 8px; }
  p, li { font-size: 15px; color: #444; }
  a { color: #FF00AE; }
  .meta { font-size: 13px; color: #999; margin-bottom: 40px; }
  nav { margin-bottom: 40px; font-size: 13px; }
"""

@app.get("/legal/privacy", include_in_schema=False)
async def privacy_policy():
    from fastapi.responses import HTMLResponse
    html = f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Privacy Policy — hottake</title><style>{_LEGAL_STYLE}</style></head><body>
<nav><a href="https://bighottake.com">← hottake</a></nav>
<h1>Privacy Policy</h1>
<p class="meta">Last updated: April 7, 2026</p>

<h2>What we collect</h2>
<p>When you use hottake, we collect your phone number if you opt in to SMS notifications, and any takes or ideas you submit. We also collect standard server logs (IP address, timestamp, browser type) for security and debugging.</p>

<h2>How we use it</h2>
<p>Your phone number is used only to send you take ratings and prompts you have opted into. We do not sell, share, or transfer your number to third parties for marketing. Takes you submit may be displayed anonymously within the app.</p>

<h2>SMS messaging</h2>
<p>By providing your phone number and opting in, you consent to receive SMS messages from hottake via Twilio. Message and data rates may apply. Message frequency varies. Reply STOP to unsubscribe at any time. Reply HELP for help.</p>

<h2>Data retention</h2>
<p>We retain your data for as long as your account is active. You may request deletion by contacting us at the email below.</p>

<h2>Third parties</h2>
<p>We use Twilio for SMS delivery and Railway for hosting. We use Anthropic's API for content processing. None of these parties receive your personal data beyond what is necessary to provide the service.</p>

<h2>Contact</h2>
<p>Questions? Email <a href="mailto:troyyoung@gmail.com">troyyoung@gmail.com</a>.</p>
</body></html>"""
    return HTMLResponse(content=html)


@app.get("/legal/terms", include_in_schema=False)
async def terms_of_service():
    from fastapi.responses import HTMLResponse
    html = f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Terms of Service — hottake</title><style>{_LEGAL_STYLE}</style></head><body>
<nav><a href="https://bighottake.com">← hottake</a></nav>
<h1>Terms of Service</h1>
<p class="meta">Last updated: April 7, 2026</p>

<h2>About the service</h2>
<p>hottake is a personal media tool for submitting, rating, and sharing opinion takes. It is provided as-is for personal and hobbyist use.</p>

<h2>SMS opt-in</h2>
<p>By entering your phone number and opting in, you agree to receive SMS messages from hottake. You can opt out at any time by replying STOP to any message. For help, reply HELP or email <a href="mailto:troyyoung@gmail.com">troyyoung@gmail.com</a>. Message and data rates may apply.</p>

<h2>User conduct</h2>
<p>You agree not to submit content that is illegal, threatening, or designed to harass others. We reserve the right to remove any content at our discretion.</p>

<h2>Limitation of liability</h2>
<p>hottake is provided without warranty of any kind. We are not liable for any damages arising from use of the service.</p>

<h2>Changes</h2>
<p>We may update these terms at any time. Continued use of the service constitutes acceptance of the updated terms.</p>

<h2>Contact</h2>
<p>Questions? Email <a href="mailto:troyyoung@gmail.com">troyyoung@gmail.com</a>.</p>
</body></html>"""
    return HTMLResponse(content=html)


# ─── Public card endpoints ───────────────────────────────────────────────────

@app.get("/cards/{obs_id}/image.png", include_in_schema=False)
async def card_image(obs_id: str, db: AsyncSession = Depends(get_instance_db_session)):
    """Return a 600×320 PNG render of a single observation card. Public, no auth."""
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Observation).where(Observation.id == obs_id))
    obs = result.scalar_one_or_none()
    if not obs:
        raise HTTPException(404, "Card not found")
    from card_image import generate_card_image
    png_bytes = generate_card_image({
        "thesis":      obs.thesis,
        "raw_input":   obs.raw_input,
        "score":       obs.score,
        "is_hot_take": obs.is_hot_take,
        "summary":     obs.summary,
    })
    from fastapi.responses import Response
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/cards/{obs_id}", include_in_schema=False)
async def card_page(obs_id: str, db: AsyncSession = Depends(get_instance_db_session)):
    """Serve a minimal HTML page for a card — used for OG previews and link unfurling."""
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Observation).where(Observation.id == obs_id))
    obs = result.scalar_one_or_none()
    if not obs:
        raise HTTPException(404, "Card not found")
    base = "https://bighottake.com"
    title   = (obs.thesis or obs.raw_input or "")[:120]
    img_url = f"{base}/cards/{obs_id}/image.png"
    app_url = f"{base}/?card={obs_id}"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{title} — hottake</title>
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="Score: {int(obs.score or 0)} · Shared from hottake">
  <meta property="og:image" content="{img_url}">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="320">
  <meta property="og:url" content="{app_url}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="{img_url}">
  <meta http-equiv="refresh" content="0;url={app_url}">
</head>
<body style="background:#1C1C1E;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <a href="{app_url}" style="color:#FF00AE;font-family:sans-serif;font-size:14px">View on hottake →</a>
</body>
</html>"""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html)


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    maintenance = os.getenv("MAINTENANCE_MODE", "false").lower() == "true"
    return {"status": "ok", "maintenance": maintenance}


# ─── Take Evaluator ──────────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    take: str


@app.post("/evaluate")
async def evaluate_take_endpoint(body: EvaluateRequest):
    """Evaluate a hot take — no auth required."""
    if not body.take or not body.take.strip():
        raise HTTPException(status_code=400, detail="take cannot be empty")
    result = await evaluate_take(body.take.strip())
    return result


# ─── Observations ─────────────────────────────────────────────────────────────

@app.post("/observations", response_model=ObservationOut, status_code=201)
async def create_observation(
    body: ObservationCreate,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
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
    instance_key = await get_instance_key(request)
    asyncio.create_task(_run_pipeline(obs.id, obs.raw_input, obs.input_type, image_b64, image_media_type, instance_key))
    return obs


import re as _re
_CTRL_CHARS = _re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')


def _sanitize(val):
    """Recursively strip bare control characters from strings so JSON stays valid."""
    if isinstance(val, str):
        return _CTRL_CHARS.sub('', val)
    if isinstance(val, dict):
        return {k: _sanitize(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_sanitize(v) for v in val]
    return val


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
        try:
            d = ObservationOut.model_validate(o).model_dump()
            d = _sanitize(d)
        except Exception:
            # Fall back to a minimal safe dict so one bad row doesn't kill the feed
            d = {
                "id": str(o.id),
                "thesis": _CTRL_CHARS.sub('', o.thesis or o.raw_input or ""),
                "status": o.status,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "score": o.score,
                "tags": [],
                "episode_tag": o.episode_tag,
                "episode_title": o.episode_title,
                "sources": o.sources,
                "summary": o.summary,
                "parent_id": o.parent_id,
                "pinned": bool(o.pinned) if o.pinned is not None else False,
            }
        # Episode posts show podcast name (stored in context field) or "PvA" fallback; regular posts show the user's name
        d["user_name"] = (o.context or "PvA") if o.episode_tag else (user_map.get(o.user_id) if o.user_id else "Anonymous")
        # Parse pva_take from briefing field
        if o.briefing:
            try:
                d["pva_take"] = _json.loads(_CTRL_CHARS.sub('', o.briefing))
            except (ValueError, TypeError):
                pass
        out.append(d)
    return out


@app.get("/observations")
async def list_observations(
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    from sqlalchemy import or_
    # Always include pinned observations + the 300 most recent
    pinned_q = select(Observation).where(Observation.pinned == True).order_by(desc(Observation.created_at))
    recent_q = select(Observation).order_by(desc(Observation.created_at)).limit(300)
    pinned_result = await db.execute(pinned_q)
    recent_result = await db.execute(recent_q)
    pinned_obs = list(pinned_result.scalars().all())
    recent_obs = list(recent_result.scalars().all())
    # Merge, deduplicate, preserve order
    seen = set()
    merged = []
    for o in pinned_obs + recent_obs:
        if o.id not in seen:
            seen.add(o.id)
            merged.append(o)
    merged.sort(key=lambda o: o.created_at, reverse=True)
    return await _attach_user_names(db, merged)


@app.get("/observations/{obs_id}")
async def get_observation(obs_id: str, request: Request, db: AsyncSession = Depends(get_instance_db_session)):
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
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
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
    instance_key = await get_instance_key(request)
    asyncio.create_task(_run_pipeline(obs.id, obs.raw_input, obs.input_type, image_b64, image_media_type, instance_key))
    rows = await _attach_user_names(db, [obs])
    return rows[0]


# ─── Takes (user comments) ──────────────────────────────────────────────────

@app.get("/observations/{obs_id}/takes", response_model=list[TakeOut])
async def list_takes(obs_id: str, request: Request, db: AsyncSession = Depends(get_instance_db_session)):
    result = await db.execute(
        select(Take).where(Take.observation_id == obs_id).order_by(Take.created_at)
    )
    takes = list(result.scalars().all())
    # Attach user names
    user_ids = {t.user_id for t in takes if t.user_id}
    user_map: dict[str, str] = {}
    if user_ids:
        users = await db.execute(select(User).where(User.id.in_(user_ids)))
        for u in users.scalars():
            user_map[u.id] = u.name
    out = []
    for t in takes:
        d = TakeOut.model_validate(t).model_dump()
        d["user_name"] = user_map.get(t.user_id, "Anonymous") if t.user_id else "Anonymous"
        out.append(d)
    return out


@app.post("/observations/{obs_id}/takes", response_model=TakeOut, status_code=201)
async def create_take(
    obs_id: str,
    body: TakeCreate,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    take = Take(
        observation_id=obs_id,
        user_id=current_user.id if current_user else None,
        text=body.text,
        audio_b64=body.audio_b64,
        duration_secs=body.duration_secs,
    )
    db.add(take)
    await db.commit()
    await db.refresh(take)
    d = TakeOut.model_validate(take).model_dump()
    d["user_name"] = current_user.name if current_user else "Anonymous"
    return d


@app.delete("/takes/{take_id}", status_code=204)
async def delete_take(
    take_id: str,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    take = await db.get(Take, take_id)
    if not take:
        raise HTTPException(404)
    if take.user_id and current_user and take.user_id != current_user.id:
        raise HTTPException(403, "You can only delete your own takes")
    await db.delete(take)
    await db.commit()


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


@app.post("/observations/{obs_id}/retry")
async def retry_observation(obs_id: str, request: Request, db: AsyncSession = Depends(get_instance_db_session),
                            current_user: User | None = Depends(get_current_user)):
    """Re-run the pipeline for an errored observation. Admin only."""
    if not current_user or not _is_admin(current_user):
        raise HTTPException(403, "Admin only")
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404, "Not found")
    if obs.status not in ("error", "pending"):
        raise HTTPException(400, f"Cannot retry observation with status={obs.status}")
    instance_key = await get_instance_key(request)
    obs.status = "pending"
    obs.error_detail = None
    await db.commit()
    asyncio.create_task(_run_pipeline(str(obs.id), obs.raw_input, obs.input_type or "text", instance_key=instance_key))
    return {"ok": True, "id": obs_id}


@app.post("/observations/{obs_id}/stress-test")
async def create_stress_test(obs_id: str, request: Request, db: AsyncSession = Depends(get_instance_db_session)):
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
async def create_counterpoint(obs_id: str, request: Request, db: AsyncSession = Depends(get_instance_db_session)):
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
async def create_pva_take(obs_id: str, request: Request, body: PvaTakeRequest = PvaTakeRequest(), db: AsyncSession = Depends(get_instance_db_session)):
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
async def bullshit_check(obs_id: str, request: Request, db: AsyncSession = Depends(get_instance_db_session)):
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


@app.post("/observations/{obs_id}/joke")
async def lightbulb_joke(obs_id: str, request: Request, db: AsyncSession = Depends(get_instance_db_session)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    try:
        joke = await generate_joke(obs.thesis or obs.raw_input)
    except Exception as e:
        raise HTTPException(500, f"Joke generation failed: {str(e)}")
    return {"joke": joke}


@app.get("/observations/{obs_id}/challenges")
async def get_challenges(obs_id: str, request: Request, db: AsyncSession = Depends(get_instance_db_session)):
    result = await db.execute(
        select(Observation)
        .where(Observation.parent_id == obs_id)
        .order_by(Observation.created_at)
    )
    return await _attach_user_names(db, list(result.scalars().all()))


@app.get("/observations/{obs_id}/counter-thesis")
async def get_counter_thesis(obs_id: str, request: Request, db: AsyncSession = Depends(get_instance_db_session)):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    counter = await negate_thesis(obs.thesis or obs.raw_input)
    return {"counter_thesis": counter}


@app.delete("/observations/{obs_id}", status_code=204)
async def delete_observation(
    obs_id: str,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    if obs.user_id and current_user and obs.user_id != current_user.id and not _is_admin(current_user):
        raise HTTPException(403, "You can only delete your own observations")
    await db.delete(obs)
    await db.commit()


@app.patch("/observations/{obs_id}/anonymize", status_code=200)
async def anonymize_observation(
    obs_id: str,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """Remove the author attribution from an observation (set to Anonymous)."""
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    if obs.user_id and current_user and obs.user_id != current_user.id and not _is_admin(current_user):
        raise HTTPException(403, "You can only anonymize your own observations")
    obs.user_id = None
    await db.commit()
    return {"ok": True}


@app.patch("/observations/{obs_id}/pin", status_code=200)
async def pin_observation(
    obs_id: str,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """Admin-only: toggle pin on an observation to force it to the top of the feed."""
    if not current_user or not _is_admin(current_user):
        raise HTTPException(403, "Admin only")
    obs = await db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404)
    obs.pinned = not obs.pinned
    await db.commit()
    return {"ok": True, "pinned": obs.pinned}


@app.patch("/episodes/{tag}/pin", status_code=200)
async def pin_episode_bundle(
    tag: str,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """Admin-only: toggle pin on all observations in an episode bundle."""
    if not current_user or not _is_admin(current_user):
        raise HTTPException(403, "Admin only")
    from sqlalchemy import select as sa_select
    result = await db.execute(
        sa_select(Observation).where(Observation.episode_tag == tag)
    )
    obs_list = result.scalars().all()
    if not obs_list:
        raise HTTPException(404, "No observations found for that tag")
    # Toggle: if any are pinned, unpin all; if none are pinned, pin all
    new_state = not any(o.pinned for o in obs_list)
    for o in obs_list:
        o.pinned = new_state
    await db.commit()
    return {"ok": True, "pinned": new_state, "count": len(obs_list)}


@app.post("/episodes/{tag}/retry", status_code=200)
async def retry_episode_bundle(
    tag: str,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """Admin-only: re-queue all errored observations in an episode bundle."""
    if not current_user or not _is_admin(current_user):
        raise HTTPException(403, "Admin only")
    from sqlalchemy import select as sa_select
    result = await db.execute(
        sa_select(Observation).where(
            Observation.episode_tag == tag,
            Observation.status == "error"
        )
    )
    obs_list = result.scalars().all()
    if not obs_list:
        return {"ok": True, "retried": 0, "message": "No errored observations in this bundle"}
    instance_key = await get_instance_key(request)
    for obs in obs_list:
        obs.status = "pending"
        obs.error_detail = None
    await db.commit()
    for obs in obs_list:
        asyncio.create_task(_run_pipeline(str(obs.id), obs.raw_input, obs.input_type or "text", instance_key=instance_key))
    return {"ok": True, "retried": len(obs_list)}


@app.delete("/episodes/{tag}", status_code=200)
async def delete_episode_bundle(
    tag: str,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """Admin-only: delete all observations in an episode bundle."""
    if not current_user or not _is_admin(current_user):
        raise HTTPException(403, "Admin only")
    from sqlalchemy import select as sa_select, delete as sa_delete
    result = await db.execute(sa_select(Observation).where(Observation.episode_tag == tag))
    obs_list = result.scalars().all()
    if not obs_list:
        raise HTTPException(404, "No observations found for that tag")
    count = len(obs_list)
    await db.execute(sa_delete(Observation).where(Observation.episode_tag == tag))
    await db.commit()
    return {"ok": True, "deleted": count}


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
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
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
        instance_key = await get_instance_key(request)
        asyncio.create_task(_run_pipeline(obs.id, obs.raw_input, obs.input_type, None, "image/jpeg", instance_key))
        created.append(obs.id)
    return {"episode_tag": body.episode_tag, "observations": created, "count": len(created)}


# ─── Podcast ingestion ──────────────────────────────────────────────────────

class PodcastIngest(BaseModel):
    url: str
    episode_title: str
    episode_tag: str | None = None
    podcast_name: str | None = None
    count: int = 5
    author_name: str = "Podcast"
    admin_key: str | None = None
    model: str | None = None  # override extraction model (e.g. 'gemini-2.5-flash')


@app.get("/podcasts/metadata")
async def get_podcast_metadata(url: str):
    """Fetch episode title and show name from a YouTube or Apple Podcasts URL."""
    import urllib.parse, re as _re2

    def _slug(text: str) -> str:
        return _re2.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80]

    # ── Apple Podcasts ──────────────────────────────────────────────────────
    if "podcasts.apple.com" in url:
        try:
            show_match = _re2.search(r'/id(\d+)', url)
            episode_match = _re2.search(r'[?&]i=(\d+)', url)
            if not show_match:
                raise HTTPException(400, "Could not parse Apple Podcasts URL")
            show_id = show_match.group(1)
            episode_id = episode_match.group(1) if episode_match else None

            async with httpx.AsyncClient(timeout=10.0) as client:
                # Get show info + RSS feed
                show_r = await client.get(f"https://itunes.apple.com/lookup?id={show_id}&entity=podcast")
                show_data = show_r.json()
                show_results = show_data.get("results", [])
                if not show_results:
                    raise HTTPException(400, "Podcast not found on iTunes")
                show_name = show_results[0].get("collectionName", "")

                # Get episode title if episode ID provided
                episode_title = ""
                if episode_id:
                    ep_r = await client.get(
                        f"https://itunes.apple.com/lookup?id={show_id}&entity=podcastEpisode&limit=200"
                    )
                    if ep_r.is_success:
                        for ep in ep_r.json().get("results", []):
                            if str(ep.get("trackId", "")) == episode_id:
                                episode_title = ep.get("trackName", "")
                                break

                # Fall back to latest episode title from RSS if needed
                if not episode_title:
                    rss_url = show_results[0].get("feedUrl", "")
                    if rss_url:
                        rss_r = await client.get(
                            rss_url,
                            headers={"User-Agent": "Mozilla/5.0"},
                            follow_redirects=True
                        )
                        items = rss_r.text.split('<item>')
                        if len(items) > 1:
                            title_m = _re2.search(r'<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>', items[1])
                            if title_m:
                                episode_title = title_m.group(1).strip()

            return {
                "title": episode_title,
                "channel": show_name,
                "episode_tag": _slug(episode_title or show_name),
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(400, f"Could not fetch Apple Podcasts metadata: {str(e)}")

    # ── YouTube ─────────────────────────────────────────────────────────────
    try:
        oembed_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(url)}&format=json"
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(oembed_url)
        if r.status_code != 200:
            raise HTTPException(400, "Could not fetch YouTube metadata — check the URL")
        data = r.json()
        title = data.get("title", "")
        channel = data.get("author_name", "")
        return {"title": title, "channel": channel, "episode_tag": _slug(title)}
    except httpx.TimeoutException:
        raise HTTPException(400, "YouTube metadata fetch timed out")
    except Exception as e:
        raise HTTPException(400, f"Could not fetch metadata: {str(e)}")


@app.post("/podcasts/ingest", status_code=202)
async def ingest_podcast(
    body: PodcastIngest,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """Fetch YouTube transcript, extract takes, create observations.

    Hybrid sync/async flow:
    - Fast validation (5s timeout on transcript fetch) returns errors immediately
    - Success spawns async processing for take extraction and pipeline execution

    Requires auth OR admin_key in body.

    Returns 202 with observation IDs immediately after creating observations.
    Observations will be processed asynchronously through the steel man pipeline.
    """
    # Auth check
    if not current_user and not body.admin_key:
        raise HTTPException(401, "Not authenticated")
    if body.admin_key and body.admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")

    # Import here to avoid circular dependencies
    from transcript_service import fetch_transcript, extract_podcast_takes, TranscriptError

    # Fetch transcript (Supadata can take 10-30s for audio transcription)
    try:
        import asyncio
        transcript = await asyncio.wait_for(
            asyncio.to_thread(fetch_transcript, body.url),
            timeout=120.0
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            400,
            "Transcript fetch timed out after 120 seconds. Try a shorter video or check that it's publicly accessible."
        )
    except TranscriptError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Unexpected error fetching transcript: {str(e)}")

    # Extract takes
    try:
        takes = await extract_podcast_takes(transcript, count=body.count, model=body.model or None)
    except ValueError as e:
        raise HTTPException(500, f"Failed to extract takes: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"Unexpected error extracting takes: {str(e)}")

    if not takes:
        raise HTTPException(400, "No high-quality takes found in transcript (all below quality threshold of 70)")

    # Generate episode tag from title if missing
    episode_tag = body.episode_tag
    if not episode_tag:
        # Create slug from title
        episode_tag = body.episode_title.lower()
        episode_tag = episode_tag.replace(" ", "-")
        episode_tag = "".join(c for c in episode_tag if c.isalnum() or c == "-")
        episode_tag = episode_tag[:100]  # Limit length

    # Create observations (skip format_thesis step to preserve speaker voice)
    user_id = current_user.id if current_user else None
    created = []
    instance_key = await get_instance_key(request)

    for take in takes:
        # Build metadata with speaker and timestamp
        metadata = {
            "speaker": take["speaker"],
            "timestamp": take["start"],
            "end_timestamp": take["end"],
            "quality_score": take["quality_score"],
        }
        if body.podcast_name:
            metadata["podcast_name"] = body.podcast_name

        obs = Observation(
            raw_input=take["headline"],
            input_type="text",
            thesis=take["headline"],
            summary=take.get("context") or None,
            status="researching",
            model_used=ACTIVE_MODEL,
            user_id=user_id,
            context=body.podcast_name or None,
            episode_tag=episode_tag,
            episode_title=body.episode_title,
            sources=[{"url": body.url, "title": "episode"}],
        )
        db.add(obs)
        await db.commit()
        await db.refresh(obs)

        # Spawn async pipeline (steel man generation)
        # Start from steel man generation (skip format_thesis)
        asyncio.create_task(_run_steel_man_only(obs.id, instance_key))
        created.append(obs.id)

    return {
        "episode_tag": episode_tag,
        "episode_title": body.episode_title,
        "podcast_name": body.podcast_name or "Podcast",
        "observations": created,
        "count": len(created),
        "transcript_length": len(transcript["text"]),
    }


class PodcastTakeItem(BaseModel):
    headline: str
    context: str = ""
    speaker: str
    start: float
    end: float
    quality_score: int


class PodcastPostTakes(BaseModel):
    url: str
    episode_title: str
    episode_tag: str | None = None
    podcast_name: str | None = None
    takes: list[PodcastTakeItem]
    admin_key: str | None = None


@app.post("/podcasts/preview")
async def preview_podcast_takes(
    body: PodcastIngest,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    """Fetch transcript and extract takes — returns takes for preview without creating observations."""
    if not current_user and not body.admin_key:
        raise HTTPException(401, "Not authenticated")
    if body.admin_key and body.admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")

    from transcript_service import fetch_transcript, extract_podcast_takes, TranscriptError
    import asyncio

    try:
        transcript = await asyncio.wait_for(
            asyncio.to_thread(fetch_transcript, body.url),
            timeout=120.0
        )
    except asyncio.TimeoutError:
        raise HTTPException(400, "Transcript fetch timed out after 120 seconds.")
    except TranscriptError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Unexpected error fetching transcript: {str(e)}")

    try:
        takes = await extract_podcast_takes(transcript, count=body.count, model=body.model or None)
    except Exception as e:
        raise HTTPException(500, f"Failed to extract takes: {str(e)}")

    return {
        "takes": takes,
        "transcript_length": len(transcript["text"]),
        "transcript_source": transcript.get("source", "unknown"),
    }


@app.post("/podcasts/post-takes", status_code=202)
async def post_podcast_takes(
    body: PodcastPostTakes,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """Create observations from pre-selected takes (second step after preview)."""
    if not current_user and not body.admin_key:
        raise HTTPException(401, "Not authenticated")
    if body.admin_key and body.admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")
    if not body.takes:
        raise HTTPException(400, "No takes provided")

    import asyncio, re as _re
    episode_tag = body.episode_tag
    if not episode_tag:
        episode_tag = _re.sub(r"[^a-z0-9]+", "-", body.episode_title.lower()).strip("-")[:100]

    user_id = current_user.id if current_user else None
    instance_key = await get_instance_key(request)
    created = []

    for take in body.takes:
        metadata = {
            "speaker": take.speaker,
            "timestamp": take.start,
            "end_timestamp": take.end,
            "quality_score": take.quality_score,
        }
        if body.podcast_name:
            metadata["podcast_name"] = body.podcast_name

        obs = Observation(
            raw_input=take.headline,
            input_type="text",
            thesis=take.headline,
            summary=take.context or None,
            status="researching",
            model_used=ACTIVE_MODEL,
            user_id=user_id,
            context=body.podcast_name or None,
            episode_tag=episode_tag,
            episode_title=body.episode_title,
            sources=[{"url": body.url, "title": "episode"}],
        )
        db.add(obs)
        await db.commit()
        await db.refresh(obs)
        asyncio.create_task(_run_steel_man_only(obs.id, instance_key))
        created.append(obs.id)

    return {
        "episode_tag": episode_tag,
        "episode_title": body.episode_title,
        "podcast_name": body.podcast_name or "Podcast",
        "observations": created,
        "count": len(created),
    }


# ── News Bundles ─────────────────────────────────────────────────────────────

class NewsBundlePreview(BaseModel):
    source: str = "nyt-opinion"   # nyt-opinion | wsj-opinion
    count: int = 5
    admin_key: str | None = None


class NewsBundleTakeItem(BaseModel):
    headline: str
    context: str = ""
    author: str = ""
    source_title: str = ""
    source_url: str = ""
    quality_score: int = 0


class NewsBundlePost(BaseModel):
    source: str = "nyt-opinion"
    bundle_title: str
    bundle_tag: str
    takes: list[NewsBundleTakeItem]
    admin_key: str | None = None


@app.post("/news-bundles/preview")
async def preview_news_bundle(
    body: NewsBundlePreview,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    """Fetch opinion pieces and extract takes — returns preview without creating observations."""
    if not current_user and not body.admin_key:
        raise HTTPException(401, "Not authenticated")
    if body.admin_key and body.admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")

    from news_service import fetch_opinion_stories, extract_opinion_takes, make_bundle_tag, make_bundle_title

    try:
        stories = await fetch_opinion_stories(source_key=body.source)
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch feed: {str(e)}")

    if not stories:
        raise HTTPException(500, "No stories returned from feed")

    try:
        takes = await extract_opinion_takes(stories, source_key=body.source, count=body.count)
    except Exception as e:
        raise HTTPException(500, f"Failed to extract takes: {str(e)}")

    return {
        "takes":        takes,
        "bundle_tag":   make_bundle_tag(body.source),
        "bundle_title": make_bundle_title(body.source),
        "story_count":  len(stories),
    }


@app.post("/news-bundles/post-takes", status_code=202)
async def post_news_bundle_takes(
    body: NewsBundlePost,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """Create observations from a reviewed news bundle."""
    if not current_user and not body.admin_key:
        raise HTTPException(401, "Not authenticated")
    if body.admin_key and body.admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")
    if not body.takes:
        raise HTTPException(400, "No takes provided")

    from news_service import SOURCES
    import asyncio

    user_id = current_user.id if current_user else None
    instance_key = await get_instance_key(request)
    created = []

    for take in body.takes:
        obs = Observation(
            raw_input=take.headline,
            input_type="text",
            thesis=take.headline,
            summary=take.context or None,
            status="researching",
            model_used=ACTIVE_MODEL,
            user_id=user_id,
            context=take.author or None,   # author per card, like speaker for podcasts
            episode_tag=body.bundle_tag,
            episode_title=body.bundle_title,
            sources=[{"url": take.source_url, "title": "article", "label": take.source_title}] if take.source_url else [],
        )
        db.add(obs)
        await db.commit()
        await db.refresh(obs)
        asyncio.create_task(_run_steel_man_only(obs.id, instance_key))
        created.append(obs.id)

    return {
        "bundle_tag":   body.bundle_tag,
        "bundle_title": body.bundle_title,
        "count":        len(created),
        "observations": created,
    }


async def _run_steel_man_only(observation_id: str, instance_key: str = "hot-takes"):
    """Run thesis formatting + steel man generation for podcast takes."""
    _, session_maker = get_instance_engine(instance_key)
    async with session_maker() as db:
        try:
            result = await db.execute(select(Observation).where(Observation.id == observation_id))
            obs = result.scalar_one_or_none()
            if not obs or not obs.raw_input:
                return

            # Format thesis (same as normal pipeline)
            formatted = await format_thesis(obs.raw_input, obs.input_type)
            obs = await db.get(Observation, observation_id)
            if not obs:
                return
            obs.thesis = formatted
            await db.commit()
            await db.refresh(obs)

            # Generate steel man
            steel_man_data, sources = await generate_steel_man(obs.thesis)

            obs = await db.get(Observation, observation_id)
            if not obs:
                return

            # Store as JSON string
            import json as _json
            obs.summary = _json.dumps(steel_man_data)
            if sources:
                # Preserve original episode/article sources before overwriting with search results
                episode_source = next((s for s in (obs.sources or []) if s.get("title") == "episode"), None)
                article_source = next((s for s in (obs.sources or []) if s.get("title") == "article"), None)
                pinned = [s for s in [article_source, episode_source] if s]
                obs.sources = pinned + sources

            # Build plain text version for metadata scoring
            sm_text = steel_man_data.get("bottom_line", "")
            if steel_man_data.get("bullets"):
                sm_text += "\n" + "\n".join(steel_man_data["bullets"])

            # Generate metadata
            try:
                meta = await generate_metadata(obs.thesis, sm_text)
                obs.score = meta.get("score")
                obs.tags = meta.get("tags")
                obs.evidence_type = meta.get("evidence_type")
                obs.category = meta.get("category")
                obs.brazen_score = meta.get("brazen_score")
                obs.specificity = meta.get("specificity")
                obs.arguability = meta.get("arguability")
                obs.originality = meta.get("originality")
                dims = [obs.brazen_score or 0, obs.specificity or 0, obs.arguability or 0, obs.originality or 0]
                obs.is_hot_take = bool((obs.score or 0) >= 85 and sum(dims) / len(dims) >= 70)
            except Exception as meta_err:
                print(f"Metadata generation failed (non-fatal): {meta_err}")

            obs.status = "complete"
            await db.commit()

        except Exception as e:
            err_msg = str(e)
            obs = await db.get(Observation, observation_id)
            if obs:
                obs.status = "error"
                obs.error_detail = err_msg[:500]
                await db.commit()
                print(f"Steel man pipeline error for {observation_id}: {err_msg[:200]}")


# ─── Podcast webhook (future automation) ────────────────────────────────────


@app.post("/podcasts/webhook", status_code=501)
async def podcast_webhook(request: Request):
    """Webhook endpoint for future podcast automation.

    Currently returns 501 Not Implemented. Use POST /podcasts/ingest for manual ingestion.
    Logs webhook receipt for future automation work.
    """
    import logging
    logger = logging.getLogger(__name__)

    # Log webhook receipt for future automation work
    body = await request.body()
    logger.info(f"Podcast webhook received: {body[:200] if body else '(empty)'}")

    return {
        "status": "not_implemented",
        "message": "Podcast automation is not yet implemented. Please use POST /podcasts/ingest for manual podcast ingestion.",
        "manual_endpoint": "/podcasts/ingest"
    }


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


_rescore_status: dict = {"running": False, "done": False, "result": None}

async def _run_rescore_bg(obs_ids: list[str], dry_run: bool):
    """Background rescore task — runs after HTTP response is sent."""
    global _rescore_status
    _rescore_status = {"running": True, "done": False, "result": None}
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Observation).where(
                    Observation.status == "complete",
                    Observation.thesis != None,
                    Observation.id.in_(obs_ids),
                )
            )
            obs_list = list(result.scalars().all())

            results, failed = [], 0
            for obs in obs_list:
                try:
                    sm_text = obs.summary or ""
                    meta = await generate_metadata(obs.thesis or obs.raw_input, sm_text)
                    results.append((obs, meta))
                except Exception as e:
                    print(f"[rescore] failed {obs.id}: {e}")
                    failed += 1

            raw_scores = [m.get("score") or 0        for _, m in results]
            raw_brazen = [m.get("brazen_score") or 0  for _, m in results]
            raw_spec   = [m.get("specificity") or 0   for _, m in results]
            raw_arg    = [m.get("arguability") or 0   for _, m in results]
            raw_orig   = [m.get("originality") or 0   for _, m in results]
            norm_scores = _rank_normalize(raw_scores, lo=15.0, hi=95.0)
            norm_brazen = _rank_normalize(raw_brazen, lo=10.0, hi=95.0)
            norm_spec   = _rank_normalize(raw_spec,   lo=10.0, hi=95.0)
            norm_arg    = _rank_normalize(raw_arg,    lo=10.0, hi=95.0)
            norm_orig   = _rank_normalize(raw_orig,   lo=10.0, hi=95.0)

            if not dry_run:
                for (obs, meta), ns, nb, nsp, narg, nori in zip(results, norm_scores, norm_brazen, norm_spec, norm_arg, norm_orig):
                    obs.score        = ns
                    obs.brazen_score = nb
                    obs.specificity  = nsp
                    obs.arguability  = narg
                    obs.originality  = nori
                    obs.tags         = meta.get("tags")
                    obs.evidence_type = meta.get("evidence_type")
                    obs.category     = meta.get("category")
                    dims = [nb, nsp, narg, nori]
                    obs.is_hot_take  = bool(ns >= 85 and sum(dims) / len(dims) >= 70)
                await db.commit()

            from collections import Counter
            valid = sorted(norm_scores)
            hot_count = sum(1 for ns, nb, nsp, narg, nori in zip(norm_scores, norm_brazen, norm_spec, norm_arg, norm_orig)
                           if ns >= 85 and sum([nb, nsp, narg, nori]) / 4 >= 70)
            _rescore_status = {
                "running": False, "done": True,
                "result": {
                    "total": len(obs_ids), "updated": len(results), "failed": failed,
                    "dry_run": dry_run,
                    "range": [min(valid), max(valid)] if valid else [],
                    "mean": round(sum(valid) / len(valid), 1) if valid else None,
                    "unique": len(set(valid)),
                    "hot_takes": hot_count,
                }
            }
    except Exception as e:
        _rescore_status = {"running": False, "done": True, "result": {"error": str(e)}}
        print(f"[rescore] background task failed: {e}")


@app.post("/admin/rescore")
async def rescore_all(body: RescoreBody, current_user: User = Depends(require_user), db: AsyncSession = Depends(get_db)):
    """Kick off rescore as background task — returns immediately."""
    if not _is_admin(current_user):
        raise HTTPException(403)
    if _rescore_status.get("running"):
        raise HTTPException(409, "Rescore already in progress")
    result = await db.execute(
        select(Observation.id).where(Observation.status == "complete", Observation.thesis != None)
    )
    obs_ids = [str(r[0]) for r in result.all()]
    asyncio.create_task(_run_rescore_bg(obs_ids, body.dry_run))
    return {"ok": True, "queued": len(obs_ids), "dry_run": body.dry_run}


@app.get("/admin/rescore/status")
async def rescore_status(current_user: User = Depends(require_user)):
    """Poll rescore progress."""
    if not _is_admin(current_user):
        raise HTTPException(403)
    return _rescore_status


# ─── Migration: bulk restore summaries from backup ───────────────────────────

class SummaryRestoreItem(BaseModel):
    id: str
    summary: str

class SummaryRestoreBody(BaseModel):
    admin_key: str
    items: list[SummaryRestoreItem]

@app.post("/admin/restore-summaries")
async def restore_summaries(body: SummaryRestoreBody, db: AsyncSession = Depends(get_db)):
    """Bulk-update summary field from backup data. Safe: only writes where summary is currently NULL."""
    if body.admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")

    updated, skipped, not_found = 0, 0, 0
    for item in body.items:
        obs = await db.get(Observation, item.id)
        if not obs:
            not_found += 1
            continue
        if obs.summary:
            skipped += 1
            continue
        obs.summary = item.summary
        updated += 1

    await db.commit()
    return {"updated": updated, "skipped": skipped, "not_found": not_found, "total": len(body.items)}


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


@app.post("/admin/patch-episode-source")
async def patch_episode_source(
    episode_tag: str,
    podcast_name: str,
    admin_key: str,
    request: Request,
    db: AsyncSession = Depends(get_instance_db_session),
):
    """Backfill context (podcast name) for all observations in an episode."""
    if admin_key != settings.google_api_key:
        raise HTTPException(403, "Invalid admin key")
    # Use raw SQL UPDATE to bypass any ORM mapping issues
    result = await db.execute(
        text("UPDATE observations SET context = :name WHERE episode_tag = :tag"),
        {"name": podcast_name, "tag": episode_tag},
    )
    await db.commit()
    # Count affected rows
    count_result = await db.execute(
        text("SELECT COUNT(*) FROM observations WHERE episode_tag = :tag AND context = :name"),
        {"tag": episode_tag, "name": podcast_name},
    )
    count = count_result.scalar() or 0
    return {"patched": count, "episode_tag": episode_tag, "podcast_name": podcast_name}


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


# ─── Meta Admin Interface ───────────────────────────────────────────────────


class PromptUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    system: str | None = None
    max_tokens: int | None = None
    model: str | None = None


class DesignTokenUpdate(BaseModel):
    path: list[str]
    value: str


class PromptComparisonRequest(BaseModel):
    saved_prompt_key: str
    draft_system: str
    draft_max_tokens: int
    test_query: str
    preview_model: str | None = None


class TestQueryInput(BaseModel):
    id: str | None = None
    query_text: str
    order_index: int


class TestSuiteCreate(BaseModel):
    name: str
    description: str | None = None
    queries: list[str]


class TestSuiteUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    queries: list[TestQueryInput] | None = None


class BatchComparisonRequest(BaseModel):
    saved_prompt_key: str
    draft_system: str
    draft_max_tokens: int
    suite_id: str
    preview_model: str | None = None


@app.get("/instance/{instance_key}/config")
async def get_instance_config(instance_key: str):
    """Get merged configuration for an instance (prompts + design tokens + ui_copy)."""
    prompts = await get_all_prompts(instance_key)
    design_tokens = await get_design_tokens(instance_key)
    ui_copy = await get_ui_copy(instance_key)

    return {
        "instance_key": instance_key,
        "prompts": prompts,
        "design_tokens": design_tokens,
        "ui_copy": ui_copy
    }


@app.get("/admin/prompts")
async def get_prompts(current_user: User = Depends(require_user)):
    """Get all LLM prompt configurations."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")
    return await get_all_prompts()


@app.get("/admin/prompts/{prompt_key}")
async def get_prompt_detail(prompt_key: str, current_user: User = Depends(require_user)):
    """Get a specific prompt configuration."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")
    prompt = await get_prompt(prompt_key)
    if not prompt:
        raise HTTPException(404, "Prompt not found")
    return prompt


@app.put("/admin/prompts/{prompt_key}")
async def update_prompt_config(
    prompt_key: str,
    updates: PromptUpdate,
    current_user: User = Depends(require_user)
):
    """Update a prompt configuration (persisted to database)."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    update_data = {}
    if updates.name is not None:
        update_data["name"] = updates.name
    if updates.description is not None:
        update_data["description"] = updates.description
    if updates.system is not None:
        update_data["system"] = updates.system
    if updates.max_tokens is not None:
        update_data["max_tokens"] = updates.max_tokens
    if updates.model is not None:
        update_data["model"] = updates.model

    if not await update_prompt(prompt_key, update_data):
        raise HTTPException(404, "Prompt not found")

    return {"status": "updated", "prompt": await get_prompt(prompt_key)}


@app.post("/admin/prompts/{prompt_key}/reset")
async def reset_prompt_to_default(
    prompt_key: str,
    current_user: User = Depends(require_user)
):
    """Reset a prompt back to its built-in default."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")
    from prompts import PROMPTS
    default = PROMPTS.get(prompt_key)
    if not default:
        raise HTTPException(404, "No default found for this prompt key")
    await update_prompt(prompt_key, {
        "name": default["name"],
        "description": default.get("description", ""),
        "system": default["system"],
        "max_tokens": default["max_tokens"],
        "model": default.get("model"),
    })
    return {"status": "reset", "prompt": await get_prompt(prompt_key)}


@app.post("/admin/prompts/compare")
async def compare_prompts(
    comparison: PromptComparisonRequest,
    current_user: User = Depends(require_user)
):
    """Run side-by-side comparison of saved vs draft prompt (ephemeral, not persisted)."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    import asyncio
    import time
    from pipeline import _call

    # Get saved prompt
    saved = await get_prompt(comparison.saved_prompt_key)
    if not saved:
        raise HTTPException(404, "Saved prompt not found")

    # Cost estimates (USD per 1M tokens) - approximations for Gemini Flash and Claude Haiku
    COST_PER_1M_INPUT = 0.075  # Gemini Flash / Claude Haiku input
    COST_PER_1M_OUTPUT = 0.30  # Gemini Flash / Claude Haiku output

    async def call_with_metadata(call_type: str, system: str, user: str, max_tokens: int, model: str | None = None):
        try:
            start_time = time.time()
            result = await asyncio.wait_for(
                _call(system=system, user=user, max_tokens=max_tokens, return_metadata=True, model=model),
                timeout=30.0
            )
            latency = time.time() - start_time

            if isinstance(result, dict):
                input_tokens = result.get("input_tokens", 0)
                output_tokens = result.get("output_tokens", 0)
                total_tokens = input_tokens + output_tokens
                cost = (input_tokens / 1_000_000 * COST_PER_1M_INPUT) + (output_tokens / 1_000_000 * COST_PER_1M_OUTPUT)

                return {
                    "output": result.get("text", ""),
                    "error": None,
                    "latency_ms": round(latency * 1000),
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                    "estimated_cost_usd": round(cost, 6),
                    "model": result.get("model")
                }
            else:
                # Fallback if metadata not returned
                return {
                    "output": str(result),
                    "error": None,
                    "latency_ms": round(latency * 1000),
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "estimated_cost_usd": 0
                }
        except asyncio.TimeoutError:
            return {
                "output": None,
                "error": f"{call_type} prompt timed out after 30s. Try a simpler test query or reduce max_tokens.",
                "latency_ms": 30000,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": 0
            }
        except Exception as e:
            error_msg = str(e)
            if "API" in error_msg or "api" in error_msg:
                error = f"{call_type} prompt failed: {error_msg}. Check your API key or try again."
            elif "network" in error_msg.lower() or "connection" in error_msg.lower():
                error = f"{call_type} prompt failed: Network error. Check your connection and retry."
            else:
                error = f"{call_type} prompt failed: {error_msg}"

            return {
                "output": None,
                "error": error,
                "latency_ms": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": 0
            }

    # Run both prompts concurrently
    saved_result, draft_result = await asyncio.gather(
        call_with_metadata("Saved", saved["system"], comparison.test_query, saved["max_tokens"], comparison.preview_model),
        call_with_metadata("Draft", comparison.draft_system, comparison.test_query, comparison.draft_max_tokens, comparison.preview_model),
        return_exceptions=True
    )

    # Handle results (including exceptions from gather)
    if isinstance(saved_result, Exception):
        saved_result = {
            "output": None,
            "error": f"Saved prompt failed: {str(saved_result)}",
            "latency_ms": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "estimated_cost_usd": 0
        }

    if isinstance(draft_result, Exception):
        draft_result = {
            "output": None,
            "error": f"Draft prompt failed: {str(draft_result)}",
            "latency_ms": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "estimated_cost_usd": 0
        }

    return {
        "test_query": comparison.test_query,
        "saved": {
            "name": saved["name"],
            "system": saved["system"],
            "max_tokens": saved["max_tokens"],
            **saved_result
        },
        "draft": {
            "system": comparison.draft_system,
            "max_tokens": comparison.draft_max_tokens,
            **draft_result
        }
    }


@app.post("/admin/prompts/preview")
async def preview_prompt(
    comparison: PromptComparisonRequest,
    current_user: User = Depends(require_user)
):
    """Alias for compare endpoint - preview a draft prompt against saved version."""
    return await compare_prompts(comparison, current_user)


@app.get("/admin/prompts/test-suites")
async def list_test_suites(
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """List all test suites with query counts."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    result = await db.execute(select(PromptTestSuite).order_by(PromptTestSuite.created_at.desc()))
    suites = result.scalars().all()

    suite_list = []
    for suite in suites:
        query_result = await db.execute(
            select(PromptTestQuery).where(PromptTestQuery.suite_id == suite.id)
        )
        queries = query_result.scalars().all()
        suite_list.append({
            "id": suite.id,
            "name": suite.name,
            "description": suite.description,
            "query_count": len(queries),
            "created_at": suite.created_at.isoformat()
        })

    return suite_list


@app.post("/admin/prompts/test-suites")
async def create_test_suite(
    suite_data: TestSuiteCreate,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new test suite."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    # Check if name already exists
    result = await db.execute(
        select(PromptTestSuite).where(PromptTestSuite.name == suite_data.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(400, "A test suite with this name already exists")

    # Create suite
    suite = PromptTestSuite(
        name=suite_data.name,
        description=suite_data.description
    )
    db.add(suite)
    await db.flush()

    # Create queries
    queries = []
    for idx, query_text in enumerate(suite_data.queries):
        query = PromptTestQuery(
            suite_id=suite.id,
            query_text=query_text,
            order_index=idx
        )
        db.add(query)
        queries.append(query)

    await db.commit()
    await db.refresh(suite)

    return {
        "id": suite.id,
        "name": suite.name,
        "description": suite.description,
        "queries": [
            {
                "id": q.id,
                "query_text": q.query_text,
                "order_index": q.order_index
            }
            for q in queries
        ]
    }


@app.get("/admin/prompts/test-suites/{suite_id}")
async def get_test_suite(
    suite_id: str,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific test suite with all queries."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    suite = await db.get(PromptTestSuite, suite_id)
    if not suite:
        raise HTTPException(404, "Test suite not found")

    result = await db.execute(
        select(PromptTestQuery)
        .where(PromptTestQuery.suite_id == suite_id)
        .order_by(PromptTestQuery.order_index)
    )
    queries = result.scalars().all()

    return {
        "id": suite.id,
        "name": suite.name,
        "description": suite.description,
        "queries": [
            {
                "id": q.id,
                "query_text": q.query_text,
                "order_index": q.order_index
            }
            for q in queries
        ]
    }


@app.put("/admin/prompts/test-suites/{suite_id}")
async def update_test_suite(
    suite_id: str,
    suite_data: TestSuiteUpdate,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a test suite."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    suite = await db.get(PromptTestSuite, suite_id)
    if not suite:
        raise HTTPException(404, "Test suite not found")

    # Update name and description
    if suite_data.name is not None:
        # Check for name conflicts (excluding current suite)
        result = await db.execute(
            select(PromptTestSuite)
            .where(PromptTestSuite.name == suite_data.name)
            .where(PromptTestSuite.id != suite_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(400, "A test suite with this name already exists")
        suite.name = suite_data.name

    if suite_data.description is not None:
        suite.description = suite_data.description

    # Update queries if provided
    if suite_data.queries is not None:
        # Delete all existing queries
        await db.execute(
            text("DELETE FROM prompt_test_queries WHERE suite_id = :suite_id").bindparams(suite_id=suite_id)
        )

        # Create new queries
        for query_input in suite_data.queries:
            query = PromptTestQuery(
                suite_id=suite_id,
                query_text=query_input.query_text,
                order_index=query_input.order_index
            )
            db.add(query)

    await db.commit()
    await db.refresh(suite)

    # Get updated queries
    result = await db.execute(
        select(PromptTestQuery)
        .where(PromptTestQuery.suite_id == suite_id)
        .order_by(PromptTestQuery.order_index)
    )
    queries = result.scalars().all()

    return {
        "id": suite.id,
        "name": suite.name,
        "description": suite.description,
        "queries": [
            {
                "id": q.id,
                "query_text": q.query_text,
                "order_index": q.order_index
            }
            for q in queries
        ]
    }


@app.delete("/admin/prompts/test-suites/{suite_id}")
async def delete_test_suite(
    suite_id: str,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a test suite (cascades to queries)."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    suite = await db.get(PromptTestSuite, suite_id)
    if not suite:
        raise HTTPException(404, "Test suite not found")

    await db.delete(suite)
    await db.commit()

    return {"status": "deleted", "id": suite_id}


@app.post("/admin/prompts/compare-suite")
async def compare_suite(
    comparison: BatchComparisonRequest,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Run batch comparison of saved vs draft prompt across entire test suite."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    import asyncio
    import time
    from pipeline import _call

    # Get saved prompt
    saved = await get_prompt(comparison.saved_prompt_key)
    if not saved:
        raise HTTPException(404, "Saved prompt not found")

    # Get test suite
    suite = await db.get(PromptTestSuite, comparison.suite_id)
    if not suite:
        raise HTTPException(404, "Test suite not found")

    # Get all queries
    result = await db.execute(
        select(PromptTestQuery)
        .where(PromptTestQuery.suite_id == comparison.suite_id)
        .order_by(PromptTestQuery.order_index)
    )
    queries = result.scalars().all()

    if not queries:
        raise HTTPException(400, "Test suite has no queries")

    # Cost estimates (USD per 1M tokens)
    COST_PER_1M_INPUT = 0.075
    COST_PER_1M_OUTPUT = 0.30

    # Helper function to call with timeout and metadata
    async def call_with_metadata(call_type: str, system: str, user: str, max_tokens: int, model: str | None = None):
        try:
            start_time = time.time()
            result = await asyncio.wait_for(
                _call(system=system, user=user, max_tokens=max_tokens, return_metadata=True, model=model),
                timeout=30.0
            )
            latency = time.time() - start_time

            if isinstance(result, dict):
                input_tokens = result.get("input_tokens", 0)
                output_tokens = result.get("output_tokens", 0)
                total_tokens = input_tokens + output_tokens
                cost = (input_tokens / 1_000_000 * COST_PER_1M_INPUT) + (output_tokens / 1_000_000 * COST_PER_1M_OUTPUT)

                return {
                    "output": result.get("text", ""),
                    "error": None,
                    "latency_ms": round(latency * 1000),
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                    "estimated_cost_usd": round(cost, 6),
                    "model": result.get("model")
                }
            else:
                return {
                    "output": str(result),
                    "error": None,
                    "latency_ms": round(latency * 1000),
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "estimated_cost_usd": 0
                }
        except asyncio.TimeoutError:
            return {
                "output": None,
                "error": f"{call_type} timed out (30s)",
                "latency_ms": 30000,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": 0
            }
        except Exception as e:
            return {
                "output": None,
                "error": f"{call_type} error: {str(e)}",
                "latency_ms": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": 0
            }

    # Run comparisons for all queries
    results = []
    total_saved_tokens = 0
    total_draft_tokens = 0
    total_saved_latency = 0
    total_draft_latency = 0
    total_saved_cost = 0
    total_draft_cost = 0

    for query in queries:
        saved_result, draft_result = await asyncio.gather(
            call_with_metadata("Saved", saved["system"], query.query_text, saved["max_tokens"], comparison.preview_model),
            call_with_metadata("Draft", comparison.draft_system, query.query_text, comparison.draft_max_tokens, comparison.preview_model),
            return_exceptions=True
        )

        # Handle exceptions
        if isinstance(saved_result, Exception):
            saved_result = {
                "output": None,
                "error": f"Saved failed: {str(saved_result)}",
                "latency_ms": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": 0
            }

        if isinstance(draft_result, Exception):
            draft_result = {
                "output": None,
                "error": f"Draft failed: {str(draft_result)}",
                "latency_ms": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": 0
            }

        # Accumulate totals
        total_saved_tokens += saved_result.get("total_tokens", 0)
        total_draft_tokens += draft_result.get("total_tokens", 0)
        total_saved_latency += saved_result.get("latency_ms", 0)
        total_draft_latency += draft_result.get("latency_ms", 0)
        total_saved_cost += saved_result.get("estimated_cost_usd", 0)
        total_draft_cost += draft_result.get("estimated_cost_usd", 0)

        results.append({
            "query_text": query.query_text,
            "saved_output": saved_result.get("output"),
            "saved_error": saved_result.get("error"),
            "saved_latency_ms": saved_result.get("latency_ms"),
            "saved_tokens": saved_result.get("total_tokens"),
            "draft_output": draft_result.get("output"),
            "draft_error": draft_result.get("error"),
            "draft_latency_ms": draft_result.get("latency_ms"),
            "draft_tokens": draft_result.get("total_tokens")
        })

    num_queries = len(queries)
    return {
        "suite_name": suite.name,
        "results": results,
        "aggregate_metrics": {
            "total_queries": num_queries,
            "saved": {
                "avg_latency_ms": round(total_saved_latency / num_queries) if num_queries > 0 else 0,
                "avg_tokens": round(total_saved_tokens / num_queries) if num_queries > 0 else 0,
                "total_cost_usd": round(total_saved_cost, 6)
            },
            "draft": {
                "avg_latency_ms": round(total_draft_latency / num_queries) if num_queries > 0 else 0,
                "avg_tokens": round(total_draft_tokens / num_queries) if num_queries > 0 else 0,
                "total_cost_usd": round(total_draft_cost, 6)
            }
        }
    }


@app.get("/admin/prompt-samples")
async def get_prompt_samples(
    limit: int = 5,
    request: Request = None,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_instance_db_session)
):
    """Return recent observations to use as live test samples for prompt comparison."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")
    try:
        limit = max(1, min(limit, 10))
        # Raw SQL — bypasses ORM column mapping entirely, works regardless of schema state
        # ORDER BY RANDOM() so Refresh actually returns different samples each time
        result = await db.execute(
            text(
                "SELECT id, raw_input, thesis, created_at FROM observations"
                " WHERE raw_input IS NOT NULL AND raw_input != ''"
                " AND status = 'complete'"
                " ORDER BY RANDOM() LIMIT :lim"
            ),
            {"lim": limit},
        )
        rows = result.mappings().all()
        return [
            {
                "id": str(row["id"]),
                "label": (row["raw_input"][:80] + "…") if len(row["raw_input"]) > 80 else row["raw_input"],
                "text": row["raw_input"],
                "thesis": row["thesis"] or "",
                "created_at": row["created_at"].isoformat() if row["created_at"] and hasattr(row["created_at"], "isoformat") else str(row["created_at"]) if row["created_at"] else None,
            }
            for row in rows
        ]
    except Exception as e:
        import traceback
        print(f"[prompt-samples] error: {traceback.format_exc()}")
        raise HTTPException(500, f"Failed to load samples: {str(e)}")


class SampleComparisonRequest(BaseModel):
    saved_prompt_key: str
    draft_system: str
    draft_max_tokens: int
    queries: list[str]
    # Prompt diff mode: set preview_model (same model for both calls, vary prompt text)
    preview_model: str | None = None
    # Model diff mode: set draft_model (same prompt for both calls, vary model)
    # When draft_model is set, draft_system is ignored — saved system is used for both
    draft_model: str | None = None


@app.post("/admin/prompts/compare-samples")
async def compare_samples(
    comparison: SampleComparisonRequest,
    current_user: User = Depends(require_user),
):
    """Run batch comparison against inline sample queries (no suite required)."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")
    if not comparison.queries:
        raise HTTPException(400, "At least one query required")

    import asyncio
    import time
    from pipeline import _call

    saved = await get_prompt(comparison.saved_prompt_key)
    if not saved:
        raise HTTPException(404, "Saved prompt not found")

    COST_PER_1M_INPUT = 0.075
    COST_PER_1M_OUTPUT = 0.30

    async def call_with_metadata(call_type: str, system: str, user: str, max_tokens: int, model: str | None = None):
        try:
            start_time = time.time()
            result = await asyncio.wait_for(
                _call(system=system, user=user, max_tokens=max_tokens, return_metadata=True, model=model),
                timeout=30.0
            )
            latency = time.time() - start_time
            if isinstance(result, dict):
                input_tokens = result.get("input_tokens", 0)
                output_tokens = result.get("output_tokens", 0)
                total_tokens = input_tokens + output_tokens
                cost = (input_tokens / 1_000_000 * COST_PER_1M_INPUT) + (output_tokens / 1_000_000 * COST_PER_1M_OUTPUT)
                return {"output": result.get("text", ""), "error": None, "latency_ms": round(latency * 1000),
                        "input_tokens": input_tokens, "output_tokens": output_tokens, "total_tokens": total_tokens,
                        "estimated_cost_usd": round(cost, 6), "model": result.get("model")}
            return {"output": str(result), "error": None, "latency_ms": round(latency * 1000),
                    "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "estimated_cost_usd": 0}
        except asyncio.TimeoutError:
            return {"output": None, "error": f"{call_type} timed out (30s)", "latency_ms": 30000,
                    "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "estimated_cost_usd": 0}
        except Exception as e:
            return {"output": None, "error": f"{call_type} error: {str(e)}", "latency_ms": 0,
                    "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "estimated_cost_usd": 0}

    results = []
    total_saved_tokens = total_draft_tokens = 0
    total_saved_latency = total_draft_latency = 0
    total_saved_cost = total_draft_cost = 0.0

    # Determine what varies between saved and draft calls
    if comparison.draft_model:
        # Model diff: same prompt text for both, different models
        saved_system = saved["system"]
        draft_system = saved["system"]
        saved_model = saved.get("model") or None   # prompt's own model (or active default)
        draft_model = comparison.draft_model
        saved_max_tokens = saved["max_tokens"]
        draft_max_tokens = saved["max_tokens"]
    else:
        # Prompt diff: same model for both, different prompt texts
        saved_system = saved["system"]
        draft_system = comparison.draft_system
        saved_model = comparison.preview_model or saved.get("model") or None
        draft_model = comparison.preview_model or saved.get("model") or None
        saved_max_tokens = saved["max_tokens"]
        draft_max_tokens = comparison.draft_max_tokens

    for query_text in comparison.queries:
        saved_result, draft_result = await asyncio.gather(
            call_with_metadata("Saved", saved_system, query_text, saved_max_tokens, saved_model),
            call_with_metadata("Draft", draft_system, query_text, draft_max_tokens, draft_model),
            return_exceptions=True
        )
        if isinstance(saved_result, Exception):
            saved_result = {"output": None, "error": str(saved_result), "latency_ms": 0,
                            "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "estimated_cost_usd": 0}
        if isinstance(draft_result, Exception):
            draft_result = {"output": None, "error": str(draft_result), "latency_ms": 0,
                            "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "estimated_cost_usd": 0}

        total_saved_tokens += saved_result.get("total_tokens", 0)
        total_draft_tokens += draft_result.get("total_tokens", 0)
        total_saved_latency += saved_result.get("latency_ms", 0)
        total_draft_latency += draft_result.get("latency_ms", 0)
        total_saved_cost += saved_result.get("estimated_cost_usd", 0)
        total_draft_cost += draft_result.get("estimated_cost_usd", 0)

        results.append({
            "query_text": query_text,
            "saved_output": saved_result.get("output"),
            "saved_error": saved_result.get("error"),
            "saved_latency_ms": saved_result.get("latency_ms"),
            "saved_tokens": saved_result.get("total_tokens"),
            "draft_output": draft_result.get("output"),
            "draft_error": draft_result.get("error"),
            "draft_latency_ms": draft_result.get("latency_ms"),
            "draft_tokens": draft_result.get("total_tokens"),
        })

    n = len(comparison.queries)
    mode = "model" if comparison.draft_model else "prompt"
    return {
        "suite_name": f"Live Samples ({n})",
        "mode": mode,
        "saved_label": f"{saved.get('model') or 'default model'}" if mode == "model" else "Current prompt",
        "draft_label": comparison.draft_model if mode == "model" else "Draft prompt",
        "results": results,
        "aggregate_metrics": {
            "total_queries": n,
            "saved": {
                "avg_latency_ms": round(total_saved_latency / n) if n else 0,
                "avg_tokens": round(total_saved_tokens / n) if n else 0,
                "total_cost_usd": round(total_saved_cost, 6),
            },
            "draft": {
                "avg_latency_ms": round(total_draft_latency / n) if n else 0,
                "avg_tokens": round(total_draft_tokens / n) if n else 0,
                "total_cost_usd": round(total_draft_cost, 6),
            },
        },
    }


@app.get("/admin/design-tokens")
async def get_design_tokens_endpoint(current_user: User = Depends(require_user)):
    """Get all design tokens."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")
    return await get_design_tokens()


@app.put("/admin/design-tokens")
async def update_design_token_endpoint(
    update: DesignTokenUpdate,
    current_user: User = Depends(require_user)
):
    """Update a design token value (persisted to database)."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    if not await update_design_token(update.path, update.value):
        raise HTTPException(404, "Design token not found")

    return {"status": "updated", "path": update.path, "value": update.value}


@app.get("/admin/simplified-tokens")
async def get_simplified_tokens_endpoint(
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Get simplified design tokens for editing (< 15 high-leverage controls)."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")
    try:
        from design_tokens import DESIGN_TOKENS
        # Reuse the shared DB session to avoid connection pool exhaustion
        result = await db.execute(select(Instance).where(Instance.key == "hot-takes"))
        instance = result.scalar_one_or_none()
        full_tokens = DESIGN_TOKENS
        if instance:
            cfg = await db.execute(
                select(InstanceConfig)
                .where(InstanceConfig.instance_id == instance.id)
                .where(InstanceConfig.config_type == "design_tokens")
            )
            config = cfg.scalar_one_or_none()
            if config and config.config_data:
                full_tokens = config.config_data
        simplified = get_simplified_tokens_from_full(full_tokens)
        return {
            "tokens": simplified,
            "labels": TOKEN_LABELS,
            "descriptions": TOKEN_DESCRIPTIONS
        }
    except Exception as e:
        import traceback
        print(f"[design-tokens] error: {traceback.format_exc()}")
        raise HTTPException(500, f"Failed to load design tokens: {str(e)}")


class SimplifiedTokensUpdate(BaseModel):
    tokens: dict[str, str]


@app.put("/admin/simplified-tokens")
async def update_simplified_tokens_endpoint(
    update: SimplifiedTokensUpdate,
    deploy: bool = True,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Save simplified tokens and optionally trigger staging deployment."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")
    try:
        from design_tokens import DESIGN_TOKENS
        # Load current tokens using the shared DB session (avoid extra connection)
        instance_key = "hot-takes"
        inst_result = await db.execute(select(Instance).where(Instance.key == instance_key))
        instance = inst_result.scalar_one_or_none()
        full_tokens = DESIGN_TOKENS
        if instance:
            cfg = await db.execute(
                select(InstanceConfig)
                .where(InstanceConfig.instance_id == instance.id)
                .where(InstanceConfig.config_type == "design_tokens")
            )
            existing_config = cfg.scalar_one_or_none()
            if existing_config and existing_config.config_data:
                full_tokens = existing_config.config_data

        # Apply simplified changes to full structure
        updated_full = apply_simplified_tokens_to_full(update.tokens, full_tokens)

        if not instance:
            raise HTTPException(404, "Instance not found")

        # Update or create config
        cfg2 = await db.execute(
            select(InstanceConfig)
            .where(InstanceConfig.instance_id == instance.id)
            .where(InstanceConfig.config_type == "design_tokens")
        )
        config = cfg2.scalar_one_or_none()

        if config:
            config.config_data = updated_full
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(config, "config_data")
        else:
            config = InstanceConfig(
                instance_id=instance.id,
                config_type="design_tokens",
                config_data=updated_full
            )
            db.add(config)

        await db.commit()

        # Optionally trigger staging deployment
        deployment_triggered = False
        if deploy:
            deployment_triggered = await trigger_staging_deployment()

        return {
            "status": "saved",
            "deployment_triggered": deployment_triggered,
            "message": "Design tokens saved successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[design-tokens-put] error: {traceback.format_exc()}")
        raise HTTPException(500, f"Failed to save design tokens: {str(e)}")


@app.post("/admin/simplified-tokens/revert")
async def revert_simplified_tokens_endpoint(
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Revert design tokens to defaults."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    from design_tokens import DESIGN_TOKENS

    instance_key = "hot-takes"  # Default instance
    result = await db.execute(select(Instance).where(Instance.key == instance_key))
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(404, "Instance not found")

    # Update or create config with defaults
    result = await db.execute(
        select(InstanceConfig)
        .where(InstanceConfig.instance_id == instance.id)
        .where(InstanceConfig.config_type == "design_tokens")
    )
    config = result.scalar_one_or_none()

    if config:
        config.config_data = DESIGN_TOKENS.copy()
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(config, "config_data")
    else:
        config = InstanceConfig(
            instance_id=instance.id,
            config_type="design_tokens",
            config_data=DESIGN_TOKENS.copy()
        )
        db.add(config)

    await db.commit()

    # Return the reverted simplified tokens
    simplified = get_simplified_tokens_from_full(DESIGN_TOKENS)

    return {
        "status": "reverted",
        "tokens": simplified,
        "message": "Design tokens reverted to defaults"
    }


async def trigger_staging_deployment() -> bool:
    """Trigger staging redeployment via Railway deploy webhook."""
    hook_url = settings.railway_staging_deploy_hook
    if not hook_url:
        print("RAILWAY_STAGING_DEPLOY_HOOK not configured — skipping deploy trigger")
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(hook_url)
            if r.status_code < 300:
                print(f"Staging deploy triggered (HTTP {r.status_code})")
                return True
            print(f"Staging deploy webhook returned {r.status_code}: {r.text[:200]}")
            return False
    except Exception as e:
        print(f"Failed to trigger staging deployment: {e}")
        return False


# ─── Instance Management ─────────────────────────────────────────────────────


class InstanceCreate(BaseModel):
    key: str
    display_name: str
    subdirectory: str | None = None
    clone_from: str | None = None  # instance key to clone config from


class InstanceUpdate(BaseModel):
    display_name: str | None = None
    subdirectory: str | None = None
    is_active: bool | None = None


class InstanceConfigUpdate(BaseModel):
    ui_copy: dict | None = None
    design_tokens: dict | None = None
    prompts: dict | None = None


@app.get("/admin/instances")
async def list_instances(current_user: User = Depends(require_user), db: AsyncSession = Depends(get_db)):
    """List all instances."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    result = await db.execute(select(Instance).order_by(Instance.created_at))
    instances = result.scalars().all()

    return [
        {
            "id": inst.id,
            "key": inst.key,
            "display_name": inst.display_name,
            "subdirectory": inst.subdirectory,
            "is_active": inst.is_active,
            "created_at": inst.created_at.isoformat(),
            "updated_at": inst.updated_at.isoformat(),
            "url": f"/{inst.key}/" if inst.key != "hot-takes" else "/"
        }
        for inst in instances
    ]


@app.post("/admin/instances", status_code=201)
async def create_instance(
    body: InstanceCreate,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new instance with database provisioning."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    # Validate key format
    if not re.match(r'^[a-z0-9-]+$', body.key):
        raise HTTPException(400, "Instance key must be lowercase alphanumeric with hyphens only")

    # Check if key already exists
    result = await db.execute(select(Instance).where(Instance.key == body.key))
    if result.scalar_one_or_none():
        raise HTTPException(409, f"Instance with key '{body.key}' already exists")

    # Create instance record
    instance = Instance(
        key=body.key,
        display_name=body.display_name,
        subdirectory=body.subdirectory,
        database_name=None,  # Using file-based SQLite
        is_active=True
    )
    db.add(instance)
    await db.flush()

    # Determine what to clone from
    clone_source_id = None
    if body.clone_from:
        result = await db.execute(select(Instance).where(Instance.key == body.clone_from))
        clone_source = result.scalar_one_or_none()
        if clone_source:
            clone_source_id = clone_source.id

    # Seed prompts (clone or use defaults)
    if clone_source_id:
        # Clone prompts from source instance
        result = await db.execute(
            select(InstancePrompt).where(InstancePrompt.instance_id == clone_source_id)
        )
        source_prompts = result.scalars().all()
        for src in source_prompts:
            prompt = InstancePrompt(
                instance_id=instance.id,
                prompt_key=src.prompt_key,
                name=src.name,
                description=src.description,
                system=src.system,
                max_tokens=src.max_tokens,
                is_default=False
            )
            db.add(prompt)
    else:
        # Use system defaults
        for prompt_key, prompt_config in PROMPTS.items():
            prompt = InstancePrompt(
                instance_id=instance.id,
                prompt_key=prompt_key,
                name=prompt_config["name"],
                description=prompt_config["description"],
                system=prompt_config["system"],
                max_tokens=prompt_config["max_tokens"],
                is_default=True
            )
            db.add(prompt)

    # Seed design tokens (clone or use defaults)
    from design_tokens import DESIGN_TOKENS
    if clone_source_id:
        result = await db.execute(
            select(InstanceConfig)
            .where(InstanceConfig.instance_id == clone_source_id)
            .where(InstanceConfig.config_type == "design_tokens")
        )
        source_config = result.scalar_one_or_none()
        design_data = source_config.config_data if source_config else DESIGN_TOKENS
    else:
        design_data = DESIGN_TOKENS

    design_config = InstanceConfig(
        instance_id=instance.id,
        config_type="design_tokens",
        config_data=design_data
    )
    db.add(design_config)

    # Seed UI copy (clone or use defaults)
    from ui_copy import UI_COPY
    if clone_source_id:
        result = await db.execute(
            select(InstanceConfig)
            .where(InstanceConfig.instance_id == clone_source_id)
            .where(InstanceConfig.config_type == "ui_copy")
        )
        source_config = result.scalar_one_or_none()
        ui_data = source_config.config_data if source_config else UI_COPY
    else:
        ui_data = UI_COPY

    ui_config = InstanceConfig(
        instance_id=instance.id,
        config_type="ui_copy",
        config_data=ui_data
    )
    db.add(ui_config)

    await db.commit()
    await db.refresh(instance)

    # Initialize instance database
    engine, _ = get_instance_engine(body.key)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    return {
        "id": instance.id,
        "key": instance.key,
        "display_name": instance.display_name,
        "subdirectory": instance.subdirectory,
        "is_active": instance.is_active,
        "created_at": instance.created_at.isoformat(),
        "url": f"/{instance.key}/"
    }


@app.put("/admin/instances/{instance_key}")
async def update_instance(
    instance_key: str,
    body: InstanceUpdate,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Update instance metadata."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    result = await db.execute(select(Instance).where(Instance.key == instance_key))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(404, "Instance not found")

    if body.display_name is not None:
        instance.display_name = body.display_name
    if body.subdirectory is not None:
        instance.subdirectory = body.subdirectory
    if body.is_active is not None:
        instance.is_active = body.is_active

    await db.commit()
    await db.refresh(instance)

    return {
        "id": instance.id,
        "key": instance.key,
        "display_name": instance.display_name,
        "subdirectory": instance.subdirectory,
        "is_active": instance.is_active,
        "updated_at": instance.updated_at.isoformat()
    }


@app.get("/admin/instances/{instance_key}/config")
async def get_instance_config_admin(
    instance_key: str,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Get full config for instance editing."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    result = await db.execute(select(Instance).where(Instance.key == instance_key))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(404, "Instance not found")

    # Get all prompts
    result = await db.execute(
        select(InstancePrompt).where(InstancePrompt.instance_id == instance.id)
    )
    db_prompts = result.scalars().all()
    prompts = {
        p.prompt_key: {
            "name": p.name,
            "description": p.description,
            "system": p.system,
            "max_tokens": int(p.max_tokens)
        }
        for p in db_prompts
    }

    # Get design tokens
    result = await db.execute(
        select(InstanceConfig)
        .where(InstanceConfig.instance_id == instance.id)
        .where(InstanceConfig.config_type == "design_tokens")
    )
    design_config = result.scalar_one_or_none()
    design_tokens = design_config.config_data if design_config else {}

    # Get UI copy
    result = await db.execute(
        select(InstanceConfig)
        .where(InstanceConfig.instance_id == instance.id)
        .where(InstanceConfig.config_type == "ui_copy")
    )
    ui_config = result.scalar_one_or_none()
    ui_copy = ui_config.config_data if ui_config else {}

    return {
        "instance": {
            "id": instance.id,
            "key": instance.key,
            "display_name": instance.display_name,
            "subdirectory": instance.subdirectory,
            "is_active": instance.is_active
        },
        "prompts": prompts,
        "design_tokens": design_tokens,
        "ui_copy": ui_copy
    }


@app.put("/admin/instances/{instance_key}/config")
async def update_instance_config(
    instance_key: str,
    body: InstanceConfigUpdate,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Update instance configuration (UI copy, design tokens, prompts)."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    result = await db.execute(select(Instance).where(Instance.key == instance_key))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(404, "Instance not found")

    # Update UI copy if provided
    if body.ui_copy is not None:
        result = await db.execute(
            select(InstanceConfig)
            .where(InstanceConfig.instance_id == instance.id)
            .where(InstanceConfig.config_type == "ui_copy")
        )
        config = result.scalar_one_or_none()
        if config:
            config.config_data = body.ui_copy
        else:
            config = InstanceConfig(
                instance_id=instance.id,
                config_type="ui_copy",
                config_data=body.ui_copy
            )
            db.add(config)

    # Update design tokens if provided
    if body.design_tokens is not None:
        result = await db.execute(
            select(InstanceConfig)
            .where(InstanceConfig.instance_id == instance.id)
            .where(InstanceConfig.config_type == "design_tokens")
        )
        config = result.scalar_one_or_none()
        if config:
            config.config_data = body.design_tokens
        else:
            config = InstanceConfig(
                instance_id=instance.id,
                config_type="design_tokens",
                config_data=body.design_tokens
            )
            db.add(config)

    # Update prompts if provided
    if body.prompts is not None:
        for prompt_key, prompt_data in body.prompts.items():
            result = await db.execute(
                select(InstancePrompt)
                .where(InstancePrompt.instance_id == instance.id)
                .where(InstancePrompt.prompt_key == prompt_key)
            )
            prompt = result.scalar_one_or_none()
            if prompt:
                prompt.name = prompt_data.get("name", prompt.name)
                prompt.description = prompt_data.get("description", prompt.description)
                prompt.system = prompt_data.get("system", prompt.system)
                prompt.max_tokens = prompt_data.get("max_tokens", prompt.max_tokens)
            else:
                prompt = InstancePrompt(
                    instance_id=instance.id,
                    prompt_key=prompt_key,
                    name=prompt_data["name"],
                    description=prompt_data["description"],
                    system=prompt_data["system"],
                    max_tokens=prompt_data["max_tokens"],
                    is_default=False
                )
                db.add(prompt)

    await db.commit()

    return {"status": "updated", "instance_key": instance_key}


@app.delete("/admin/instances/{instance_key}", status_code=200)
async def delete_instance(
    instance_key: str,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Soft delete instance (set is_active=false)."""
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin access required")

    result = await db.execute(select(Instance).where(Instance.key == instance_key))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(404, "Instance not found")

    instance.is_active = False
    await db.commit()

    return {"status": "deactivated", "key": instance_key}
