import socket
import struct
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# In-memory DNS cache & fallback to avoid 5s system DNS stalls on remote DB hosts
_DNS_CACHE = {}
_orig_getaddrinfo = socket.getaddrinfo 

def _resolve_public_dns(hostname: str):
    for srv in ("8.8.8.8", "1.1.1.1"):
        try:
            tid = 0x1234
            header = struct.pack("!HHHHHH", tid, 0x0100, 1, 0, 0, 0)
            qname = b"".join(bytes([len(p)]) + p.encode() for p in hostname.split(".")) + b"\x00"
            packet = header + qname + struct.pack("!HH", 1, 1)
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(1.5)
            sock.sendto(packet, (srv, 53))
            data, _ = sock.recvfrom(1024)
            pos = len(packet)
            while pos < len(data):
                if data[pos] & 0xc0 == 0xc0:
                    pos += 2
                else:
                    while pos < len(data) and data[pos] != 0:
                        pos += 1 + data[pos]
                    pos += 1
                rtype, rclass, ttl, rdlen = struct.unpack("!HHIH", data[pos:pos+10])
                pos += 10
                if rtype == 1 and rdlen == 4:
                    return socket.inet_ntoa(data[pos:pos+4])
                pos += rdlen
        except Exception:
            continue
    return None

def _install_dns_accelerator(*urls):
    for u in urls:
        if not u or not u.startswith(("postgres", "postgresql")):
            continue
        try:
            host = urlsplit(u).hostname
            if host and host not in ("localhost", "127.0.0.1") and host not in _DNS_CACHE:
                ip = _resolve_public_dns(host)
                if ip:
                    _DNS_CACHE[host] = ip
        except Exception:
            pass

    if _DNS_CACHE:
        def fast_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
            target = _DNS_CACHE.get(host, host)
            return _orig_getaddrinfo(target, port, family, type, proto, flags)
        socket.getaddrinfo = fast_getaddrinfo

_install_dns_accelerator(settings.DATABASE_URL, settings.DATABASE_URL_UNPOOLED)

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
        pool_size=10,
        max_overflow=20,
        pool_recycle=300,
        pool_timeout=20,
        pool_pre_ping=False,  # Avoids blocking SELECT 1 on every single session checkout
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
