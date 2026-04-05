"""YouTube transcript fetching service."""

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
    """Base exception for transcript-related errors."""
    pass


def _extract_video_id(url: str) -> Optional[str]:
    """
    Extract YouTube video ID from various URL formats.

    Supported formats:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://youtube.com/watch?v=VIDEO_ID
    - https://m.youtube.com/watch?v=VIDEO_ID

    Args:
        url: YouTube URL string

    Returns:
        Video ID if found, None otherwise
    """
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    return None


def fetch_youtube_transcript(url: str) -> dict:
    """
    Fetch transcript from a YouTube video.

    Returns transcript with full text and timestamped segments.
    Attempts to fetch auto-generated captions if manual captions aren't available.

    Args:
        url: YouTube video URL (youtube.com or youtu.be)

    Returns:
        dict with structure:
        {
            "text": str,  # Full transcript as plain text
            "segments": [  # List of timestamped segments
                {"start": float, "text": str},
                ...
            ]
        }

    Raises:
        TranscriptError: With actionable error message for various failure cases
    """
    # Extract video ID
    video_id = _extract_video_id(url)
    if not video_id:
        raise TranscriptError(
            f"Invalid YouTube URL format: {url}. "
            "Expected format: https://youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID"
        )

    # Fetch transcript
    try:
        # Get list of available transcripts
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # Try to find a transcript (prefer manual, fall back to auto-generated)
        transcript = None
        try:
            # First try to get manually created transcript in English
            transcript = transcript_list.find_manually_created_transcript(['en'])
        except NoTranscriptFound:
            try:
                # Fall back to auto-generated transcript in English
                transcript = transcript_list.find_generated_transcript(['en'])
            except NoTranscriptFound:
                # Try any available transcript
                available = transcript_list._manually_created_transcripts or transcript_list._generated_transcripts
                if available:
                    transcript = list(available.values())[0]

        if transcript is None:
            raise TranscriptError(
                f"No captions found for video {video_id}. "
                "Try a different video or paste transcript manually."
            )

        # Fetch the transcript data
        transcript_data = transcript.fetch()

        # Format segments
        segments = [
            {"start": entry["start"], "text": entry["text"]}
            for entry in transcript_data
        ]

        # Combine all text
        full_text = " ".join(entry["text"] for entry in transcript_data)

        return {
            "text": full_text,
            "segments": segments,
        }

    except VideoUnavailable:
        raise TranscriptError(
            f"Video not found or unavailable: {video_id}. "
            "Check that the URL is correct and the video is publicly accessible."
        )
    except TranscriptsDisabled:
        raise TranscriptError(
            f"Captions are disabled for video {video_id}. "
            "Try a different video or paste transcript manually."
        )
    except NoTranscriptFound:
        raise TranscriptError(
            f"No captions found for video {video_id}. "
            "Try a different video or paste transcript manually."
        )
    except Exception as e:
        # Catch any other unexpected errors
        raise TranscriptError(
            f"Failed to fetch transcript for video {video_id}: {str(e)}"
        )


async def extract_podcast_takes(transcript: dict, count: int = 5) -> list[dict]:
    """
    Extract interesting claims from a podcast transcript using LLM analysis.

    Uses Gemini 2.5 Flash to identify the most compelling takes from a transcript,
    preserving speaker voice and including timestamps. Includes post-extraction
    quality filter (only returns takes with quality_score >= 70).

    Args:
        transcript: dict with structure:
            {
                "text": str,  # Full transcript text
                "segments": [  # List of timestamped segments
                    {"start": float, "text": str},
                    ...
                ]
            }
        count: Number of takes to extract (default: 5)

    Returns:
        List of dicts with structure:
        [
            {
                "claim": str,  # Exact quote from speaker
                "speaker": str,  # Speaker name
                "start": float,  # Start timestamp in seconds
                "end": float,  # End timestamp in seconds
                "quality_score": int  # Quality score 0-100
            },
            ...
        ]

    Raises:
        ValueError: If transcript format is invalid or LLM response cannot be parsed
    """
    # Import here to avoid circular dependency
    from pipeline import _call
    from prompts import get_prompt

    # Validate transcript structure
    if not isinstance(transcript, dict):
        raise ValueError("Transcript must be a dictionary")
    if "text" not in transcript or "segments" not in transcript:
        raise ValueError("Transcript must contain 'text' and 'segments' keys")
    if not transcript["segments"]:
        raise ValueError("Transcript segments cannot be empty")

    # Truncate transcript if too long (safety measure for 1M token context)
    # 100K chars ~= 25K tokens, well within limits
    transcript_text = transcript["text"][:100000]

    # Format segments for the LLM
    segments_formatted = []
    for seg in transcript["segments"]:
        segments_formatted.append(f"[{seg['start']:.1f}s] {seg['text']}")
    segments_text = "\n".join(segments_formatted[:1000])  # Cap at 1000 segments

    prompt_config = get_prompt("extract_podcast_takes")
    user_prompt = f"""Extract the {count} most interesting claims from this podcast transcript.

Full transcript text:
{transcript_text}

Timestamped segments:
{segments_text}

Return a JSON array of the top {count} claims, each with: claim, speaker, start, end, quality_score.
Only include claims with quality_score >= 70."""

    try:
        # Call LLM with retry logic built into _call
        response = await _call(
            system=prompt_config["system"],
            user=user_prompt,
            max_tokens=prompt_config["max_tokens"],
            retries=5,
            use_search=False
        )

        # Handle tuple response (Gemini with sources)
        if isinstance(response, tuple):
            response = response[0]

        # Clean and parse JSON
        response = response.strip()
        # Remove markdown code fences if present
        if response.startswith("```"):
            response = re.sub(r'^```(?:json)?\s*', '', response)
            response = re.sub(r'\s*```$', '', response)

        # Parse JSON
        takes = json.loads(response)

        # Validate response structure
        if not isinstance(takes, list):
            raise ValueError("LLM response must be a JSON array")

        # Filter and validate each take
        filtered_takes = []
        for take in takes:
            # Validate required fields
            if not isinstance(take, dict):
                continue
            required_fields = ["claim", "speaker", "start", "end", "quality_score"]
            if not all(field in take for field in required_fields):
                continue

            # Validate field types
            if not isinstance(take["claim"], str) or not take["claim"].strip():
                continue
            if not isinstance(take["speaker"], str) or not take["speaker"].strip():
                continue
            if not isinstance(take["quality_score"], (int, float)):
                continue
            if not isinstance(take["start"], (int, float)):
                continue
            if not isinstance(take["end"], (int, float)):
                continue

            # Apply quality filter (>= 70)
            if take["quality_score"] < 70:
                continue

            # Ensure timestamps are valid
            if take["start"] < 0 or take["end"] < 0 or take["end"] <= take["start"]:
                continue

            # Normalize types
            filtered_takes.append({
                "claim": take["claim"].strip(),
                "speaker": take["speaker"].strip(),
                "start": float(take["start"]),
                "end": float(take["end"]),
                "quality_score": int(take["quality_score"])
            })

        return filtered_takes

    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse LLM response as JSON: {e}")
    except Exception as e:
        # Re-raise with more context
        raise ValueError(f"Failed to extract podcast takes: {str(e)}")
