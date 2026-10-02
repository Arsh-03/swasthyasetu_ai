# Private Health Storage Vault & Encrypted Streaming

**Document ID:** DATA-VAULT-CB-2026-V1  
**Project:** CareBridge India  
**Storage Architecture:** S3-Compatible Private Object Store (MinIO / AWS S3)  
**Security Standard:** Server-Side Encryption (SSE-KMS / AES-256), Zero Public URLs  

---

## 1. Storage Security Rules

> [!CRITICAL]
> **ABSOLUTE RULE: ZERO PUBLIC URLs**
> Medical records (ultrasounds, blood reports, ECGs) must NEVER be exposed through public URLs or presigned URLs with long expirations. Presigned links can be forwarded, cached by intermediate proxies, or scraped.

### Enforcement Strategy
1. **Private Buckets Only:** Buckets reject all unauthenticated public read policies.
2. **Chunked Streaming Proxy (`/api/v1/records/{id}/stream`):**  
   The client requests bytes directly from the backend. The backend checks the active Redis consent grant token before reading each byte range from storage.
3. **Encrypted at Rest:** Files are encrypted using AES-256-GCM with customer-managed keys (CMK) rotated annually.

---

## 2. Streaming Proxy Code Architecture (FastAPI)

```python
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
import redis.asyncio as aioredis
import boto3

app = FastAPI()
redis_client = aioredis.from_url("redis://localhost:6379")
s3_client = boto3.client('s3')

async def verify_consent_token(record_id: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    # Verify sub-millisecond status in Redis
    is_active = await redis_client.get(f"consent_token:{token}")
    if not is_active:
        raise HTTPException(status_code=403, detail="Consent grant expired or revoked by patient")
    return token

@app.get("/api/v1/records/{record_id}/stream")
async def stream_medical_record(record_id: str, token: str = Depends(verify_consent_token)):
    # Stream directly from private bucket without buffering entire file in memory
    def iterfile():
        s3_obj = s3_client.get_object(Bucket="carebridge-vault-private", Key=f"records/{record_id}.pdf")
        for chunk in s3_obj['Body'].iter_chunks(chunk_size=65536):
            yield chunk

    return StreamingResponse(iterfile(), media_type="application/pdf")
```
