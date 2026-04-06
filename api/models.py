import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, JSON, Float, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


def _now():
    return datetime.now(timezone.utc)


def _uuid():
    return str(uuid.uuid4())


class Take(Base):
    __tablename__ = "takes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    observation_id: Mapped[str] = mapped_column(String, ForeignKey("observations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True, index=True)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_b64: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_secs: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    google_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True, index=True)
    raw_input: Mapped[str] = mapped_column(Text)
    input_type: Mapped[str] = mapped_column(String, default="text")
    thesis: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="formatting")
    confidence: Mapped[str | None] = mapped_column(String, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    supporting_ideas: Mapped[list | None] = mapped_column(JSON, nullable=True)
    counter_ideas: Mapped[list | None] = mapped_column(JSON, nullable=True)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    more_questions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    stress_test: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    briefing: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    evidence_type: Mapped[str | None] = mapped_column(String, nullable=True)
    sources: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [{url, title}, ...]
    model_used: Mapped[str | None] = mapped_column(String, nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # base64
    image_media_type: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. image/jpeg
    parent_id: Mapped[str | None] = mapped_column(String, ForeignKey("observations.id"), nullable=True, index=True)
    challenge_type: Mapped[str | None] = mapped_column(String, nullable=True)  # "counter" | "bullshit" | None
    bs_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0-100, 100 = total BS
    bs_verdict: Mapped[str | None] = mapped_column(Text, nullable=True)  # one punchy line
    episode_tag: Mapped[str | None] = mapped_column(String, nullable=True, index=True)  # e.g. "the-war-on-slop"
    episode_title: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "The War on Slop"
    episode_url: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "https://youtube.com/watch?v=..."
    category: Mapped[str | None] = mapped_column(String, nullable=True)  # broad topic category
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Instance(Base):
    __tablename__ = "instances"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    key: Mapped[str] = mapped_column(String, unique=True, index=True)  # unique slug like "hot-takes"
    display_name: Mapped[str] = mapped_column(String)
    subdirectory: Mapped[str | None] = mapped_column(String, nullable=True)
    database_name: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class InstanceConfig(Base):
    __tablename__ = "instance_configs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    instance_id: Mapped[str] = mapped_column(String, ForeignKey("instances.id", ondelete="CASCADE"), index=True)
    config_type: Mapped[str] = mapped_column(String)  # "branding", "design_tokens", "ui_copy"
    config_data: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class InstancePrompt(Base):
    __tablename__ = "instance_prompts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    instance_id: Mapped[str] = mapped_column(String, ForeignKey("instances.id", ondelete="CASCADE"), index=True)
    prompt_key: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    system: Mapped[str] = mapped_column(Text)
    max_tokens: Mapped[int] = mapped_column(Float)  # Using Float for integer storage compatibility
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class PodcastFeed(Base):
    __tablename__ = "podcast_feeds"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    url: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    auto_ingest: Mapped[bool] = mapped_column(Boolean, default=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PromptTestSuite(Base):
    __tablename__ = "prompt_test_suites"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class PromptTestQuery(Base):
    __tablename__ = "prompt_test_queries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    suite_id: Mapped[str] = mapped_column(String, ForeignKey("prompt_test_suites.id", ondelete="CASCADE"), index=True)
    query_text: Mapped[str] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Float)  # Using Float for integer storage compatibility
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
