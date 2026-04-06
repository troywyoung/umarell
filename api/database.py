import os
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings

# Ensure DB directory exists for SQLite
_db_url = settings.database_url
if _db_url.startswith("sqlite"):
    _path = _db_url.split("///")[-1]
    _dir = os.path.dirname(_path) or "."
    try:
        os.makedirs(_dir, exist_ok=True)
    except OSError as e:
        # If directory creation fails (e.g., read-only filesystem), use current directory
        if not os.path.exists(_dir):
            print(f"Warning: Could not create {_dir}, using current directory")
            _path = os.path.basename(_path)
            _db_url = f"sqlite+aiosqlite:///{_path}"

# Main engine for meta database (instances table)
engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Instance-specific database engines cache
_instance_engines: dict[str, tuple[any, async_sessionmaker]] = {}


class Base(DeclarativeBase):
    pass


async def _add_missing_columns_async(eng):
    """Add any ORM columns that don't exist in the DB yet.
    Uses ADD COLUMN IF NOT EXISTS (Postgres) so reruns are safe.
    Each column is its own transaction so one failure doesn't block others."""
    def _collect(conn):
        insp = sa.inspect(conn)
        result = []
        for table_name, table in Base.metadata.tables.items():
            if not insp.has_table(table_name):
                continue
            existing = {c["name"] for c in insp.get_columns(table_name)}
            for col in table.columns:
                if col.name not in existing:
                    col_type = col.type.compile(dialect=conn.dialect)
                    result.append((table_name, col.name, col_type))
        return result

    try:
        async with eng.connect() as conn:
            to_add = await conn.run_sync(_collect)
    except Exception as e:
        print(f"[db] migration inspection failed: {e}")
        return

    for table_name, col_name, col_type in to_add:
        try:
            async with eng.begin() as conn:
                # IF NOT EXISTS avoids error if another process beat us to it
                await conn.execute(sa.text(
                    f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
            print(f"[db] added column {table_name}.{col_name}")
        except Exception as e:
            print(f"[db] could not add column {table_name}.{col_name}: {e}")


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Run column additions in separate connections so each can fail independently
    await _add_missing_columns_async(engine)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


def get_instance_db_path(instance_key: str) -> str:
    """Get the database file path for a given instance."""
    if _db_url.startswith("sqlite"):
        base_path = _db_url.split("///")[-1]
        base_dir = os.path.dirname(base_path)
        if not base_dir:
            base_dir = "."
        instances_dir = os.path.join(base_dir, "instances")
        try:
            os.makedirs(instances_dir, exist_ok=True)
        except OSError:
            # Fallback to current directory if can't create subdirectory
            instances_dir = "."
        return os.path.join(instances_dir, f"{instance_key}.db")
    else:
        # Non-SQLite (e.g. Postgres): not supported for per-instance files — return None
        return None


def get_instance_engine(instance_key: str) -> tuple[any, async_sessionmaker]:
    """Get or create engine and session maker for a specific instance.
    Falls back to main engine when not using SQLite (e.g. Postgres on Railway)."""
    if instance_key not in _instance_engines:
        db_path = get_instance_db_path(instance_key)
        if db_path is None:
            # Non-SQLite: use main engine/session for everything
            _instance_engines[instance_key] = (engine, AsyncSessionLocal)
        else:
            inst_url = f"sqlite+aiosqlite:///{db_path}"
            inst_engine = create_async_engine(inst_url, echo=False)
            session_maker = async_sessionmaker(inst_engine, class_=AsyncSession, expire_on_commit=False)
            _instance_engines[instance_key] = (inst_engine, session_maker)
    return _instance_engines[instance_key]


async def get_instance_db(instance_key: str):
    """Get database session for a specific instance."""
    _, session_maker = get_instance_engine(instance_key)
    async with session_maker() as session:
        yield session
