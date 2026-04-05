"""YouTube transcript fetching service."""

import re
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
