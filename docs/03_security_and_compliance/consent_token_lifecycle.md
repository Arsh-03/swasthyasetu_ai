# Purpose-Bound Consent Token Lifecycle & Revocation Mechanics

**Document ID:** SEC-TOKEN-CB-2026-V1  
**Project:** CareBridge India  
**Enforcement:** Cryptographic HMAC-SHA256 Tokenization + Redis Sub-Millisecond Revocation  

---

## 1. The Critical Distinction: Consent UI vs. Backend Enforcement

In many telemedicine prototypes, consent is a superficial checkbox on the front end. If an attacker crafts a raw HTTP GET request to `/api/records/patient123/scan.pdf`, the server returns the file.

**CareBridge Enforces Cryptographic Token Isolation:**
A doctor's session token alone **CANNOT** decrypt or read a patient's records. A separate, ephemeral, single-purpose **Consent Grant Token** must accompany the request.

---

## 2. Token Lifecycle Diagram

```mermaid
sequenceDiagram
    autonumber
    actor D as Doctor
    actor P as Patient
    participant API as FastAPI Backend
    participant REDIS as Redis Token Cache
    participant S3 as MinIO Private Vault

    D->>API: POST /api/v1/consents/request (record_id, purpose, duration=60m)
    API->>P: WebSocket Push: Consent Request Alert
    P->>API: POST /api/v1/consents/{id}/decision (Approved)
    
    rect rgb(240, 253, 244)
    Note over API,REDIS: Token Generation
    API->>API: Generate HMAC-SHA256 Token (record_id + purpose + exp)
    API->>REDIS: SET token:<hash> "ACTIVE" EX 3600
    API->>D: Return Purpose-Scoped Grant Token
    end

    D->>API: GET /api/v1/records/{id}/stream (Bearer <GrantToken>)
    API->>REDIS: GET token:<hash>
    alt Token Valid & Active
        REDIS-->>API: Status = "ACTIVE"
        API->>S3: Read byte chunks
        S3-->>API: Stream bytes
        API-->>D: HTTP 206 Partial Content (Stream scan)
    else Token Expired or Revoked
        REDIS-->>API: Key Not Found or Status = "REVOKED"
        API-->>D: HTTP 403 Forbidden (Consent Revoked / Expired)
    end

    opt Patient Clicks 1-Click Revoke
        P->>API: POST /api/v1/consents/{id}/revoke
        API->>REDIS: DEL token:<hash>
        API-->>D: Active stream severed immediately
    end
```

---

## 3. Cryptographic Token Payload

```json
{
  "token_type": "carebridge_consent_grant",
  "consent_id": "c7a82910-14e2-416b-b2bb-182390a8e100",
  "practitioner_id": "dr_ananya_sharma",
  "patient_id": "ramesh_gowda",
  "record_id": "usg_abdomen_may2026",
  "purpose": "Acute Flank Pain Assessment",
  "access_scope": "stream_only",
  "issued_at": 1727892000,
  "expires_at": 1727895600,
  "hmac_signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```
