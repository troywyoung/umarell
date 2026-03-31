import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


def _now():
    return datetime.now(timezone.utc)


def _uuid():
    return str(uuid.uuid4())


class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
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
    image_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # base64
    image_media_type: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. image/jpeg
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
