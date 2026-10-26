"""
Manage Partner API clients and keys. Run from backend/:

  python -m app.partner_admin create "Sunrise Clinic" --type clinic --scopes consent:request consent:read privacy:deidentify notes:parse
  python -m app.partner_admin key pcl_xxxxxxxxxxxx --scopes privacy:deidentify --rate 120
  python -m app.partner_admin list
  python -m app.partner_admin revoke pk_xxxxxxxxxxxx

The full API key is printed once; only its SHA-256 is stored.
"""
import argparse
import asyncio
import secrets
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import AsyncSessionLocal, Base, migration_engine as engine
from app.models.models import PartnerClient, PartnerKey, PartnerUsage
from app.routers.partner import SCOPES, new_key


async def _ensure_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def create(name: str, org_type: str, scopes, rate: int, webhook: str | None) -> None:
    async with AsyncSessionLocal() as db:
        client = PartnerClient(name=name, org_type=org_type, webhook_url=webhook,
                               webhook_secret=secrets.token_hex(24) if webhook else None)
        db.add(client)
        await db.flush()
        await _add_key(db, client.client_id, scopes, rate)
        await db.commit()
        print(f"client_id: {client.client_id}")
        if webhook:
            print(f"webhook_secret: {client.webhook_secret}   (verify X-CareBridge-Signature: sha256=HMAC(body))")


async def _add_key(db, client_id: str, scopes, rate: int) -> None:
    bad = [s for s in scopes if s not in SCOPES]
    if bad:
        raise SystemExit(f"Unknown scopes: {bad}. Allowed: {list(SCOPES)}")
    k = new_key()
    key = PartnerKey(client_id=client_id, prefix=k["prefix"], key_hash=k["hash"], scopes_json=list(scopes), rate_per_min=rate)
    db.add(key)
    await db.flush()
    print(f"key_id:  {key.key_id}")
    print(f"API key: {k['key']}   <- shown once; send it as the X-API-Key header")


async def key(client_id: str, scopes, rate: int) -> None:
    async with AsyncSessionLocal() as db:
        if not await db.get(PartnerClient, client_id):
            raise SystemExit("No such client")
        await _add_key(db, client_id, scopes, rate)
        await db.commit()


async def list_all() -> None:
    async with AsyncSessionLocal() as db:
        for c in (await db.execute(select(PartnerClient))).scalars():
            calls = len((await db.execute(select(PartnerUsage).where(PartnerUsage.client_id == c.client_id))).scalars().all())
            print(f"{c.client_id}  {c.name}  ({c.org_type}, {c.status})  calls: {calls}")
            for k in (await db.execute(select(PartnerKey).where(PartnerKey.client_id == c.client_id))).scalars():
                state = "revoked" if k.revoked_at else "active"
                print(f"    {k.key_id}  cb_live_{k.prefix}_…  {state}  {k.rate_per_min}/min  {', '.join(k.scopes_json or [])}")


async def revoke(key_id: str) -> None:
    async with AsyncSessionLocal() as db:
        k = await db.get(PartnerKey, key_id)
        if not k:
            raise SystemExit("No such key")
        k.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        print(f"revoked {key_id}")


def main() -> None:
    ap = argparse.ArgumentParser(prog="python -m app.partner_admin")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("create")
    c.add_argument("name")
    c.add_argument("--type", default="clinic")
    c.add_argument("--scopes", nargs="+", default=list(SCOPES))
    c.add_argument("--rate", type=int, default=60)
    c.add_argument("--webhook")
    k = sub.add_parser("key")
    k.add_argument("client_id")
    k.add_argument("--scopes", nargs="+", default=list(SCOPES))
    k.add_argument("--rate", type=int, default=60)
    sub.add_parser("list")
    r = sub.add_parser("revoke")
    r.add_argument("key_id")
    a = ap.parse_args()

    async def run() -> None:
        await _ensure_tables()
        if a.cmd == "create":
            await create(a.name, a.type, a.scopes, a.rate, a.webhook)
        elif a.cmd == "key":
            await key(a.client_id, a.scopes, a.rate)
        elif a.cmd == "list":
            await list_all()
        else:
            await revoke(a.key_id)
    asyncio.run(run())


if __name__ == "__main__":
    main()
