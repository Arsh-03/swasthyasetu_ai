# End-to-End System Sequence Flows

**Document ID:** ARCH-SEQ-CB-2026-V1  
**Project:** CareBridge India  
**Scope:** Interactive Transaction Sequences for All Clinical & Consent Workflows  

---

## 1. Flow 1: Patient Ingestion, Vernacular Audio & Representative Check

```mermaid
sequenceDiagram
    autonumber
    actor P as Patient / Representative
    participant Client as CareBridge PWA
    participant API as FastAPI Backend
    participant Bhashini as Bhashini Voice Gateway
    participant DB as PostgreSQL

    P->>Client: Open App via SMS / Browser
    P->>Client: Select Language (Kannada / Hindi / English)
    Client->>Bhashini: Request Localized Welcome Audio
    Bhashini-->>Client: Stream Audio Prompt ("ನಮಸ್ಕಾರ ರಮೇಶ್ ಅವರೇ...")
    Client->>P: Play Synthesized Voice Greeting
    P->>Client: Select "Authorised Representative" (Sunita Devi)
    P->>Client: Select Relationship: "Daughter-in-law"
    Client->>API: POST /api/v1/representatives/declare
    API->>DB: INSERT INTO representatives (status='active')
    DB-->>API: Representative UUID Confirmed
    API-->>Client: 201 Created (Proxy Authority Logged)
    Client->>P: Render Consent Notice in Kannada with Audio Playback
```

---

## 2. Flow 2: Purpose-Specific Consent & Decrypted Record Streaming

```mermaid
sequenceDiagram
    autonumber
    actor D as Doctor
    actor P as Patient
    participant Client_D as Doctor Console
    participant Client_P as Patient PWA
    participant API as Backend Service
    participant Redis as Redis Cache
    participant Vault as Encrypted MinIO Storage

    D->>Client_D: Select "Ultrasound Pelvis" -> Request Access
    Client_D->>API: POST /api/v1/consents/request (record_id, purpose, duration=60m)
    API->>Redis: Stage pending request (TTL 300s)
    API-->>Client_P: Push High-Priority Modal (WebSocket Event)
    Client_P->>P: Render Consent Modal (Purpose: "Abdominal Pain", 60m expiry)
    Client_P->>P: Play Kannada Audio ("ಡಾಕ್ಟರ್ ಅನನ್ಯಾ ಶರ್ಮಾ ಅವರು...")
    P->>Client_P: Click "✅ Approve (ಅನುಮೋದಿಸಿ)"
    Client_P->>API: POST /api/v1/consents/{id}/decision (decision='approved')
    API->>API: Generate HMAC-SHA256 Token (record_id + purpose + exp)
    API->>Redis: SET token:<hash> "ACTIVE" EX 3600
    API-->>Client_D: Return Purpose-Scoped Token
    Client_D->>API: GET /api/v1/records/{id}/stream (Bearer <Token>)
    API->>Redis: Validate Token Status
    Redis-->>API: "ACTIVE"
    API->>Vault: Read Encrypted Chunks
    Vault-->>API: Binary Chunks
    API-->>Client_D: Stream Decrypted Scan to Canvas (HTTP 206)
```

---

## 3. Flow 3: AI Documentation, DDI Interception & Clinician Sign-off

```mermaid
sequenceDiagram
    autonumber
    actor D as Doctor
    participant Client_D as Doctor Console
    participant API as Backend Service
    participant DDI as Deterministic CDSS Engine
    participant DB as PostgreSQL
    actor P as Patient

    D->>Client_D: Complete Teleconsultation Dialogue
    Client_D->>API: POST /api/v1/encounters/{id}/ai-draft
    API->>API: Parse Speech Transcript -> Structure into SOAP Format
    API->>DDI: Intercept Prescribed Drugs: [Ciprofloxacin] + Patient Meds: [Antacid]
    DDI->>DDI: Query National Formulary Contraindication Matrix
    DDI-->>API: Severity: CRITICAL | Citation: NFI 2021 | Action: Space by 2h
    API-->>Client_D: Return Draft SOAP Note + Red DDI Safety Banner
    Client_D->>D: Doctor Reviews DDI Warning, Adjusts Dosage Timing
    Client_D->>D: Doctor Checks "[x] I verify clinical appropriateness"
    D->>Client_D: Click "Sign & Finalize Prescription"
    Client_D->>API: POST /api/v1/encounters/{id}/sign-off (Signature, Timestamp)
    API->>DB: UPDATE clinical_notes SET status='clinician_approved'
    API-->>Client_D: Status: ISSUED (FHIR Bundle Available)
    API-->>P: Deliver Bilingual Discharge Summary + Audio TTS Care Plan
```
