# Engineering Sprint Roadmap & Delivery Plan

**Document ID:** ROADMAP-SPRINT-CB-2026-V1  
**Project:** CareBridge India  
**Execution Horizon:** 4 Sequential Milestones (Hackathon Demo to Field Pilot)  

---

## 1. Master Delivery Timeline

```mermaid
gantt
    title CareBridge India Sprint Deliverables
    dateFormat  YYYY-MM-DD
    section M1: Foundations
    FastAPI Core & Auth Scaffold    :done, 2026-10-03, 1d
    PostgreSQL Schemas & Migrations :done, 2026-10-04, 1d
    section M2: Consent Core
    Redis Ephemeral Token Grants    :active, 2026-10-05, 1d
    Private Record Proxy Streamer   :2026-10-06, 1d
    section M3: Media & Safety
    Adaptive WebRTC State Machine   :2026-10-07, 1d
    Deterministic DDI Rule Engine   :2026-10-08, 1d
    section M4: Vernacular & PWA
    Kannada/Hindi TTS Audio Player  :2026-10-09, 1d
    Capacitor Android APK Packaging :2026-10-10, 1d
```

---

## 2. Milestone Checkpoints & Acceptance Criteria

### Milestone 1: Foundations & Identity
- **Deliverable:** Working FastAPI ASGI server with async SQLAlchemy models for Users, Profiles, and Encounters.
- **Acceptance Gate:** Synthetic Patient (Ramesh) and Doctor (Dr. Ananya) can authenticate; patient declares self vs. authorized representative.

### Milestone 2: Purpose-Specific Consent Engine
- **Deliverable:** `/api/v1/consents/request` and `/decision` endpoints with Redis key expiration (TTL 3600s).
- **Acceptance Gate:** Doctor cannot view the ultrasound scan until the patient approves; access is revoked immediately upon user revocation.

### Milestone 3: WebRTC Adaptation & Clinical DDI Safety
- **Deliverable:** WebRTC signaling channel with active bandwidth probe that steps down from video to audio priority.
- **Acceptance Gate:** DDI engine flags Ciprofloxacin + Antacids with visible formulary citation; doctor cannot sign without explicit review.

### Milestone 4: Vernacular Audio & Mobile APK Release
- **Deliverable:** Kannada & Hindi speech prompts for consent notices and post-consultation instructions; Capacitor build script for Android.
- **Acceptance Gate:** App runs at 60fps on mobile browsers and compiles cleanly into `app-debug.apk` (<12MB).
