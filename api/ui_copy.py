"""
UI copy for Umarell frontend.

All user-facing text, labels, and placeholder prompts are defined here.
Copy can be modified via the admin interface and is persisted to the database.

Default copy is defined in UI_COPY dict. Runtime copy is loaded from database.
"""

from sqlalchemy import select
from database import AsyncSessionLocal

UI_COPY = {
    "page_title": "Hot Take",
    "placeholder_prompts": [
        # Dares
        "What hill are you dying on?",
        "Drop your hottest take…",
        "Say something controversial…",
        "What's everyone getting wrong?",
        "Convince me…",
        "What do you believe that nobody agrees with?",
        "Defend the indefensible…",
        "What's obvious to you but invisible to others?",
        # Example theses
        "e.g. AI will replace 50% of white collar jobs by 2030",
        "e.g. Remote work makes teams worse at innovation",
        "e.g. TikTok is the new Google for Gen Z",
        "e.g. The housing market is about to crash",
        "e.g. Most startups would be better off with no VC money",
        "e.g. College degrees will be worthless in 10 years",
        "e.g. China will overtake the US economy by 2035",
        "e.g. Social media is a net negative for society",
    ],
    "response_placeholders": [
        "Agree? Destroy it.",
        "Wrong. Here's why…",
        "This is more complicated than it looks.",
        "You're missing the point.",
        "Actually, this is exactly right.",
        "Hot take on the hot take…",
        "The real story is…",
        "I've been thinking about this and…",
        "Everyone's wrong about this.",
        "This is the take nobody wants to hear.",
        "Here's what the data actually says…",
        "The thing that makes this interesting…",
        "Counterpoint:",
        "This ages badly because…",
        "Strong disagree, and here's the receipts.",
    ],
    "labels": {
        "hot_take_badge": "Hot Take",
        "empty_state": "Hot Take is getting hotter.\nCome back later.",
        "say_your_take": "Say your take…",
        "add_link_optional": "Add a link (optional)",
        "listening": "Listening…"
    }
}


async def get_ui_copy(instance_key: str = "hot-takes") -> dict:
    """Get all UI copy.

    Loads from database for the given instance, falls back to UI_COPY default.
    """
    async with AsyncSessionLocal() as db:
        from models import Instance, InstanceConfig

        # Get instance
        result = await db.execute(select(Instance).where(Instance.key == instance_key))
        instance = result.scalar_one_or_none()

        if instance:
            # Try to load from database
            result = await db.execute(
                select(InstanceConfig)
                .where(InstanceConfig.instance_id == instance.id)
                .where(InstanceConfig.config_type == "ui_copy")
            )
            config = result.scalar_one_or_none()

            if config and config.config_data:
                return config.config_data

    # Fallback to module defaults
    return UI_COPY


async def update_ui_copy(path: list[str], value: str | list, instance_key: str = "hot-takes") -> bool:
    """Update a UI copy value in the database.

    Args:
        path: Path to the copy item (e.g., ['page_title'] or ['labels', 'hot_take_badge'])
        value: New value for the copy item (string or list)
        instance_key: Instance identifier

    Returns:
        True if updated successfully
    """
    async with AsyncSessionLocal() as db:
        from models import Instance, InstanceConfig

        # Get instance
        result = await db.execute(select(Instance).where(Instance.key == instance_key))
        instance = result.scalar_one_or_none()

        if not instance:
            return False

        # Get or create config
        result = await db.execute(
            select(InstanceConfig)
            .where(InstanceConfig.instance_id == instance.id)
            .where(InstanceConfig.config_type == "ui_copy")
        )
        config = result.scalar_one_or_none()

        if not config:
            config = InstanceConfig(
                instance_id=instance.id,
                config_type="ui_copy",
                config_data=UI_COPY.copy()
            )
            db.add(config)

        # Navigate to the item and update it
        current = config.config_data
        for key in path[:-1]:
            if key not in current:
                return False
            current = current[key]

        if path[-1] not in current:
            return False

        current[path[-1]] = value

        # Mark as modified to trigger update
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(config, "config_data")

        await db.commit()
        return True
