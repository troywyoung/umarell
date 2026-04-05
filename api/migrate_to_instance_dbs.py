"""
Migration script to move data from main database to instance-specific databases.
Run this once to migrate existing data to the new multi-instance architecture.
"""
import asyncio
import os
import shutil
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from config import settings
from database import Base, get_instance_db_path, get_instance_engine
from models import Instance, Observation, Take, User


async def migrate():
    print("Starting migration to instance-specific databases...")

    # Connect to main database
    main_engine = create_async_engine(settings.database_url, echo=False)
    MainSessionLocal = async_sessionmaker(main_engine, class_=AsyncSession, expire_on_commit=False)

    async with MainSessionLocal() as main_db:
        # Get all active instances
        result = await main_db.execute(select(Instance).where(Instance.is_active == True))
        instances = list(result.scalars().all())

        if not instances:
            print("No instances found. Creating default 'hot-takes' instance...")
            # This shouldn't happen if lifespan ran, but just in case
            return

        print(f"Found {len(instances)} instance(s) to migrate")

        for instance in instances:
            print(f"\nMigrating instance: {instance.key}")

            # Get instance database path
            instance_db_path = get_instance_db_path(instance.key)

            # Check if we should copy from main DB
            if instance.key == "hot-takes" and os.path.exists(settings.database_url.split("///")[-1]):
                main_db_path = settings.database_url.split("///")[-1]

                # Only copy if instance DB doesn't already exist
                if not os.path.exists(instance_db_path):
                    print(f"  Copying {main_db_path} to {instance_db_path}")
                    shutil.copy2(main_db_path, instance_db_path)
                else:
                    print(f"  Instance database already exists at {instance_db_path}")
            else:
                # For new instances, create empty database
                instance_engine, _ = get_instance_engine(instance.key)
                async with instance_engine.begin() as conn:
                    print(f"  Creating tables in {instance_db_path}")
                    await conn.run_sync(Base.metadata.create_all)

            # Verify the instance database
            instance_engine, InstanceSessionLocal = get_instance_engine(instance.key)
            async with InstanceSessionLocal() as inst_db:
                # Count observations in instance DB
                result = await inst_db.execute(select(Observation))
                obs_count = len(list(result.scalars().all()))

                result = await inst_db.execute(select(User))
                user_count = len(list(result.scalars().all()))

                result = await inst_db.execute(select(Take))
                take_count = len(list(result.scalars().all()))

                print(f"  Instance DB contains: {obs_count} observations, {user_count} users, {take_count} takes")

    print("\n✓ Migration complete!")
    print("\nNext steps:")
    print("1. Verify the migration by checking the databases in the instances/ directory")
    print("2. Update the Instance record to set database_name field (optional)")


if __name__ == "__main__":
    asyncio.run(migrate())
