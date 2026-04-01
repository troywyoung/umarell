import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, JSON, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


def _now():
    return datetime.now(timezone.utc)


def _uuid():
    return str(uuid.uuid4())


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
