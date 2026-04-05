"""Tests for transcript_service.py"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from transcript_service import (
    fetch_youtube_transcript,
    TranscriptError,
    _extract_video_id,
    extract_podcast_takes,
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


class TestExtractPodcastTakes:
    """Test podcast take extraction."""

    @pytest.fixture
    def sample_transcript(self):
        """Sample transcript for testing."""
        return {
            "text": "Speaker 1: I think AI will replace most knowledge workers within 5 years. Speaker 2: That's a bold claim. Do you have data to support that?",
            "segments": [
                {"start": 0.0, "text": "Speaker 1: I think AI will replace most knowledge workers within 5 years."},
                {"start": 5.0, "text": "Speaker 2: That's a bold claim. Do you have data to support that?"},
            ]
        }

    @pytest.mark.asyncio
    @patch("pipeline._call")
    async def test_extract_valid_takes(self, mock_call, sample_transcript):
        """Test successful extraction with valid takes."""
        # Mock LLM response with 5 valid takes (all above threshold)
        mock_response = """[
            {
                "claim": "I think AI will replace most knowledge workers within 5 years",
                "speaker": "Speaker 1",
                "start": 0.0,
                "end": 5.0,
                "quality_score": 85
            },
            {
                "claim": "The media industry is fundamentally broken",
                "speaker": "Speaker 2",
                "start": 10.0,
                "end": 15.0,
                "quality_score": 78
            },
            {
                "claim": "Newsletter economics only work at scale",
                "speaker": "Speaker 1",
                "start": 20.0,
                "end": 25.0,
                "quality_score": 72
            }
        ]"""
        mock_call.return_value = mock_response

        result = await extract_podcast_takes(sample_transcript, count=5)

        assert len(result) == 3
        assert all(isinstance(take, dict) for take in result)
        assert all("claim" in take for take in result)
        assert all("speaker" in take for take in result)
        assert all("start" in take for take in result)
        assert all("end" in take for take in result)
        assert all("quality_score" in take for take in result)
        assert all(take["quality_score"] >= 70 for take in result)
        assert result[0]["claim"] == "I think AI will replace most knowledge workers within 5 years"
        assert result[0]["speaker"] == "Speaker 1"
        assert result[0]["quality_score"] == 85

    @pytest.mark.asyncio
    @patch("pipeline._call")
    async def test_quality_filter(self, mock_call, sample_transcript):
        """Test that quality filter only returns takes >= 70."""
        # Mock LLM response with mixed quality scores
        mock_response = """[
            {
                "claim": "High quality claim",
                "speaker": "Speaker 1",
                "start": 0.0,
                "end": 5.0,
                "quality_score": 90
            },
            {
                "claim": "Low quality claim",
                "speaker": "Speaker 2",
                "start": 5.0,
                "end": 10.0,
                "quality_score": 50
            },
            {
                "claim": "Borderline claim",
                "speaker": "Speaker 1",
                "start": 10.0,
                "end": 15.0,
                "quality_score": 69
            },
            {
                "claim": "Exactly threshold",
                "speaker": "Speaker 2",
                "start": 15.0,
                "end": 20.0,
                "quality_score": 70
            }
        ]"""
        mock_call.return_value = mock_response

        result = await extract_podcast_takes(sample_transcript, count=5)

        # Should only return takes with quality_score >= 70
        assert len(result) == 2
        assert result[0]["quality_score"] == 90
        assert result[1]["quality_score"] == 70
        assert all(take["quality_score"] >= 70 for take in result)

    @pytest.mark.asyncio
    @patch("pipeline._call")
    async def test_empty_response(self, mock_call, sample_transcript):
        """Test handling of empty LLM response."""
        mock_call.return_value = "[]"

        result = await extract_podcast_takes(sample_transcript, count=5)

        assert result == []

    @pytest.mark.asyncio
    @patch("pipeline._call")
    async def test_malformed_json(self, mock_call, sample_transcript):
        """Test error handling for malformed JSON."""
        mock_call.return_value = "{ invalid json }"

        with pytest.raises(ValueError) as exc_info:
            await extract_podcast_takes(sample_transcript, count=5)

        assert "Failed to parse LLM response as JSON" in str(exc_info.value)

    @pytest.mark.asyncio
    @patch("pipeline._call")
    async def test_json_with_markdown_fences(self, mock_call, sample_transcript):
        """Test JSON extraction from markdown fences."""
        mock_response = """```json
        [
            {
                "claim": "Test claim",
                "speaker": "Speaker 1",
                "start": 0.0,
                "end": 5.0,
                "quality_score": 85
            }
        ]
        ```"""
        mock_call.return_value = mock_response

        result = await extract_podcast_takes(sample_transcript, count=5)

        assert len(result) == 1
        assert result[0]["claim"] == "Test claim"

    @pytest.mark.asyncio
    @patch("pipeline._call")
    async def test_missing_fields(self, mock_call, sample_transcript):
        """Test filtering of takes with missing required fields."""
        mock_response = """[
            {
                "claim": "Valid claim",
                "speaker": "Speaker 1",
                "start": 0.0,
                "end": 5.0,
                "quality_score": 85
            },
            {
                "claim": "Missing speaker",
                "start": 5.0,
                "end": 10.0,
                "quality_score": 80
            },
            {
                "speaker": "Speaker 2",
                "start": 10.0,
                "end": 15.0,
                "quality_score": 75
            }
        ]"""
        mock_call.return_value = mock_response

        result = await extract_podcast_takes(sample_transcript, count=5)

        # Only the first take should be included (has all required fields)
        assert len(result) == 1
        assert result[0]["claim"] == "Valid claim"

    @pytest.mark.asyncio
    @patch("pipeline._call")
    async def test_invalid_timestamps(self, mock_call, sample_transcript):
        """Test filtering of takes with invalid timestamps."""
        mock_response = """[
            {
                "claim": "Valid timestamps",
                "speaker": "Speaker 1",
                "start": 0.0,
                "end": 5.0,
                "quality_score": 85
            },
            {
                "claim": "Negative start",
                "speaker": "Speaker 2",
                "start": -1.0,
                "end": 5.0,
                "quality_score": 80
            },
            {
                "claim": "End before start",
                "speaker": "Speaker 1",
                "start": 10.0,
                "end": 5.0,
                "quality_score": 75
            },
            {
                "claim": "Equal timestamps",
                "speaker": "Speaker 2",
                "start": 10.0,
                "end": 10.0,
                "quality_score": 72
            }
        ]"""
        mock_call.return_value = mock_response

        result = await extract_podcast_takes(sample_transcript, count=5)

        # Only the first take should be included (valid timestamps)
        assert len(result) == 1
        assert result[0]["claim"] == "Valid timestamps"

    @pytest.mark.asyncio
    async def test_invalid_transcript_format(self):
        """Test error handling for invalid transcript format."""
        # Test with non-dict
        with pytest.raises(ValueError) as exc_info:
            await extract_podcast_takes("not a dict", count=5)
        assert "Transcript must be a dictionary" in str(exc_info.value)

        # Test with missing keys
        with pytest.raises(ValueError) as exc_info:
            await extract_podcast_takes({"text": "some text"}, count=5)
        assert "must contain 'text' and 'segments' keys" in str(exc_info.value)

        # Test with empty segments
        with pytest.raises(ValueError) as exc_info:
            await extract_podcast_takes({"text": "some text", "segments": []}, count=5)
        assert "segments cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    @patch("pipeline._call")
    async def test_tuple_response_handling(self, mock_call, sample_transcript):
        """Test handling of tuple response from Gemini (with sources)."""
        mock_response = (
            """[
                {
                    "claim": "Test claim",
                    "speaker": "Speaker 1",
                    "start": 0.0,
                    "end": 5.0,
                    "quality_score": 85
                }
            ]""",
            [{"url": "https://example.com", "title": "Example"}]
        )
        mock_call.return_value = mock_response

        result = await extract_podcast_takes(sample_transcript, count=5)

        assert len(result) == 1
        assert result[0]["claim"] == "Test claim"

    @pytest.mark.asyncio
    @patch("pipeline._call")
    async def test_type_normalization(self, mock_call, sample_transcript):
        """Test that types are properly normalized in output."""
        mock_response = """[
            {
                "claim": "Test claim",
                "speaker": "Speaker 1",
                "start": 0,
                "end": 5,
                "quality_score": 85.5
            }
        ]"""
        mock_call.return_value = mock_response

        result = await extract_podcast_takes(sample_transcript, count=5)

        assert len(result) == 1
        assert isinstance(result[0]["start"], float)
        assert isinstance(result[0]["end"], float)
        assert isinstance(result[0]["quality_score"], int)
        assert result[0]["start"] == 0.0
        assert result[0]["end"] == 5.0
        assert result[0]["quality_score"] == 85

    @pytest.mark.asyncio
    @patch("pipeline._call")
    async def test_whitespace_trimming(self, mock_call, sample_transcript):
        """Test that claim and speaker strings are trimmed."""
        mock_response = """[
            {
                "claim": "  Test claim with spaces  ",
                "speaker": "  Speaker 1  ",
                "start": 0.0,
                "end": 5.0,
                "quality_score": 85
            }
        ]"""
        mock_call.return_value = mock_response

        result = await extract_podcast_takes(sample_transcript, count=5)

        assert len(result) == 1
        assert result[0]["claim"] == "Test claim with spaces"
        assert result[0]["speaker"] == "Speaker 1"

    @pytest.mark.asyncio
    @patch("pipeline._call")
    async def test_long_transcript_truncation(self, mock_call):
        """Test that very long transcripts are truncated."""
        # Create a transcript longer than 100K chars
        long_text = "A" * 150000
        long_transcript = {
            "text": long_text,
            "segments": [
                {"start": 0.0, "text": "Test segment"}
            ]
        }

        mock_call.return_value = "[]"

        result = await extract_podcast_takes(long_transcript, count=5)

        # Verify the call was made (transcript was truncated, not rejected)
        assert mock_call.called
        call_args = mock_call.call_args
        user_prompt = call_args[1]["user"]
        # Verify truncation happened (100K chars + formatting)
        assert len(user_prompt) < 150000
