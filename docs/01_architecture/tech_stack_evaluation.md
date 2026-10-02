# Tech Stack Evaluation & Architectural Trade-Off Analysis

**Document ID:** ARCH-EVAL-CB-2026-V1  
**Project:** CareBridge India  
**Scope:** Backend, Frontend, Mobile Strategy, Persistence, and Telehealth Transport  

---

## 1. Backend Architecture: Python + FastAPI vs. Alternatives

### 1.1 Comparative Matrix

| Evaluation Dimension | Python 3.11 + FastAPI (Selected) | Node.js + Express / NestJS | Go (Golang) |
| :--- | :--- | :--- | :--- |
| **Data Validation & Typing** | **Exceptional** (Native Pydantic v2 in Rust core) | Good (Zod / class-validator required) | Moderate (manual struct tags) |
| **AI / NLP & Bhashini SDKs** | **Native** (Python is the lingua franca for ML, LLMs, and Bhashini speech models) | Requires subprocess or HTTP wrappers to Python services | Limited AI ecosystem; requires external Python microservice |
| **Async Concurrency & WebSockets** | High (ASGI event loop, uvloop, async/await) | High (V8 event loop) | Exceptional (Goroutines, lightweight channels) |
| **FHIR R4 Schema Serialization** | High (`fhir.resources` Python package built-in) | Moderate (`@types/fhir` JSON manipulation) | Complex (heavy struct definitions) |
| **Developer Velocity** | **Very High** (auto-generates OpenAPI / Swagger docs) | High | Moderate |

### 1.2 Architectural Decision
**Selected: Python 3.11 + FastAPI.**  
FastAPI provides the ideal balance of high-throughput async I/O (handling WebRTC signaling and WebSocket tokens) while natively integrating with the Python ecosystem used by medical AI scribes, Bhashini speech-to-text models, and clinical NLP pipelines.

---

## 2. Frontend & Mobile Strategy: PWA-First + Capacitor APK Bridge

### 2.1 The Critical Dilemma: Native App vs. Cross-Platform vs. Web PWA

In Indian public health and rural telemedicine:
- Requiring a patient to download a 60MB native APK from the Play Store before consulting a doctor results in an **immediate 65% drop-off rate** due to limited device storage (8GB/16GB phones) and data recharge constraints.
- However, relying solely on mobile web limits push notifications, background sync, and native device camera/audio hardware optimizations.

### 2.2 Comparative Strategy Matrix

| Metric | Pure Native (Kotlin) | Flutter / React Native | React PWA + Capacitor APK (Selected) |
| :--- | :--- | :--- | :--- |
| **Zero-Install Web Access** | ❌ Impossible (Play Store mandatory) | ❌ Poor web bundle size (>2.5MB initial JS) | **✅ Instant load via SMS/WhatsApp link (<250KB gzipped)** |
| **Low-End Android Performance** | Exceptional | High (requires high memory) | **High (lightweight DOM, GPU-accelerated CSS)** |
| **Offline Caching & Service Workers** | Requires SQLite setup | Requires SQLite plugin | **Native Service Worker + IndexedDB + Capacitor SQLite** |
| **App Store / APK Distribution** | Play Store only | Play Store & App Store | **Can be wrapped with `@capacitor/core` into a release APK in 1 command** |
| **Development & Maintenance Cost** | 2x codebases | Single codebase, native bridges | **Single codebase for Web, PWA, and Android APK** |

### 2.3 The Hybrid Architectural Decision
**Selected: React 18 + TypeScript PWA with a Capacitor Android APK Bridge.**
1. **PWA Layer (Web First):** When a doctor or rural healthcare worker sends a consultation link via SMS or WhatsApp, the patient opens the CareBridge portal immediately in their mobile browser without downloading an app.
2. **Capacitor Packaging (`@capacitor/android`):** For field workers (ASHA workers, ANMs) and repeat patients, the exact same React codebase is wrapped into a lightweight (<12MB) Android APK using Capacitor, enabling native hardware camera controls, local notifications, and offline SQLite record caches.

---

## 3. Persistence Layer: PostgreSQL + Redis vs. Pure NoSQL

| Dimension | PostgreSQL 16 + Redis 7 (Selected) | MongoDB (Pure NoSQL) |
| :--- | :--- | :--- |
| **Relational Integrity** | **Strict ACID** (Foreign keys between Patients, Consents, and Encounters) | Eventual consistency; manual relation checks in app code |
| **Ephemeral Token Expiration** | **Redis TTL** (Zero-latency sub-millisecond revocation) | MongoDB TTL indexes (background sweep runs every 60s, too slow for instant revocation) |
| **Semi-Structured Data** | Native `JSONB` with GIN indexing for clinical notes & FHIR payloads | Native JSON |
| **Audit Log Immutability** | Cryptographic row hashing + append-only triggers | Requires custom oplog triggers |

**Selected: PostgreSQL 16 for persistent relational data and Redis 7 for transient cryptographic access grants.**
