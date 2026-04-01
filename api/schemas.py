from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ObservationCreate(BaseModel):
    raw_input: str
    input_type: str = "text"
    image_data: Optional[str] = None
    image_media_type: Optional[str] = None
    parent_id: Optional[str] = None
    challenge_type: Optional[str] = None  # "counter" | "bullshit"


class ObservationOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    raw_input: str
    input_type: str
    thesis: Optional[str]
    status: str
    summary: Optional[str]
    stress_test: Optional[dict]
    score: Optional[float]
    tags: Optional[list]
    evidence_type: Optional[str]
    sources: Optional[list] = None
    model_used: Optional[str] = None
    error_detail: Optional[str] = None
    image_data: Optional[str] = None
    image_media_type: Optional[str] = None
    parent_id: Optional[str] = None
    challenge_type: Optional[str] = None
    bs_score: Optional[float] = None
    bs_verdict: Optional[str] = None
    pva_take: Optional[dict] = None
    episode_tag: Optional[str] = None
    episode_title: Optional[str] = None
    created_at: datetime
