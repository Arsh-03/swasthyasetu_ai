# STRIDE Threat Modeling Matrix & Engineering Mitigations

**Document ID:** SEC-STRIDE-CB-2026-V1  
**Project:** CareBridge India  
**Scope:** Attack Surfaces Across Client PWA, API Gateway, Microservices, and Persistence  

---

## 1. Threat Decomposition Table

| Threat (STRIDE) | Attack Surface | Impact | Engineering Defense in CareBridge |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Teleconsultation Login | Attacker impersonates a certified practitioner to access patient queue. | Verification against National Medical Register (NMC) credentials. Ephemeral JWTs bound to practitioner UID and MFA. |
| **Tampering** | Record Consent Request | Man-in-the-middle modifies the requested `record_id` or inflates `duration_minutes`. | Consent payload is signed via backend HMAC-SHA256 with timestamp nonces. Client tampering breaks signature verification. |
| **Repudiation** | Clinical Prescription | Doctor prescribes a contraindicated medication and later denies drafting it. | Mandated cryptographic sign-off (`clinician_signature`, `timestamp`, `ip_hash`). Read-only immutable append to `audit_events`. |
| **Information Disclosure** | Medical Scans / Lab Reports | Direct object reference (IDOR) leaking ultrasound or blood test scans via public URLs. | **Zero public URLs:** Files are stored in private S3/MinIO buckets and streamed chunk-by-chunk through authenticated proxy `/api/v1/records/{id}/stream`. |
| **Denial of Service** | WebRTC Video Stream | Packet flooding on unstable 2G/3G rural networks freezes patient smartphone. | Automated bandwidth probing downgrades session to audio-only (Opus 16kbps) or asynchronous store-and-forward. Rate limiting at 60 rpm on API gateway. |
| **Elevation of Privilege** | Authorised Representative | Representative attempts to view records outside patient's granted consent scope. | Role-Based & Attribute-Based Access Control (RBAC/ABAC) strictly enforcing `relationship_type` and active `authority_status`. |
