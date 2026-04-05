"""Tests for POST /podcasts/ingest endpoint"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock, ANY
import os

# Set required env vars before importing main
os.environ.setdefault("GOOGLE_API_KEY", "test-key-for-tests")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from starlette.testclient import TestClient
from main import app
from transcript_service import TranscriptError


@pytest.fixture
def sample_transcript():
    """Sample transcript fixture."""
    return {
        "text": "Speaker 1: AI will replace most knowledge workers within 5 years. Speaker 2: That's bold.",
        "segments": [
            {"start": 0.0, "text": "Speaker 1: AI will replace most knowledge workers within 5 years."},
            {"start": 5.0, "text": "Speaker 2: That's bold."},
        ]
    }


@pytest.fixture
def sample_takes():
    """Sample extracted takes fixture."""
    return [
        {
            "claim": "AI will replace most knowledge workers within 5 years",
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
    ]


class TestPodcastIngest:
    """Test podcast ingestion endpoint."""

    def test_missing_auth(self):
        """Test that endpoint requires authentication."""
        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://youtube.com/watch?v=test123",
                    "episode_title": "Test Episode"
                }
            )
            assert response.status_code == 401
            assert "Not authenticated" in response.json()["detail"]

    def test_invalid_admin_key(self):
        """Test that wrong admin key is rejected."""
        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://youtube.com/watch?v=test123",
                    "episode_title": "Test Episode",
                    "admin_key": "wrong-key"
                }
            )
            assert response.status_code == 403
            assert "Invalid admin key" in response.json()["detail"]

    @patch("transcript_service.fetch_youtube_transcript")
    def test_invalid_youtube_url(self, mock_fetch):
        """Test error handling for invalid YouTube URL."""
        mock_fetch.side_effect = TranscriptError("Invalid YouTube URL format")

        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://example.com/not-youtube",
                    "episode_title": "Test Episode",
                    "admin_key": "test-key-for-tests"
                }
            )
            assert response.status_code == 400
            assert "Invalid YouTube URL format" in response.json()["detail"]

    @patch("transcript_service.fetch_youtube_transcript")
    def test_no_captions_available(self, mock_fetch):
        """Test error handling when video has no captions."""
        mock_fetch.side_effect = TranscriptError("No captions found for video")

        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://youtube.com/watch?v=nocaptions1",
                    "episode_title": "Test Episode",
                    "admin_key": "test-key-for-tests"
                }
            )
            assert response.status_code == 400
            assert "No captions found" in response.json()["detail"]

    @patch("transcript_service.extract_podcast_takes")
    @patch("transcript_service.fetch_youtube_transcript")
    def test_extraction_failure(self, mock_fetch, mock_extract, sample_transcript):
        """Test error handling when take extraction fails."""
        mock_fetch.return_value = sample_transcript
        mock_extract.side_effect = ValueError("Failed to parse LLM response")

        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://youtube.com/watch?v=test123",
                    "episode_title": "Test Episode",
                    "admin_key": "test-key-for-tests"
                }
            )
            assert response.status_code == 500
            assert "Failed to extract takes" in response.json()["detail"]

    @patch("transcript_service.extract_podcast_takes")
    @patch("transcript_service.fetch_youtube_transcript")
    def test_no_quality_takes_found(self, mock_fetch, mock_extract, sample_transcript):
        """Test error when no takes meet quality threshold."""
        mock_fetch.return_value = sample_transcript
        mock_extract.return_value = []  # All takes filtered out

        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://youtube.com/watch?v=test123",
                    "episode_title": "Test Episode",
                    "admin_key": "test-key-for-tests"
                }
            )
            assert response.status_code == 400
            assert "No high-quality takes found" in response.json()["detail"]

    @patch("main.asyncio.create_task")
    @patch("transcript_service.extract_podcast_takes")
    @patch("transcript_service.fetch_youtube_transcript")
    def test_successful_ingestion_with_admin_key(
        self, mock_fetch, mock_extract, mock_create_task,
        sample_transcript, sample_takes
    ):
        """Test successful podcast ingestion with admin key auth."""
        mock_fetch.return_value = sample_transcript
        mock_extract.return_value = sample_takes
        mock_create_task.return_value = None  # Mock async task creation

        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://youtube.com/watch?v=test123",
                    "episode_title": "Test Episode",
                    "admin_key": "test-key-for-tests",
                    "count": 5
                }
            )
            assert response.status_code == 202
            data = response.json()
            assert "episode_tag" in data
            assert "observations" in data
            assert data["count"] == 3  # Number of takes returned
            assert len(data["observations"]) == 3
            assert data["episode_title"] == "Test Episode"
            assert "transcript_length" in data

    @patch("main.asyncio.create_task")
    @patch("transcript_service.extract_podcast_takes")
    @patch("transcript_service.fetch_youtube_transcript")
    def test_episode_tag_generation(
        self, mock_fetch, mock_extract, mock_create_task,
        sample_transcript, sample_takes
    ):
        """Test that episode tag is generated from title when not provided."""
        mock_fetch.return_value = sample_transcript
        mock_extract.return_value = sample_takes
        mock_create_task.return_value = None

        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://youtube.com/watch?v=test123",
                    "episode_title": "The Future of AI",
                    "admin_key": "test-key-for-tests"
                }
            )
            assert response.status_code == 202
            data = response.json()
            assert data["episode_tag"] == "the-future-of-ai"

    @patch("main.asyncio.create_task")
    @patch("transcript_service.extract_podcast_takes")
    @patch("transcript_service.fetch_youtube_transcript")
    def test_custom_episode_tag(
        self, mock_fetch, mock_extract, mock_create_task,
        sample_transcript, sample_takes
    ):
        """Test using custom episode tag instead of generated one."""
        mock_fetch.return_value = sample_transcript
        mock_extract.return_value = sample_takes
        mock_create_task.return_value = None

        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://youtube.com/watch?v=test123",
                    "episode_title": "Test Episode",
                    "episode_tag": "custom-tag-2026",
                    "admin_key": "test-key-for-tests"
                }
            )
            assert response.status_code == 202
            data = response.json()
            assert data["episode_tag"] == "custom-tag-2026"

    @patch("main.asyncio.create_task")
    @patch("transcript_service.extract_podcast_takes")
    @patch("transcript_service.fetch_youtube_transcript")
    def test_podcast_name_in_response(
        self, mock_fetch, mock_extract, mock_create_task,
        sample_transcript, sample_takes
    ):
        """Test that podcast name is included in response."""
        mock_fetch.return_value = sample_transcript
        mock_extract.return_value = sample_takes
        mock_create_task.return_value = None

        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://youtube.com/watch?v=test123",
                    "episode_title": "Test Episode",
                    "podcast_name": "People vs Algorithms",
                    "admin_key": "test-key-for-tests"
                }
            )
            assert response.status_code == 202
            data = response.json()
            assert data["podcast_name"] == "People vs Algorithms"

    @patch("main.asyncio.create_task")
    @patch("transcript_service.extract_podcast_takes")
    @patch("transcript_service.fetch_youtube_transcript")
    def test_default_podcast_name(
        self, mock_fetch, mock_extract, mock_create_task,
        sample_transcript, sample_takes
    ):
        """Test default podcast name when not provided."""
        mock_fetch.return_value = sample_transcript
        mock_extract.return_value = sample_takes
        mock_create_task.return_value = None

        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://youtube.com/watch?v=test123",
                    "episode_title": "Test Episode",
                    "admin_key": "test-key-for-tests"
                }
            )
            assert response.status_code == 202
            data = response.json()
            assert data["podcast_name"] == "Podcast"

    @patch("main.asyncio.create_task")
    @patch("transcript_service.extract_podcast_takes")
    @patch("transcript_service.fetch_youtube_transcript")
    def test_custom_count_parameter(
        self, mock_fetch, mock_extract, mock_create_task,
        sample_transcript
    ):
        """Test custom count parameter is passed to extract_podcast_takes."""
        mock_fetch.return_value = sample_transcript
        mock_extract.return_value = [
            {
                "claim": "Take 1",
                "speaker": "Speaker 1",
                "start": 0.0,
                "end": 5.0,
                "quality_score": 85
            }
        ]
        mock_create_task.return_value = None

        with TestClient(app) as client:
            response = client.post(
                "/podcasts/ingest",
                json={
                    "url": "https://youtube.com/watch?v=test123",
                    "episode_title": "Test Episode",
                    "count": 10,
                    "admin_key": "test-key-for-tests"
                }
            )
            assert response.status_code == 202
            # Verify extract_podcast_takes was called with count=10
            mock_extract.assert_called_once()
            call_args = mock_extract.call_args
            assert call_args[1]["count"] == 10
