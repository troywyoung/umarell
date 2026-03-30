from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class Point(BaseModel):
    text: str
    source_title: Optional[str] = None
    source_url: Optional[str] = None


class Question(BaseModel):
    text: str


class StressTest(BaseModel):
    assumptions: list[str]
    strongest_objection: str
    evidence_flags: list[str]
    confidence_signal: str


class ObservationCreate(BaseModel):
    raw_input: str
    input_type: str = "text"
    image_data: Optional[str] = None   # base64-encoded image
    image_media_type: Optional[str] = None  # e.g. "image/jpeg"


class ObservationOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    raw_input: str
    input_type: str
    thesis: Optional[str]
    status: str
    confidence: Optional[str]
    summary: Optional[str]
    supporting_ideas: Optional[list[Point]]
    counter_ideas: Optional[list[Point]]
    context: Optional[str]
    more_questions: Optional[list[Question]]
    stress_test: Optional[StressTest]
    briefing: Optional[str]
    created_at: datetime
