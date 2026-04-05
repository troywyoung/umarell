"""Tests for transcript_service.py"""

import pytest
from unittest.mock import patch, MagicMock
from transcript_service import (
    fetch_youtube_transcript,
    TranscriptError,
    _extract_video_id,
)
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)


class TestExtractVideoId:
    """Test video ID extraction from various URL formats."""

    def test_standard_youtube_url(self):
        """Test standard youtube.com/watch?v= format."""
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert _extract_video_id(url) == "dQw4w9WgXcQ"

    def test_short_youtube_url(self):
        """Test youtu.be short URL format."""
        url = "https://youtu.be/dQw4w9WgXcQ"
        assert _extract_video_id(url) == "dQw4w9WgXcQ"

    def test_youtube_without_www(self):
        """Test youtube.com without www."""
        url = "https://youtube.com/watch?v=dQw4w9WgXcQ"
        assert _extract_video_id(url) == "dQw4w9WgXcQ"

    def test_mobile_youtube_url(self):
        """Test mobile youtube URL format."""
        url = "https://m.youtube.com/watch?v=dQw4w9WgXcQ"
        assert _extract_video_id(url) == "dQw4w9WgXcQ"

    def test_youtube_with_additional_params(self):
        """Test URL with additional query parameters."""
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s"
        assert _extract_video_id(url) == "dQw4w9WgXcQ"

    def test_youtube_embed_url(self):
        """Test embed URL format."""
        url = "https://www.youtube.com/embed/dQw4w9WgXcQ"
        assert _extract_video_id(url) == "dQw4w9WgXcQ"

    def test_invalid_url(self):
        """Test that invalid URLs return None."""
        assert _extract_video_id("https://example.com") is None
        assert _extract_video_id("not a url") is None
        assert _extract_video_id("") is None


