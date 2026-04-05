"""Tests for instance configuration persistence."""

import pytest
from sqlalchemy import select
from database import AsyncSessionLocal, init_db
from models import Instance, InstanceConfig, InstancePrompt
from prompts import get_prompt, get_all_prompts, update_prompt, PROMPTS
from design_tokens import get_design_tokens, update_design_token, DESIGN_TOKENS


@pytest.mark.asyncio
async def test_instance_created_on_startup():
    """Test that hot-takes instance is created during initialization."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Instance).where(Instance.key == "hot-takes"))
        instance = result.scalar_one_or_none()

        assert instance is not None
        assert instance.key == "hot-takes"
        assert instance.display_name == "Hot Takes"
        assert instance.is_active is True


@pytest.mark.asyncio
async def test_prompts_seeded_on_startup():
    """Test that prompts are seeded to database on startup."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Instance).where(Instance.key == "hot-takes"))
        instance = result.scalar_one_or_none()

        result = await db.execute(
            select(InstancePrompt).where(InstancePrompt.instance_id == instance.id)
        )
        prompts = result.scalars().all()

        # Should have all default prompts
        assert len(prompts) >= len(PROMPTS)

        # Check one specific prompt
        format_thesis = next(p for p in prompts if p.prompt_key == "format_thesis")
        assert format_thesis.name == PROMPTS["format_thesis"]["name"]
        assert format_thesis.system == PROMPTS["format_thesis"]["system"]


@pytest.mark.asyncio
async def test_design_tokens_seeded_on_startup():
    """Test that design tokens are seeded to database on startup."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Instance).where(Instance.key == "hot-takes"))
        instance = result.scalar_one_or_none()

        result = await db.execute(
            select(InstanceConfig)
            .where(InstanceConfig.instance_id == instance.id)
            .where(InstanceConfig.config_type == "design_tokens")
        )
        config = result.scalar_one_or_none()

        assert config is not None
        assert config.config_data == DESIGN_TOKENS


@pytest.mark.asyncio
async def test_get_prompt_from_database():
    """Test that get_prompt loads from database."""
    prompt = await get_prompt("format_thesis")

    assert prompt is not None
    assert "name" in prompt
    assert "system" in prompt
    assert "max_tokens" in prompt


@pytest.mark.asyncio
async def test_update_prompt_persists():
    """Test that prompt updates are persisted to database."""
    original = await get_prompt("format_thesis")

    # Update prompt
    success = await update_prompt("format_thesis", {"system": "TEST SYSTEM PROMPT"})
    assert success is True

    # Verify update persisted
    updated = await get_prompt("format_thesis")
    assert updated["system"] == "TEST SYSTEM PROMPT"

    # Restore original
    await update_prompt("format_thesis", {"system": original["system"]})


@pytest.mark.asyncio
async def test_get_design_tokens_from_database():
    """Test that get_design_tokens loads from database."""
    tokens = await get_design_tokens()

    assert tokens is not None
    assert "colors" in tokens
    assert "typography" in tokens


@pytest.mark.asyncio
async def test_update_design_token_persists():
    """Test that design token updates are persisted to database."""
    original = await get_design_tokens()
    original_accent = original["colors"]["primary"]["accent"]

    # Update token
    success = await update_design_token(["colors", "primary", "accent"], "#FF0000")
    assert success is True

    # Verify update persisted
    updated = await get_design_tokens()
    assert updated["colors"]["primary"]["accent"] == "#FF0000"

    # Restore original
    await update_design_token(["colors", "primary", "accent"], original_accent)


@pytest.mark.asyncio
async def test_config_survives_new_session():
    """Test that configuration persists across database sessions."""
    # Update prompt in one session
    await update_prompt("format_thesis", {"max_tokens": 9999})

    # Create new session and verify it persisted
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Instance).where(Instance.key == "hot-takes"))
        instance = result.scalar_one_or_none()

        result = await db.execute(
            select(InstancePrompt)
            .where(InstancePrompt.instance_id == instance.id)
            .where(InstancePrompt.prompt_key == "format_thesis")
        )
        prompt = result.scalar_one_or_none()

        assert prompt is not None
        assert prompt.max_tokens == 9999

    # Restore original
    await update_prompt("format_thesis", {"max_tokens": PROMPTS["format_thesis"]["max_tokens"]})
