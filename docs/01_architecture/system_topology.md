# System Topology & Service Boundaries (C4 Model)

**Document ID:** ARCH-TOPO-CB-2026-V1  
**Project:** CareBridge India  
**Standard:** C4 Architectural Modeling (Context, Container, Component)  

---

## 1. Level 1: System Context Diagram

```mermaid
graph TB
    Patient["Rural / Semi-Urban Patient\n(Mobile Browser / PWA / Android APK)"]
    Representative["Authorised Family Representative\n(Mobile Browser / PWA)"]
    Doctor["Telemedicine Physician\n(Desktop Browser / Tablet)"]
    
    CareBridge["CareBridge India Platform\n(Consent, Vernacular Care & Adaptive Telehealth)"]
    
    ABDM["Ayushman Bharat Digital Mission (ABDM)\n(ABHA ID, Consent Artefacts, Health Data Exchange)"]
    Bhashini["Bhashini AI Gateway (MeitY)\n(Kannada, Hindi, English NMT & TTS/STT)"]
    NMC["National Medical Commission Registry\n(Doctor Verification)"]

    Patient -->|Uses Vernacular Care & Grants Consent| CareBridge
    Representative -->|Authorised Proxy Care| CareBridge
    Doctor -->|Conducts Teleconsultation & Signs Care Plan| CareBridge
    
    CareBridge -->|ABHA Address & Health Records| ABDM
    CareBridge -->|Translation & Audio Synthesis| Bhashini
    CareBridge -->|Verifies Practitioner Credentials| NMC
```

---

## 2. Level 2: Container Diagram (Logical Architecture)

```mermaid
graph TB
    subgraph ClientLayer["Frontend Clients"]
        PWA["React 18 PWA\n(TypeScript, Tailwind Tokens, WebRTC Core)"]
        APK["Capacitor Native Android Container\n(@capacitor/android, Local Notifications, Offline Cache)"]
    end

    subgraph IngressLayer["Ingress & Edge"]
        PROXY["Caddy / Nginx Reverse Proxy\n(TLS 1.3, Rate Limiting 60 rpm, CORS Protection)"]
    end

    subgraph AppLayer["FastAPI Application Services (ASGI)"]
        AUTH["Auth & Identity Service\n(Argon2id, Session JWTs, ABAC Guard)"]
        CONSENT_SRV["Consent Management Service\n(HMAC Tokens, Scope Verification)"]
        RTC_SIGNAL["WebRTC Signaling Gateway\n(WebSocket Peer Exchange, Bandwidth Probe)"]
        AI_SCRIBE["Clinical Note Scribe Engine\n(SOAP Extraction, Clinical Entity Parsing)"]
        DDI_SRV["Deterministic CDSS Engine\n(Contraindication Rule Interceptor)"]
        FHIR_SRV["HL7 FHIR R4 Service\n(Resource Serializer & ABDM Bridge)"]
    end

    subgraph DataLayer["Persistence & Storage Tier"]
        PG[(PostgreSQL 16\nACID Relational Core + JSONB)]
        REDIS[(Redis 7 In-Memory Cache\nEphemeral Tokens with Sub-millisecond TTL)]
        VAULT[(MinIO / S3 Encrypted Storage\nPrivate Scan Objects, No Public URLs)]
    end

    PWA --> PROXY
    APK --> PROXY
    PROXY --> AUTH
    PROXY --> CONSENT_SRV
    PROXY --> RTC_SIGNAL
    PROXY --> AI_SCRIBE
    PROXY --> DDI_SRV
    PROXY --> FHIR_SRV

    AUTH --> PG
    CONSENT_SRV --> REDIS
    CONSENT_SRV --> PG
    CONSENT_SRV --> VAULT
    RTC_SIGNAL --> REDIS
    AI_SCRIBE --> PG
    DDI_SRV --> PG
    FHIR_SRV --> PG
```

---

## 3. Service Boundaries & Communication Protocols

| Service Name | Primary Protocol | Auth Mechanism | Dependency |
| :--- | :--- | :--- | :--- |
| **Auth & Identity** | HTTPS / REST | Argon2id + Bearer JWT | PostgreSQL (`users`, `representatives`) |
| **Consent Service** | HTTPS / REST + SSE | Purpose-Scoped HMAC-SHA256 | Redis (TTL 3600s) + PostgreSQL (`consents`) |
| **WebRTC Signaling** | Secure WebSockets (`wss://`) | Session JWT | Redis (room states & ICE candidates) |
| **AI Scribe & CDSS** | HTTPS / Async ASGI | Clinician JWT | National Formulary Dataset |
| **Record Stream Proxy** | HTTPS Stream (`chunked`) | Purpose-Scoped Grant Token | MinIO / S3 Private Storage |
