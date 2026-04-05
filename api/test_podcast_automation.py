"""Tests for podcast automation infrastructure (webhook and PodcastFeed CRUD)."""

import pytest
import os
from datetime import datetime, timezone

# Set required env vars before importing main
os.environ.setdefault("GOOGLE_API_KEY", "test-key-for-tests")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from starlette.testclient import TestClient
from sqlalchemy import select
from main import app
from models import PodcastFeed
from database import get_instance_engine, Base


class TestPodcastFeed:
    """Test PodcastFeed CRUD operations."""

    @pytest.mark.asyncio
    async def test_podcast_feed_create(self):
        """Test creating a PodcastFeed record."""
        # Initialize database
        engine, session_maker = get_instance_engine("hot-takes")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_maker() as db:
            feed = PodcastFeed(
                url="https://example.com/feed.xml",
                name="Test Podcast",
                auto_ingest=False
            )
            db.add(feed)
            await db.commit()
            await db.refresh(feed)

            assert feed.id is not None
            assert feed.url == "https://example.com/feed.xml"
            assert feed.name == "Test Podcast"
            assert feed.auto_ingest is False
            assert feed.last_checked_at is None
            assert feed.created_at is not None

    @pytest.mark.asyncio
    async def test_podcast_feed_read(self):
        """Test reading a PodcastFeed record."""
        engine, session_maker = get_instance_engine("hot-takes")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_maker() as db:
            # Create
            feed = PodcastFeed(
                url="https://example.com/read-test.xml",
                name="Read Test Podcast",
                auto_ingest=True
            )
            db.add(feed)
            await db.commit()
            feed_id = feed.id

            # Read
            result = await db.execute(select(PodcastFeed).where(PodcastFeed.id == feed_id))
            retrieved_feed = result.scalar_one_or_none()

            assert retrieved_feed is not None
            assert retrieved_feed.url == "https://example.com/read-test.xml"
            assert retrieved_feed.name == "Read Test Podcast"
            assert retrieved_feed.auto_ingest is True

    @pytest.mark.asyncio
    async def test_podcast_feed_update(self):
        """Test updating a PodcastFeed record."""
        engine, session_maker = get_instance_engine("hot-takes")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_maker() as db:
            # Create
            feed = PodcastFeed(
                url="https://example.com/update-test.xml",
                name="Update Test Podcast",
                auto_ingest=False
            )
            db.add(feed)
            await db.commit()
            feed_id = feed.id

            # Update
            result = await db.execute(select(PodcastFeed).where(PodcastFeed.id == feed_id))
            feed = result.scalar_one()
            feed.auto_ingest = True
            feed.last_checked_at = datetime.now(timezone.utc)
            await db.commit()

            # Verify
            result = await db.execute(select(PodcastFeed).where(PodcastFeed.id == feed_id))
            updated_feed = result.scalar_one()
            assert updated_feed.auto_ingest is True
            assert updated_feed.last_checked_at is not None

    @pytest.mark.asyncio
    async def test_podcast_feed_delete(self):
        """Test deleting a PodcastFeed record."""
        engine, session_maker = get_instance_engine("hot-takes")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_maker() as db:
            # Create
            feed = PodcastFeed(
                url="https://example.com/delete-test.xml",
                name="Delete Test Podcast",
                auto_ingest=False
            )
            db.add(feed)
            await db.commit()
            feed_id = feed.id

            # Delete
            result = await db.execute(select(PodcastFeed).where(PodcastFeed.id == feed_id))
            feed = result.scalar_one()
            await db.delete(feed)
            await db.commit()

            # Verify deletion
            result = await db.execute(select(PodcastFeed).where(PodcastFeed.id == feed_id))
            deleted_feed = result.scalar_one_or_none()
            assert deleted_feed is None

    @pytest.mark.asyncio
    async def test_podcast_feed_unique_url(self):
        """Test that podcast feed URLs must be unique."""
        engine, session_maker = get_instance_engine("hot-takes")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_maker() as db:
            # Create first feed
            feed1 = PodcastFeed(
                url="https://example.com/unique-test.xml",
                name="First Podcast",
                auto_ingest=False
            )
            db.add(feed1)
            await db.commit()

            # Attempt to create duplicate
            feed2 = PodcastFeed(
                url="https://example.com/unique-test.xml",
                name="Second Podcast",
                auto_ingest=False
            )
            db.add(feed2)

            with pytest.raises(Exception):  # SQLAlchemy will raise an IntegrityError
                await db.commit()


class TestPodcastWebhook:
    """Test podcast webhook endpoint."""

    def test_webhook_returns_501(self):
        """Test that webhook endpoint returns 501 Not Implemented."""
        with TestClient(app) as client:
            response = client.post("/hot-takes/podcasts/webhook")
            assert response.status_code == 501

            data = response.json()
            assert data["status"] == "not_implemented"
            assert "manual" in data["message"].lower() or "ingest" in data["message"].lower()
            assert data["manual_endpoint"] == "/podcasts/ingest"

    def test_webhook_logs_body(self):
        """Test that webhook logs request body."""
        with TestClient(app) as client:
            test_payload = {"event": "new_episode", "podcast_id": "123"}
            response = client.post("/hot-takes/podcasts/webhook", json=test_payload)

            assert response.status_code == 501
            # The webhook should accept the request even though it's not implemented
            data = response.json()
            assert "status" in data

    def test_webhook_accepts_empty_body(self):
        """Test that webhook accepts empty request body."""
        with TestClient(app) as client:
            response = client.post("/hot-takes/podcasts/webhook")

            assert response.status_code == 501
            data = response.json()
            assert data["status"] == "not_implemented"
