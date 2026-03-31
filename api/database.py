import os
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings

# Ensure DB directory exists for SQLite
_db_url = settings.database_url
if _db_url.startswith("sqlite"):
    _path = _db_url.split("///")[-1]
    os.makedirs(os.path.dirname(_path) or ".", exist_ok=True)

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _add_missing_columns(conn):
    """Add any columns that exist in the model but not in the DB (poor-man's migration)."""
    inspector = sa.inspect(conn)
    for table_name, table in Base.metadata.tables.items():
        if not inspector.has_table(table_name):
            continue
        existing = {c["name"] for c in inspector.get_columns(table_name)}
        for col in table.columns:
            if col.name not in existing:
                col_type = col.type.compile(dialect=conn.dialect)
                conn.execute(sa.text(f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}"))


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
