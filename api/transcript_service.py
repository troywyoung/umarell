"""YouTube transcript fetching service.

Fallback chain:
  1. youtube_transcript_api  — free, instant; requires captions to exist on the video
  2. Supadata API            — handles any public YouTube video, generates transcript from audio
"""

import re
import json
from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)


class TranscriptError(Exception):
    pass


def _extract_video_id(url: str) -> Optional[str]:
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


# ─── Method 1: youtube_transcript_api (free, instant) ─────────────────────────

def _fetch_via_caption_api(video_id: str) -> Optional[dict]:
    """Returns transcript dict on success, None if no captions available.
    Raises TranscriptError for hard failures (video unavailable, bad ID, etc.)."""
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        transcript = None
        try:
            transcript = transcript_list.find_manually_created_transcript(['en'])
        except NoTranscriptFound:
            try:
                transcript = transcript_list.find_generated_transcript(['en'])
            except NoTranscriptFound:
                available = (
                    transcript_list._manually_created_transcripts
                    or transcript_list._generated_transcripts
                )
                if available:
                    transcript = list(available.values())[0]

        if transcript is None:
            return None

        data = transcript.fetch()
        segments = [{"start": e["start"], "text": e["text"]} for e in data]
        full_text = " ".join(e["text"] for e in data)
        return {"text": full_text, "segments": segments, "source": "captions"}

    except VideoUnavailable:
        raise TranscriptError(
            f"Video {video_id} is unavailable. "
            "Check the URL is correct and the video is publicly accessible."
        )
    except (TranscriptsDisabled, NoTranscriptFound):
        return None  # soft failure — try Supadata
    except Exception as e:
        msg = str(e).lower()
        if any(x in msg for x in ("disabled", "no transcript", "could not retrieve", "subtitles")):
            return None  # soft failure — try Supadata
        raise TranscriptError(f"Caption API error for {video_id}: {e}")


# ─── Method 2: Supadata (handles any public YouTube video) ────────────────────

async def _fetch_via_supadata(video_id: str) -> dict:
    """Fetch transcript from Supadata API — works even without captions."""
    import httpx
    from config import settings

    if not settings.supadata_api_key:
        raise TranscriptError(
            "No captions found for this video and SUPADATA_API_KEY is not configured. "
            "Add your Supadata API key to enable fallback transcription."
        )

    url = f"https://api.supadata.ai/v1/youtube/transcript"
    params = {"videoId": video_id, "text": "true"}
    headers = {"x-api-key": settings.supadata_api_key}

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            r = await client.get(url, params=params, headers=headers)
        except Exception as e:
            raise TranscriptError(f"Supadata request failed: {e}")

    if r.status_code == 402:
        raise TranscriptError("Supadata quota exceeded. Check your plan at supadata.ai.")
    if r.status_code == 404:
        raise TranscriptError(
            f"Supadata could not find a transcript for video {video_id}. "
            "The video may be private, age-restricted, or too new."
        )
    if not r.is_success:
        raise TranscriptError(f"Supadata error {r.status_code}: {r.text[:200]}")

    data = r.json()

    # Supadata returns either:
    #   { "content": "full text", "segments": [{"text": ..., "offset": ..., "duration": ...}] }
    # or just { "content": "full text" } depending on the endpoint
    content = data.get("content") or data.get("transcript") or ""
    raw_segments = data.get("segments") or []

    segments = [
        {
            "start": float(s.get("offset", s.get("start", 0))) / 1000
                     if s.get("offset") is not None else float(s.get("start", 0)),
            "text": s.get("text", ""),
        }
        for s in raw_segments
    ]

    # If no segments returned, create a single segment from full text
    if not segments and content:
        segments = [{"start": 0.0, "text": content}]

    return {"text": content, "segments": segments, "source": "supadata"}


# ─── Public API ───────────────────────────────────────────────────────────────

def fetch_youtube_transcript(url: str) -> dict:
    """Fetch transcript for a YouTube URL.

    Called via asyncio.to_thread() from the FastAPI endpoint.
    Tries captions first; falls back to Supadata if unavailable.
    """
    import asyncio

    video_id = _extract_video_id(url)
    if not video_id:
        raise TranscriptError(
            f"Invalid YouTube URL: {url}. "
            "Expected format: https://youtube.com/watch?v=VIDEO_ID"
        )

    # 1. Try free caption API
    result = _fetch_via_caption_api(video_id)
    if result is not None:
        return result

    # 2. Fall back to Supadata
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(_fetch_via_supadata(video_id))
    finally:
        loop.close()


# ─── Take extraction ──────────────────────────────────────────────────────────

async def extract_podcast_takes(transcript: dict, count: int = 5) -> list[dict]:
    """Extract interesting claims from a podcast transcript using LLM analysis."""
    from pipeline import _call
    from prompts import get_prompt

    if not isinstance(transcript, dict):
        raise ValueError("Transcript must be a dictionary")
    if "text" not in transcript or "segments" not in transcript:
        raise ValueError("Transcript must contain 'text' and 'segments' keys")
    if not transcript["segments"]:
        raise ValueError("Transcript segments cannot be empty")

    transcript_text = transcript["text"][:100000]
    segments_formatted = [f"[{s['start']:.1f}s] {s['text']}" for s in transcript["segments"]]
    segments_text = "\n".join(segments_formatted[:1000])

    prompt_config = await get_prompt("extract_podcast_takes")
    user_prompt = f"""Extract the {count} most interesting claims from this podcast transcript.

Full transcript text:
{transcript_text}

Timestamped segments:
{segments_text}

Return a JSON array of the top {count} claims, each with: claim, speaker, start, end, quality_score.
Only include claims with quality_score >= 70."""

    try:
        response = await _call(
            system=prompt_config["system"],
            user=user_prompt,
            max_tokens=prompt_config["max_tokens"],
            retries=5,
            use_search=False,
        )
        if isinstance(response, tuple):
            response = response[0]

        response = response.strip()
        if response.startswith("```"):
            response = re.sub(r'^```(?:json)?\s*', '', response)
            response = re.sub(r'\s*```$', '', response)

        takes = json.loads(response)
        if not isinstance(takes, list):
            raise ValueError("LLM response must be a JSON array")

        filtered = []
        for take in takes:
            if not isinstance(take, dict):
                continue
            # Support both new format (headline/context) and legacy (claim)
            headline = take.get("headline") or take.get("claim", "")
            context = take.get("context", "")
            if not all(f in take for f in ["speaker", "start", "end", "quality_score"]):
                continue
            if not isinstance(headline, str) or not headline.strip():
                continue
            if not isinstance(take["speaker"], str) or not take["speaker"].strip():
                continue
            if not isinstance(take["quality_score"], (int, float)):
                continue
            if not isinstance(take["start"], (int, float)):
                continue
            if not isinstance(take["end"], (int, float)):
                continue
            if take["quality_score"] < 70:
                continue
            if take["start"] < 0 or take["end"] < 0 or take["end"] <= take["start"]:
                continue
            filtered.append({
                "headline": headline.strip(),
                "context": context.strip() if isinstance(context, str) else "",
                "speaker": take["speaker"].strip(),
                "start": float(take["start"]),
                "end": float(take["end"]),
                "quality_score": int(take["quality_score"]),
            })

        return filtered

    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse LLM response as JSON: {e}")
    except Exception as e:
        raise ValueError(f"Failed to extract podcast takes: {str(e)}")
