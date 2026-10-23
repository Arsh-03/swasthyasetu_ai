from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# libpq-style params that asyncpg doesn't accept in the URL; SSL is set via connect_args.
_LIBPQ_ONLY_PARAMS = {"sslmode", "channel_binding"}


def _to_asyncpg_url(url: str) -> str:
    """Turn a Neon `postgresql://...?sslmode=require` URL into one asyncpg accepts."""
    parts = urlsplit(url)
    scheme = "postgresql+asyncpg" if parts.scheme in ("postgres", "postgresql") else parts.scheme
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query) if k not in _LIBPQ_ONLY_PARAMS])
    return urlunsplit((scheme, parts.netloc, parts.path, query, parts.fragment))


def _make_engine(url: str, pooled: bool):
    if url.startswith("sqlite"):
        return create_async_engine(url, echo=False, connect_args={"check_same_thread": False})

    connect_args = {"ssl": "require"}
    if pooled:
        # Neon's pooler runs PgBouncer in transaction mode, which can't reuse
        # asyncpg's cached prepared statements across connections.
        connect_args["statement_cache_size"] = 0
    return create_async_engine(
        _to_asyncpg_url(url),
        echo=False,
        connect_args=connect_args,
        pool_pre_ping=True,  # Neon computes scale to zero; drop stale connections
    )


# App traffic goes through Neon's pooled endpoint.
engine = _make_engine(settings.DATABASE_URL, pooled=True)
# Schema changes (create_all) use the direct endpoint, as Neon recommends.
migration_engine = _make_engine(settings.DATABASE_URL_UNPOOLED, pooled=False)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