class TestFetchYoutubeTranscript:
    """Test YouTube transcript fetching."""

    def test_invalid_url_format(self):
        """Test error handling for invalid URL format."""
        with pytest.raises(TranscriptError) as exc_info:
            fetch_youtube_transcript("https://example.com/video")

        assert "Invalid YouTube URL format" in str(exc_info.value)
        assert "Expected format" in str(exc_info.value)

    @patch("transcript_service.YouTubeTranscriptApi.list_transcripts")
    def test_video_not_found(self, mock_list_transcripts):
        """Test error handling when video is unavailable."""
        mock_list_transcripts.side_effect = VideoUnavailable("video_id")

        with pytest.raises(TranscriptError) as exc_info:
            fetch_youtube_transcript("https://youtube.com/watch?v=invalidVID1")

        assert "Video not found or unavailable" in str(exc_info.value)
        assert "publicly accessible" in str(exc_info.value)

    @patch("transcript_service.YouTubeTranscriptApi.list_transcripts")
    def test_transcripts_disabled(self, mock_list_transcripts):
        """Test error handling when transcripts are disabled."""
        mock_list_transcripts.side_effect = TranscriptsDisabled("video_id")

        with pytest.raises(TranscriptError) as exc_info:
            fetch_youtube_transcript("https://youtube.com/watch?v=abc12345678")

        assert "Captions are disabled" in str(exc_info.value)
        assert "Try a different video" in str(exc_info.value)

    @patch("transcript_service.YouTubeTranscriptApi.list_transcripts")
    def test_no_transcript_found(self, mock_list_transcripts):
        """Test error handling when no transcripts exist."""
        mock_transcript_list = MagicMock()
        mock_transcript_list.find_manually_created_transcript.side_effect = NoTranscriptFound(
            "video_id", [], {}
        )
        mock_transcript_list.find_generated_transcript.side_effect = NoTranscriptFound(
            "video_id", [], {}
        )
        mock_transcript_list._manually_created_transcripts = {}
        mock_transcript_list._generated_transcripts = {}
        mock_list_transcripts.return_value = mock_transcript_list

        with pytest.raises(TranscriptError) as exc_info:
            fetch_youtube_transcript("https://youtube.com/watch?v=abc12345678")

        assert "No captions found" in str(exc_info.value)
        assert "paste transcript manually" in str(exc_info.value)

    @patch("transcript_service.YouTubeTranscriptApi.list_transcripts")
    def test_manual_transcript_success(self, mock_list_transcripts):
        """Test successful fetch of manual transcript."""
        # Mock transcript data
        mock_transcript = MagicMock()
        mock_transcript.fetch.return_value = [
            {"start": 0.0, "text": "Hello world"},
            {"start": 2.5, "text": "This is a test"},
            {"start": 5.0, "text": "End of transcript"},
        ]

        mock_transcript_list = MagicMock()
        mock_transcript_list.find_manually_created_transcript.return_value = mock_transcript
        mock_list_transcripts.return_value = mock_transcript_list

        result = fetch_youtube_transcript("https://youtube.com/watch?v=abc12345678")

        assert "text" in result
        assert "segments" in result
        assert result["text"] == "Hello world This is a test End of transcript"
        assert len(result["segments"]) == 3
        assert result["segments"][0] == {"start": 0.0, "text": "Hello world"}
        assert result["segments"][1] == {"start": 2.5, "text": "This is a test"}
        assert result["segments"][2] == {"start": 5.0, "text": "End of transcript"}

    @patch("transcript_service.YouTubeTranscriptApi.list_transcripts")
    def test_auto_generated_transcript_success(self, mock_list_transcripts):
        """Test successful fetch of auto-generated transcript."""
        # Mock transcript data
        mock_transcript = MagicMock()
        mock_transcript.fetch.return_value = [
            {"start": 0.0, "text": "Auto generated text"},
            {"start": 3.0, "text": "Second segment"},
        ]

        mock_transcript_list = MagicMock()
        mock_transcript_list.find_manually_created_transcript.side_effect = NoTranscriptFound(
            "video_id", [], {}
        )
        mock_transcript_list.find_generated_transcript.return_value = mock_transcript
        mock_list_transcripts.return_value = mock_transcript_list

        result = fetch_youtube_transcript("https://youtube.com/watch?v=abc12345678")

        assert result["text"] == "Auto generated text Second segment"
        assert len(result["segments"]) == 2

    @patch("transcript_service.YouTubeTranscriptApi.list_transcripts")
    def test_fallback_to_any_language(self, mock_list_transcripts):
        """Test fallback to any available transcript when English not available."""
        # Mock transcript data
        mock_transcript = MagicMock()
        mock_transcript.fetch.return_value = [
            {"start": 0.0, "text": "Non-English text"},
        ]

        mock_transcript_list = MagicMock()
        mock_transcript_list.find_manually_created_transcript.side_effect = NoTranscriptFound(
            "video_id", [], {}
        )
        mock_transcript_list.find_generated_transcript.side_effect = NoTranscriptFound(
            "video_id", [], {}
        )
        mock_transcript_list._manually_created_transcripts = {"es": mock_transcript}
        mock_transcript_list._generated_transcripts = {}
        mock_list_transcripts.return_value = mock_transcript_list

        result = fetch_youtube_transcript("https://youtube.com/watch?v=abc12345678")

        assert result["text"] == "Non-English text"
        assert len(result["segments"]) == 1

    @patch("transcript_service.YouTubeTranscriptApi.list_transcripts")
    def test_unexpected_error(self, mock_list_transcripts):
        """Test handling of unexpected errors."""
        mock_list_transcripts.side_effect = Exception("Unexpected API error")

        with pytest.raises(TranscriptError) as exc_info:
            fetch_youtube_transcript("https://youtube.com/watch?v=abc12345678")

        assert "Failed to fetch transcript" in str(exc_info.value)
        assert "Unexpected API error" in str(exc_info.value)


class TestIntegration:
    """Integration tests with real YouTube videos (requires network)."""

    @pytest.mark.skip(reason="Integration test requires network and specific video availability")
    def test_real_youtube_video(self):
        """
        Test with a real YouTube video.

        This test requires network access and may be flaky if the video
        becomes unavailable or captions are disabled.
        To run: pytest -k test_real_youtube_video --runxfail
        """
        # Using a well-known TED talk video with captions
        # "The power of vulnerability" by Brené Brown
        url = "https://www.youtube.com/watch?v=iCvmsMzlF7o"

        result = fetch_youtube_transcript(url)

        assert "text" in result
        assert "segments" in result
        assert len(result["text"]) > 0
        assert len(result["segments"]) > 0
        assert all("start" in seg and "text" in seg for seg in result["segments"])
