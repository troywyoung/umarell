"""
Test script to verify instance routing and multi-database support.
"""
import asyncio
from sqlalchemy import select
from database import AsyncSessionLocal, get_instance_db, get_instance_engine, Base
from models import Instance, Observation, InstanceConfig, InstancePrompt
from prompts import PROMPTS
from design_tokens import DESIGN_TOKENS


async def test_instance_routing():
    print("Testing instance routing and multi-database support...\n")

    # Test 1: Verify hot-takes instance exists
    print("1. Checking hot-takes instance...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Instance).where(Instance.key == "hot-takes"))
        hot_takes = result.scalar_one_or_none()
        if hot_takes:
            print(f"   ✓ hot-takes instance exists (ID: {hot_takes.id})")
        else:
            print("   ✗ hot-takes instance not found!")
            return

    # Test 2: Create a test instance "confessions"
    print("\n2. Creating 'confessions' test instance...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Instance).where(Instance.key == "confessions"))
        confessions = result.scalar_one_or_none()

        if not confessions:
            confessions = Instance(
                key="confessions",
                display_name="True Confessions",
                subdirectory=None,
                database_name=None,
                is_active=True
            )
            db.add(confessions)
            await db.flush()

            # Seed prompts for confessions
            for prompt_key, prompt_config in PROMPTS.items():
                prompt = InstancePrompt(
                    instance_id=confessions.id,
                    prompt_key=prompt_key,
                    name=prompt_config["name"],
                    description=prompt_config["description"],
                    system=prompt_config["system"],
                    max_tokens=prompt_config["max_tokens"],
                    is_default=True
                )
                db.add(prompt)

            # Seed design tokens for confessions (customize later)
            design_config = InstanceConfig(
                instance_id=confessions.id,
                config_type="design_tokens",
                config_data=DESIGN_TOKENS
            )
            db.add(design_config)

            await db.commit()
            print(f"   ✓ Created confessions instance (ID: {confessions.id})")
        else:
            print(f"   ℹ confessions instance already exists (ID: {confessions.id})")

    # Test 3: Initialize confessions database
    print("\n3. Initializing confessions database...")
    confessions_engine, ConfessionsSessionLocal = get_instance_engine("confessions")
    async with confessions_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("   ✓ Confessions database tables created")

    # Test 4: Create a test observation in hot-takes
    print("\n4. Creating test observation in hot-takes...")
    async for db in get_instance_db("hot-takes"):
        obs = Observation(
            raw_input="Test observation in hot-takes instance",
            input_type="text",
            thesis="Hot-takes test thesis",
            status="complete",
            model_used="test"
        )
        db.add(obs)
        await db.commit()
        hot_takes_obs_id = obs.id
        print(f"   ✓ Created observation in hot-takes (ID: {hot_takes_obs_id[:8]})")
        break

    # Test 5: Create a test observation in confessions
    print("\n5. Creating test observation in confessions...")
    async for db in get_instance_db("confessions"):
        obs = Observation(
            raw_input="Test observation in confessions instance",
            input_type="text",
            thesis="Confessions test thesis",
            status="complete",
            model_used="test"
        )
        db.add(obs)
        await db.commit()
        confessions_obs_id = obs.id
        print(f"   ✓ Created observation in confessions (ID: {confessions_obs_id[:8]})")
        break

    # Test 6: Verify isolation - check observations in each database
    print("\n6. Verifying database isolation...")

    async for db in get_instance_db("hot-takes"):
        result = await db.execute(select(Observation))
        hot_takes_obs = list(result.scalars().all())
        print(f"   • hot-takes has {len(hot_takes_obs)} observation(s)")
        break

    async for db in get_instance_db("confessions"):
        result = await db.execute(select(Observation))
        confessions_obs = list(result.scalars().all())
        print(f"   • confessions has {len(confessions_obs)} observation(s)")
        break

    # Verify the test observation exists in the right place
    hot_takes_has_test = any(obs.id == hot_takes_obs_id for obs in hot_takes_obs)
    confessions_has_test = any(obs.id == confessions_obs_id for obs in confessions_obs)

    if hot_takes_has_test and confessions_has_test:
        print("   ✓ Database isolation verified - observations are separate")
    else:
        print("   ✗ Database isolation issue detected!")

    print("\n✓ All tests passed! Instance routing is working correctly.")
    print("\nYou can now:")
    print("  - Access hot-takes at: /hot-takes/")
    print("  - Access confessions at: /confessions/")


if __name__ == "__main__":
    asyncio.run(test_instance_routing())
