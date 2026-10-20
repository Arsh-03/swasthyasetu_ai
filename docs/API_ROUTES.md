# SwasthyaSetu — Backend Route Documentation (v0.1, design only)

**Status:** specification only. Nothing here is implemented.
**Stack (from the repo docs):** Python 3.11 + FastAPI (ASGI), PostgreSQL 16, Redis 7, MinIO/S3 private vault, WebSockets for realtime, Bhashini for translation/TTS/STT, ABDM for ABHA and health-data exchange.
**Based on:** `docs/01_architecture`, `02_data`, `03_security_and_compliance`, `04_features_and_engines` in your repo, plus the 17 Stitch prototype screens.
**Existing routes already named in your repo docs** (kept exactly): `POST /api/v1/representatives/declare`, `POST /api/v1/consents/request`, `POST /api/v1/consents/{id}/decision`, `POST /api/v1/consents/{id}/revoke`, `GET /api/v1/records/{id}/stream`, `POST /api/v1/encounters/{id}/ai-draft`, `POST /api/v1/encounters/{id}/sign-off`.

Roles used below: **P** patient, **R** authorised representative (acts for a patient), **D** doctor (practitioner), **A** admin, **S** system or third-party callback.

---

## 0. Decisions and gaps to confirm before building

These came up while mapping the prototype onto your repo docs. Each one changes a route or a table.

| # | Issue | Recommendation |
|---|---|---|
| 1 | Repo sends the consent grant token as `Authorization: Bearer <GrantToken>` for the record stream. But a doctor's session JWT must also be checked (STRIDE: spoofing). | Send **both**: `Authorization: Bearer <session JWT>` and `X-Consent-Token: <grant token>`. Stream route requires both. |
| 2 | `users.password_hash` is `NOT NULL`, but patients sign in with ABHA or mobile OTP and have no password. | Make `password_hash` nullable; add `auth_method` column. Doctors keep password + MFA. |
| 3 | `consents.status` has no `active`, but the consent state machine does (`Approved → Active → Expired/Revoked`). | Add `active`, or derive it from the Redis key and keep `approved` in Postgres. This doc assumes the derived approach. |
| 4 | Allergies and current medicines live in `encounters.allergies_json` and `current_meds_json`, so they disappear between visits. The prototype has Allergies and Medicines tiles. | Add tables `patient_allergies` and `patient_medications` (routes in section 6). |
| 5 | `encounters` has no scheduled time, urgency, or vitals. The prototype shows "Today 10:30", urgency chips and "BP 130/85, 102°F". | Add `scheduled_start`, `urgency` (`routine/follow_up/high`), `triage_alert_flag`, `vitals_json`. Add statuses `scheduled`, `cancelled`. |
| 6 | DDI engine covers **drug-drug** pairs only. The prototype's best demo moment is a **drug-allergy** catch (Amoxicillin vs penicillin allergy). | Add `drug_classes` (drug → class) and an allergy-to-class matcher; the check route returns both alert types. |
| 7 | The prototype's second alert, "Paracetamol + Amoxicillin may upset the stomach", is not a recognised significant interaction. A clinician judge may notice. | Replace with a seeded rule from your repo (for example Ciprofloxacin + magnesium antacid) or remove that line. Seed data below uses the allergy alert only. |
| 8 | Prototype order is Consent (04) → Intake (05) → Home (06), but an encounter must exist before encounter-level consent. | Home shows an existing scheduled encounter, or the app calls `POST /encounters` first. See the screen map. |
| 9 | ABDM and Bhashini endpoints are external and change. | Wrap each in an adapter (`abdm_client`, `bhashini_client`) and verify exact calls against their current sandbox docs before building. This doc defines only **our** routes. |
| 10 | Real-time translated captions appear in the doctor workspace prototype but have no route in the repo. | Add `WS /ws/captions/{encounter_id}` (optional for the demo). |

---

## 1. Conventions

**Base URL:** `/api/v1` (WebSockets under `/ws`). JSON UTF-8. IDs are UUIDs. Times are ISO 8601 UTC (`2026-10-21T10:30:00Z`).

**Auth headers**
- `Authorization: Bearer <access_jwt>` on every route except those marked *public*. Access token lifetime 15 minutes, refresh token 7 days, rotated on use.
- `X-Consent-Token: <grant token>` only on record streaming by a doctor.
- `Accept-Language: kn | hi | en`. If missing, use the user's `preferred_language`.
- `Idempotency-Key: <uuid>` on routes marked **idem** (creates and sign-off), so a retry on a weak network never duplicates.
- `X-Client-Type: pwa | apk`. PWA receives the refresh token in an `HttpOnly; Secure; SameSite=Strict` cookie. APK receives it in the response body for secure storage.

**Authorisation rules (ABAC, enforced on every route)**
- A patient sees only their own data. A representative sees a patient's data only while `representatives.authority_status = 'active'`.
- A doctor sees a patient's summary only for an encounter assigned to them that is `scheduled`, `queued`, or `in_progress` (or `completed` within 30 days for their own notes).
- A doctor can read a **record file** only with an active consent grant. Doctor session alone is never enough.

**Standard error body**
```json
{
  "error": {
    "code": "CONSENT_EXPIRED",
    "message": "Consent has expired.",
    "message_localized": "ಅನುಮತಿಯ ಅವಧಿ ಮುಗಿದಿದೆ.",
    "details": { "consent_id": "…" },
    "request_id": "req_8f2c…"
  }
}
```

**Status codes:** `200` ok, `201` created, `202` accepted (async job), `204` no content, `206` stream, `400` validation, `401` not signed in, `403` not allowed, `404` not found (also used instead of 403 when it would leak that a record exists), `409` conflict or state problem, `410` expired, `422` business-rule failure, `429` rate limited, `502/504` upstream (Bhashini, ABDM, LLM) failure.

**Pagination:** `?limit=20&cursor=<opaque>` returns `{ "items": [...], "next_cursor": "…" | null }`.

**Rate limits:** 60 requests per minute per user (repo), `POST /auth/otp/*` and `/auth/abha/*` 5 per 10 minutes per phone/ABHA and per IP, `/ai/*` 10 per minute per user.

**Logging rule:** never log names, ABHA IDs, phone numbers, OTPs, transcripts, or file contents. Log IDs, route, status, latency, `request_id`, and `ip_hash`.

**Audit rule:** every route marked 🔒audit writes an `audit_events` row (actor, action, resource, outcome `SUCCESS/DENIED/EXPIRED`, `ip_hash`), including denied attempts.

**Localisation rule:** user-facing strings are returned in the requested language. Drug names and strengths are never translated (`Amoxicillin 500mg` stays as is).

---

## 2. Route index

| Group | Routes |
|---|---|
| 3 System | `GET /health`, `GET /health/ready`, `GET /meta/app-config` |
| 4 Auth | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/abha/initiate`, `POST /auth/abha/verify`, `POST /auth/practitioner/login`, `POST /auth/mfa/verify`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| 5 Profile and language | `GET/PATCH /me/profile`, `PATCH /me/language`, `POST /representatives/declare`, `GET /representatives`, `POST /representatives/{id}/revoke` |
| 6 Health context | `GET/POST/DELETE /patients/me/allergies`, `GET/POST/PATCH/DELETE /patients/me/medications`, `POST /intake/voice` |
| 7 Home | `GET /patients/me/home`, `GET /patients/me/doctors`, `GET /patients/me/encounters` |
| 8 Encounters | `POST /encounters`, `GET /encounters/{id}`, `POST /encounters/{id}/consent`, `GET /encounters/{id}/consent-notice`, `PATCH /encounters/{id}/intake`, `POST /encounters/{id}/start`, `POST /encounters/{id}/end`, `POST /encounters/{id}/cancel`, `POST /encounters/{id}/vitals` |
| 9 Doctor | `GET /doctors/me/dashboard`, `GET /doctors/me/queue`, `GET /encounters/{id}/patient-summary`, `GET /encounters/{id}/patient/records` |
| 10 Video call | `POST /rtc/sessions`, `WS /ws/rtc/{encounter_id}`, `POST /rtc/{encounter_id}/network-report`, `POST /encounters/{id}/async-messages`, `GET /encounters/{id}/async-messages`, `WS /ws/captions/{encounter_id}` |
| 11 Records and consent | `GET/POST /patients/me/records`, `GET /records/{id}`, `GET /records/{id}/stream`, `DELETE /records/{id}`, `POST /consents/request`, `GET /consents`, `GET /consents/{id}`, `POST /consents/{id}/decision`, `GET /consents/{id}/grant`, `POST /consents/{id}/revoke`, `POST /consents/revoke-all`, `GET /patients/me/access-history` |
| 12 Clinical note, DDI, sign-off | `POST /encounters/{id}/transcripts`, `POST /encounters/{id}/ai-draft`, `GET /encounters/{id}/note`, `PATCH /encounters/{id}/note`, `POST /encounters/{id}/note/fields/{field}/confirm`, `POST /ddi/check`, `POST /encounters/{id}/ddi-acknowledgements`, `POST /encounters/{id}/sign-off` |
| 13 Care plan and export | `GET /encounters/{id}/care-plan`, `GET /encounters/{id}/care-plan/audio`, `GET /encounters/{id}/fhir-bundle`, `POST /encounters/{id}/abdm/share` |
| 14 AI | `GET /ai/jobs/{job_id}`, `POST /ai/symptom-triage`, `POST /ai/explain-medicine`, `POST /ai/assistant/chat` |
| 15 Language and voice | `POST /translate`, `POST /tts`, `POST /stt`, `GET /i18n/glossary` |
| 16 Follow-up and reminders | `GET /patients/me/follow-ups`, `POST /follow-ups/{id}/response`, `POST /follow-ups/{id}/reschedule`, `GET/POST/DELETE /reminders`, `POST /webhooks/messaging` |
| 17 Emergency | `POST /emergency/alerts`, `GET /emergency/facilities/nearby`, `GET/POST/DELETE /patients/me/emergency-contacts`, `GET /emergency/numbers` |
| 18 Realtime events | `WS /ws/events`, `GET /notifications`, `POST /devices/push-token` |
| 19 Admin and audit | `POST /admin/practitioners/{id}/verify-nmc`, `GET /audit/events`, `POST /webhooks/abdm` |

---

## 3. System

### `GET /health` · public
Liveness. `200 {"status":"ok"}`.

### `GET /health/ready` · public
Checks Postgres, Redis, MinIO. `200` when all reachable, else `503 {"status":"degraded","failed":["redis"]}`. No internals in the response.

### `GET /meta/app-config` · public
Lets the client configure itself.
```json
{
  "languages": [
    {"code":"kn","name":"ಕನ್ನಡ"},{"code":"hi","name":"हिन्दी"},{"code":"en","name":"English"}
  ],
  "default_language": "en",
  "consent_durations_minutes": [60, 120, 1440],
  "max_upload_mb": 20,
  "allowed_upload_mime": ["application/pdf","image/jpeg","image/png"],
  "network_tiers": {"hd":350,"low":150,"audio":30},
  "emergency_numbers": {"ambulance":"108"},
  "features": {"assistant_chat": false, "captions": true}
}
```

---

## 4. Auth and identity

Screens: Welcome, Login (ABHA / mobile), doctor login.
Patients sign in with **ABHA** or **mobile OTP**. Doctors sign in with **registration number or email + password + MFA**.

### `POST /auth/otp/request` · public · mobile login
Request
```json
{ "mobile": "+919876543210", "purpose": "login", "language": "kn" }
```
Response `202`
```json
{ "txn_id": "otp_5d1c…", "resend_after_seconds": 30, "expires_in": 300, "mobile_masked": "+91 ••••• •3210" }
```
Rules: generate a 6-digit OTP, store only its hash in Redis (TTL 300s), send by SMS in the user's language. Same response whether or not the number exists. Errors: `429 RATE_LIMITED`.

### `POST /auth/otp/verify` · public
Request `{ "txn_id": "otp_5d1c…", "otp": "482913" }`
Response `200`
```json
{
  "access_token": "eyJ…", "token_type": "Bearer", "expires_in": 900,
  "user": { "user_id": "…", "role": "patient", "is_new": true, "preferred_language": "en" }
}
```
Rules: max 5 attempts per `txn_id`, then `410 OTP_EXPIRED`. Creates `users` + `patient_profiles` on first login (`is_new: true` → the app sends the user to Language selection). Errors: `400 OTP_INVALID`, `410 OTP_EXPIRED`.

### `POST /auth/abha/initiate` · public
Starts ABHA login through the ABDM adapter.
Request
```json
{ "abha_id": "91-4820-1928-1120", "method": "mobile_otp" }
```
`abha_id` may also be an ABHA address (`name@abdm`). Response `202`
```json
{ "txn_id": "abha_77ab…", "otp_sent_to_masked": "••••••3210", "expires_in": 300 }
```
Rules: never store or log Aadhaar numbers. Errors: `404 ABHA_NOT_FOUND`, `502 ABDM_UNAVAILABLE`.

### `POST /auth/abha/verify` · public
Request `{ "txn_id": "abha_77ab…", "otp": "482913" }`. Response: same shape as `/auth/otp/verify`, plus `"abha_linked": true`. Stores `patient_profiles.abha_address`.

### `POST /auth/practitioner/login` · public
Request
```json
{ "identifier": "KMC-48213", "password": "••••••••" }
```
Response `200` `{ "mfa_required": true, "mfa_txn_id": "mfa_92de…", "mfa_channel": "sms" }`
Rules: Argon2id check; account locks for 15 minutes after 5 failures. The practitioner must have `credential_status = 'verified'` (NMC check, see section 19) or `403 CREDENTIAL_NOT_VERIFIED`.

### `POST /auth/mfa/verify` · public
Request `{ "mfa_txn_id": "mfa_92de…", "code": "193847" }`. Response: access token + `user` (`role: "practitioner"`, `practitioner_id`, `display_name`, `specialty`).

### `POST /auth/refresh`
Uses the refresh cookie (PWA) or `{ "refresh_token": "…" }` (APK). Returns a new access token and rotates the refresh token. A reused refresh token revokes the whole session family and returns `401 TOKEN_REUSED`.

### `POST /auth/logout`
Revokes the refresh token and denies the current access token `jti` in Redis until it expires. `204`.

### `GET /auth/me`
```json
{
  "user_id": "…", "role": "patient", "display_name": "Kamla Devi",
  "preferred_language": "en", "acting_for": null,
  "representing": []
}
```
If a representative is signed in, `acting_for` shows the patient being represented.

---

## 5. Profile, language, representatives

### `GET /me/profile` · P/R/D
Patient: `{ full_name, preferred_language, abha_masked, age, sex, district }` (minimised demographics). Doctor: `{ display_name, registration_number, specialty, credential_status }`.

### `PATCH /me/profile` · P
Updates `full_name`, `demographics_json` only. `200` with the updated profile.

### `PATCH /me/language` · P/R/D
Request `{ "preferred_language": "kn" }` → `200`. Saved on the profile so the language follows the user to other devices. (The Language screen calls this when the user taps Continue.)

### `POST /representatives/declare` · P · idem · 🔒audit
From the repo. Request
```json
{ "representative_name": "Sunita Devi", "relationship": "daughter", "mobile": "+919812345678" }
```
Response `201`
```json
{ "representative_id": "…", "status": "active", "invite_sent": true }
```
Rules: the representative receives an OTP link and creates their own user (`role: representative`). Allowed relationships: `daughter, son, spouse, guardian`.

### `GET /representatives` · P
Lists the patient's representatives with `authority_status`.

### `POST /representatives/{id}/revoke` · P · 🔒audit
Sets `authority_status = 'revoked'`, kills that representative's sessions. `204`.

---

## 6. Health context (allergies, medicines, voice intake)

Screens: Intake (Allergies, Medicines rows), Safety alert.

### `GET /patients/me/allergies` · P/R
```json
{ "items": [
  { "allergy_id": "…", "substance": "Penicillin", "drug_class": "penicillin", "severity": "severe", "source": "patient_reported", "recorded_at": "2026-10-01T09:00:00Z" }
] }
```
(Doctors read allergies only through `GET /encounters/{id}/patient-summary`.)

### `POST /patients/me/allergies` · P/R · idem
Request `{ "substance": "Penicillin", "severity": "severe" }` (severity optional: `mild|moderate|severe|unknown`). Response `201` with the item. Server maps `substance` → `drug_class` using `drug_classes` when it recognises the name; otherwise `drug_class: null` and the alert engine falls back to exact-name matching.

### `DELETE /patients/me/allergies/{allergy_id}` · P/R
Soft delete. `204`. 🔒audit (changes affect safety checks).

### `GET /patients/me/medications` · P/R
```json
{ "items": [
  { "medication_id": "…", "name": "Metformin", "strength": "500mg", "schedule": {"morning":1,"afternoon":0,"night":1}, "with_food": "after", "active": true, "source": "patient_reported" }
] }
```

### `POST /patients/me/medications` · P/R · idem
Request `{ "name": "Metformin", "strength": "500mg", "schedule": {"morning":1,"afternoon":0,"night":1}, "with_food": "after" }` → `201`.

### `PATCH /patients/me/medications/{id}` · P/R
Partial update (for example `active: false`). `200`.

### `DELETE /patients/me/medications/{id}` · P/R → `204`.

### `POST /intake/voice` · P/R · multipart
Screen: Intake mic button. Upload a short recording and get back text plus suggested symptom tags.
Request: `multipart/form-data` with `audio` (webm/ogg/wav, max 60 seconds, max 2 MB) and `language`.
Response `200`
```json
{
  "transcript_id": "tr_31ab…",
  "transcript": "Three days of fever and body ache",
  "language": "en",
  "suggested_symptoms": [
    {"code":"fever","label":"Fever"}, {"code":"body_ache","label":"Body ache"}
  ],
  "duration_hint": "3 days"
}
```
Rules: audio goes through the Bhashini STT adapter, then is deleted; only the transcript is kept (30 days unless attached to an encounter). Errors: `413 AUDIO_TOO_LONG`, `422 NO_SPEECH_DETECTED`, `504 STT_TIMEOUT` (client falls back to tap/type).

---

## 7. Patient home

### `GET /patients/me/home` · P/R
One call that fills the Home screen.
```json
{
  "greeting_name": "Kamla",
  "upcoming": {
    "encounter_id": "…", "scheduled_start": "2026-10-21T05:00:00Z",
    "practitioner": { "id": "…", "display_name": "Dr. Meena Rao", "photo_asset": "dr_rao" },
    "mode": "video", "joinable_from": "2026-10-21T04:50:00Z", "minutes_to_start": 12
  },
  "pending_consent_requests": 0,
  "pending_follow_up": { "follow_up_id": "…", "day": 3 },
  "has_active_care_plan": true,
  "emergency_enabled": true
}
```
`upcoming` is `null` if none. `pending_consent_requests` lets the app surface a record request even before the user is in a call.

### `GET /patients/me/doctors` · P/R
"My Doctors" tile: doctors the patient has had an encounter with. Items `{ practitioner_id, display_name, specialty, last_seen }`.

### `GET /patients/me/encounters?status=upcoming|past&limit=20` · P/R
List with `encounter_id, practitioner, scheduled_start, status, mode`.

---

## 8. Encounters (a consultation from request to completion)

**Encounter status machine:** `scheduled → queued → in_progress → completed`; also `cancelled`. **Mode:** `video | audio | text_async`.
**Note status machine** (separate, section 12): `none → generating → draft → under_review → clinician_approved`.

### `POST /encounters` · P/R · idem · 🔒audit
Create a consultation request or appointment.
Request
```json
{
  "practitioner_id": "…",
  "scheduled_start": "2026-10-21T05:00:00Z",
  "mode": "video",
  "symptoms_text": "Fever for 3 days",
  "symptom_codes": ["fever", "body_ache"],
  "body_areas": ["head", "chest"],
  "transcript_id": "tr_31ab…"
}
```
`practitioner_id` and `scheduled_start` are optional. If both are omitted the encounter goes straight to `queued` and the next available doctor is assigned.
Response `201`
```json
{ "encounter_id": "…", "status": "scheduled", "queue_position": null, "consent_required": true }
```
Errors: `409 ACTIVE_ENCOUNTER_EXISTS`, `422 PRACTITIONER_UNAVAILABLE`.

### `GET /encounters/{id}` · P/R/D (party to the encounter)
Returns `encounter_id, status, mode, scheduled_start, practitioner (public fields), patient_first_name, consent_status, note_status, network_tier`.

### `GET /encounters/{id}/consent-notice` · P/R
Screen: **Consent** (who / why / how long). Returns the three rows plus the text for the Listen button.
```json
{
  "who":  { "label": "Dr. Meena Rao", "photo_asset": "dr_rao", "nmc_verified": true },
  "why":  { "label": "Fever check" },
  "how_long": { "label": "1 hour", "minutes": 60 },
  "audio_text": "Dr. Meena Rao will see your health information for a fever check, for one hour only.",
  "language": "en"
}
```
Audio for `audio_text` comes from `POST /tts` (section 15).

### `POST /encounters/{id}/consent` · P/R · idem · 🔒audit
Screen: **Consent** (Allow / Not now). This is **encounter-level** consent to share information with the doctor. It is different from **record-level** consent (section 11).
Request `{ "decision": "allow" }` or `{ "decision": "decline" }`
Response `200` `{ "encounter_id": "…", "consent_status": "allowed", "valid_until": "2026-10-21T06:00:00Z" }`
Rules: `allow` sets `valid_until = now + 60 minutes` (the "How long" row). `decline` keeps the encounter but blocks the doctor from seeing allergies, medicines and symptoms. `422 CONSENT_REQUIRED` is returned by every doctor-side summary route until this is `allowed`.

### `PATCH /encounters/{id}/intake` · P/R
Screen: **Intake** (Next). Saves what the user told us.
Request `{ "symptoms_text": "…", "symptom_codes": ["fever"], "body_areas": ["head"], "voice_transcript_id": "tr_31ab…" }`. Response `200` with the saved intake. Only allowed while status is `scheduled` or `queued`.

### `POST /encounters/{id}/start` · D · 🔒audit
Screen: Doctor queue (Start consultation). Moves `queued/scheduled → in_progress`, sets `start_time`, creates the RTC room. Response `200 { "status": "in_progress", "rtc": { "session_id": "…" } }`. Errors: `409 ALREADY_STARTED`, `422 CONSENT_REQUIRED`.

### `POST /encounters/{id}/end` · D/P
Ends the call and sets `end_time`. Does **not** mark the encounter `completed` — only `sign-off` does that (the note must be approved first, per the NMC rule in your repo). Response `200 { "status": "in_progress", "call_ended": true }`.

### `POST /encounters/{id}/cancel` · P/R/D
Only while `scheduled/queued`. `200 { "status": "cancelled" }`.

### `POST /encounters/{id}/vitals` · D
Request `{ "temperature_f": 102, "bp_systolic": 130, "bp_diastolic": 85, "pulse": 92 }` (all optional). `200`. Stored in `vitals_json`, used by the scribe and the summary card.

---

## 9. Doctor workspace data

### `GET /doctors/me/dashboard` · D
Screen: Doctor queue.
```json
{
  "counters": { "waiting": 3, "upcoming": 8, "pending": 2 },
  "next_patient": {
    "encounter_id": "…", "patient": { "display_name": "Kamla Devi", "age": 68, "sex": "female" },
    "chips": [ {"type":"urgency","label":"High fever","level":"high"}, {"type":"allergy","label":"Penicillin allergy","level":"high"} ]
  }
}
```
`allergy` chips appear only if encounter consent is `allowed`.

### `GET /doctors/me/queue?status=waiting|upcoming|pending` · D
```json
{ "items": [
  { "encounter_id": "…", "patient": {"display_name":"Rajesh Kumar","age":24}, "complaint": "Chest pain",
    "urgency": "follow_up", "triage_alert_flag": false, "waiting_minutes": 18 }
] }
```
Sorted: `triage_alert_flag` first, then `high`, then `follow_up`, then `routine`, then waiting time.

### `GET /encounters/{id}/patient-summary` · D · 🔒audit
Screen: Workspace → Patient tab.
```json
{
  "patient": { "display_name": "Kamla Devi", "age": 68, "sex": "female", "abha_masked": "91-••••-••••-1928", "language": "kn" },
  "allergies": [ { "substance": "Penicillin", "drug_class": "penicillin", "severity": "severe" } ],
  "current_medications": [ { "name": "Metformin", "strength": "500mg" } ],
  "vitals": { "temperature_f": 102, "bp": "130/85" },
  "last_visit": "2026-09-14",
  "symptoms": { "text": "Fever for 3 days", "codes": ["fever"] }
}
```
Errors: `422 CONSENT_REQUIRED`, `403 NOT_YOUR_ENCOUNTER`.

### `GET /encounters/{id}/patient/records` · D · 🔒audit
Record **metadata only** (title, type, date). No file access, no URLs. Lets the doctor choose what to request. Items include `record_id, title, record_type, created_at, access: "locked"|"granted"`.

---

## 10. Video call (adaptive network)

**Tiers** (from your network engine doc): 1 HD video, 2 low-res, 3 audio priority, 4 store-and-forward.

### `POST /rtc/sessions` · P/R/D
Request `{ "encounter_id": "…" }`
Response `201`
```json
{
  "session_id": "…",
  "ws_url": "wss://api.swasthyasetu.example/ws/rtc/…",
  "ice_servers": [ {"urls":["stun:…"]}, {"urls":["turn:…"],"username":"…","credential":"…"} ],
  "credential_ttl": 3600,
  "initial_tier": 1,
  "role_in_call": "callee"
}
```
Rules: TURN credentials are short-lived and per user. The encounter must be `in_progress` (doctor started it) and the encounter consent `allowed`. Errors: `409 CALL_NOT_STARTED`, `403 NOT_A_PARTICIPANT`.

### `WS /ws/rtc/{encounter_id}?token=<access_jwt>`
Signalling only; media goes peer to peer or via TURN. Message envelope `{ "type": "...", "data": {...} }`.

| Direction | `type` | `data` |
|---|---|---|
| client → server | `offer`, `answer` | `{ "sdp": "…" }` |
| client → server | `ice_candidate` | `{ "candidate": {...} }` |
| client → server | `network_report` | `{ "rtt_ms": 420, "packet_loss_pct": 12, "bitrate_kbps": 210 }` |
| server → client | `peer_joined`, `peer_left` | `{ "role": "doctor" }` |
| server → client | `tier_change` | `{ "tier": 3, "mode": "audio", "reason": "packet_loss_gt_20" }` |
| server → client | `consent_requested` | `{ "consent_id": "…", "record_title": "Ultrasound", "purpose": "Kidney stone check", "duration_minutes": 60 }` |
| server → client | `consent_decided`, `consent_revoked` | `{ "consent_id": "…", "status": "approved" }` |
| server → client | `error` | `{ "code": "…" }` |

Rules: JWT checked on connect; room allows exactly one doctor and one patient (or their representative); idle timeout 60 seconds; server stores tier history in Redis for the session only.

### `POST /rtc/{encounter_id}/network-report` · P/R/D
HTTP fallback for the same data as the `network_report` message (used when the socket is down).
Request `{ "rtt_ms": 2100, "packet_loss_pct": 35, "bitrate_kbps": 12, "ice_state": "disconnected" }`
Response `200 { "tier": 4, "mode": "store_and_forward", "message_key": "network.offline" }`
Rules: server applies the thresholds from the repo (loss > 20% or RTT > 1200ms → Tier 3; ICE disconnected or RTT > 2000ms for 5s → Tier 4; recovery needs sustained improvement).

### `POST /encounters/{id}/async-messages` · P/R/D · idem
Tier 4 voice or text message that is delivered later.
Request: `multipart/form-data` with `audio` (max 64 KB per chunk) and optional `text`, plus `client_ts`.
Response `201 { "message_id": "…", "status": "queued" }`. The other party receives a `ws` event `async_message` or a push notification.

### `GET /encounters/{id}/async-messages?after=<message_id>` · P/R/D
Returns messages in order. Audio is fetched through this authenticated API, not through public URLs.

### `WS /ws/captions/{encounter_id}` · optional
Realtime captions and translation (for example doctor speaks English → patient sees Kannada). Server sends `{ "speaker": "doctor", "text": "…", "translated_text": "…", "language": "kn", "final": true }`. Disabled when tier ≥ 3.

---

## 11. Records and consent

**Consent state machine:** `requested → approved → (active) → expired | revoked`; `requested → declined`. Pending requests expire after 5 minutes.
**Rule:** a consent screen alone is not security. Every byte of a record is checked against the Redis grant key.

### `GET /patients/me/records` · P/R
Screen: **My Records**.
```json
{ "items": [
  { "record_id": "…", "title": "Blood test", "record_type": "blood_panel", "created_at": "2026-10-12T00:00:00Z",
    "protection": "protected",
    "currently_visible_to": [ { "practitioner_id": "…", "display_name": "Dr. Meena Rao", "expires_at": "2026-10-21T06:00:00Z" } ] }
] }
```
`currently_visible_to` is empty ("Only you") unless an active consent exists.

### `POST /patients/me/records` · P/R · multipart · 🔒audit
Upload a report.
Request: `file` (PDF/JPEG/PNG, max 20 MB), `title`, `record_type` (`blood_panel|ultrasound|xray|prescription|other`).
Response `201` `{ "record_id": "…", "title": "…", "protection": "protected" }`
Rules: server checks mime and magic bytes, virus-scans, encrypts with AES-256-GCM using the patient's key id, stores in the private bucket, writes `record_metadata`. The client never receives a storage URL. Errors: `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_TYPE`, `422 MALWARE_DETECTED`.

### `GET /records/{id}` · P/R
Metadata only (no file bytes). Doctors cannot call this route; they use `/encounters/{id}/patient/records`.

### `GET /records/{id}/stream` · P/R (own) · D (grant required) · 🔒audit
From the repo.
- **Patient or representative:** `Authorization` only.
- **Doctor:** `Authorization` **and** `X-Consent-Token`.

Supports `Range`. Success `206 Partial Content` (or `200`) with `Content-Type` = stored mime, `Cache-Control: no-store`, `Content-Disposition: inline` (`attachment` only if the consent scope is `download`).
Checks on **every chunk**: JWT valid → token HMAC valid → `token_hash` key present and `ACTIVE` in Redis → `record_id` in the token equals the path → doctor in the token equals the caller. If the key disappears mid-stream the connection is closed.
Errors: `403 CONSENT_REQUIRED`, `403 CONSENT_REVOKED`, `410 CONSENT_EXPIRED`, `404 RECORD_NOT_FOUND`. Every attempt, successful or denied, writes an audit row.

### `DELETE /records/{id}` · P · 🔒audit
Patient erasure (DPDP). Soft-deletes metadata, schedules object and key deletion, revokes any active consent on it. `204`.

### `POST /consents/request` · D · idem · 🔒audit
From the repo. Screen: doctor asks for a report during the call.
Request
```json
{
  "encounter_id": "…", "record_id": "…",
  "purpose": "Kidney stone check", "duration_minutes": 60, "scope": "read_only"
}
```
Response `201`
```json
{ "consent_id": "…", "status": "requested", "request_expires_in": 300, "patient_notified": true }
```
Validation: doctor assigned to the encounter and it is `in_progress`; the record belongs to the encounter's patient; `duration_minutes` in `[60,120,1440]`; `purpose` 3–255 characters; no other pending request for the same record (`409 REQUEST_PENDING`). Pushes `consent_requested` to the patient by WebSocket (and push notification if the socket is down).

### `GET /consents?role=patient|doctor&status=requested|approved|declined|revoked|expired` · P/R/D
Lists consents visible to the caller. A patient uses `status=requested` to find a pending request after reconnecting.

### `GET /consents/{id}` · P/R/D (party)
```json
{
  "consent_id": "…", "status": "requested",
  "practitioner": { "display_name": "Dr. Meena Rao", "registration_number": "KMC-48213", "verified": true },
  "record": { "record_id": "…", "title": "Ultrasound" },
  "purpose": "Kidney stone check", "duration_minutes": 60,
  "expires_at": null, "notice_audio_text": "Dr. Meena Rao wants to see your ultrasound report for a kidney stone check, for one hour."
}
```
`expires_at` is set when approved.

### `POST /consents/{id}/decision` · P/R · idem · 🔒audit
From the repo. Screen: **Report request** (Yes, show it / No).
Request `{ "decision": "approved" }` or `{ "decision": "declined" }`
Response `200`
```json
{ "consent_id": "…", "status": "approved", "expires_at": "2026-10-21T05:45:00Z" }
```
Rules: only the patient or an active representative may decide (never the doctor); if the pending window passed → `410 REQUEST_EXPIRED`. On approval the server builds the HMAC-SHA256 grant token (payload in section 11.1), sets `token:<hash> = ACTIVE` in Redis with TTL = `duration`, and pushes `consent_decided` to the doctor. **The token is never returned to the patient's client.**

### `GET /consents/{id}/grant` · D · 🔒audit
Fallback for the doctor if the WebSocket event was missed. Returns the token once per consent while it is active.
Response `200 { "consent_token": "eyJ…", "expires_at": "2026-10-21T05:45:00Z", "scope": "stream_only" }`
Errors: `403 NOT_APPROVED`, `410 CONSENT_EXPIRED`.

### `POST /consents/{id}/revoke` · P/R · 🔒audit
From the repo. Request `{}`. Deletes the Redis key immediately, sets status `revoked`, pushes `consent_revoked` to the doctor; any open stream ends. Response `200 { "status": "revoked", "revoked_at": "…" }`. Always allowed, no reason needed (DPDP right to withdraw).

### `POST /consents/revoke-all` · P/R · 🔒audit
Screen: Access history (Stop all access) — and the "Stop" button on a single entry uses the route above.
Response `200 { "revoked_count": 2 }`.

### `GET /patients/me/access-history?range=today|week|all&limit=20&cursor=` · P/R
Screen: **Who saw my records**. Built from `consents` and `audit_events`.
```json
{ "items": [
  { "consent_id": "…", "practitioner": {"display_name":"Dr. Rao","photo_asset":"dr_rao"},
    "record": {"title":"Blood report"}, "purpose": "Consultation",
    "viewed_at": "2026-10-21T04:42:00Z", "status": "active", "expires_at": "2026-10-21T05:42:00Z" },
  { "consent_id": "…", "practitioner": {"display_name":"Dr. Sharma"}, "record": {"title":"Prescription"},
    "purpose": "Follow-up", "viewed_at": "2026-10-20T10:15:00Z", "status": "expired", "expires_at": "2026-10-20T11:15:00Z" }
], "next_cursor": null }
```

### 11.1 Consent grant token payload
```json
{
  "token_type": "swasthyasetu_consent_grant",
  "consent_id": "…", "practitioner_id": "…", "patient_id": "…", "record_id": "…",
  "purpose": "Kidney stone check", "access_scope": "stream_only",
  "issued_at": 1792564200, "expires_at": 1792567800,
  "nonce": "…", "hmac_signature": "…"
}
```
Redis: `SET token:<sha256(token)> "ACTIVE" EX <seconds>`. Revoke = `DEL`. HMAC secret is rotated and kept outside the database.

---

## 12. Clinical note, AI scribe, drug safety, sign-off

Screens: **Workspace** (AI draft rows with tick and pencil), **Safety alert**.
**Rule from your repo (NMC):** AI only transcribes and structures. A deterministic engine checks safety. A doctor must review and sign. The backend refuses `completed` without a signed, approved note.

### `POST /encounters/{id}/transcripts` · D · 🔒audit
Adds consultation text (or a transcript produced by the STT route) for the scribe to use.
Request `{ "segments": [ { "speaker": "doctor", "text": "…", "ts": 12.4 }, { "speaker": "patient", "text": "…", "ts": 15.0 } ], "language": "kn" }`
Response `201 { "transcript_id": "tr_9aa1…", "segment_count": 2 }`. Transcripts are stored per encounter and deleted after 30 days unless the clinic policy keeps them.

### `POST /encounters/{id}/ai-draft` · D · 🔒audit
From the repo. Request
```json
{ "transcript_id": "tr_9aa1…", "language": "en", "wait": false }
```
Response `202 { "job_id": "job_c4…", "note_status": "generating" }`. With `"wait": true` the server waits up to 20 seconds and returns `200` with the note instead.
The draft arrives as a WebSocket event `note_draft_ready` and from `GET /encounters/{id}/note`. Errors: `409 NOTE_ALREADY_APPROVED`, `422 EMPTY_TRANSCRIPT`, `504 AI_TIMEOUT`.

### `GET /encounters/{id}/note` · D (own encounter)
```json
{
  "note_status": "under_review",
  "ai_generated": true,
  "requires_review": true,
  "fields": {
    "complaint":  { "value": "Fever, 3 days",        "state": "confirmed" },
    "diagnosis":  { "value": "Viral infection",      "state": "confirmed" },
    "medicine":   { "value": [ {"drug":"Paracetamol","strength":"650mg","frequency":"TDS","duration":"3 days"},
                                {"drug":"Amoxicillin","strength":"500mg","frequency":"BD","duration":"5 days"} ],
                    "state": "pending", "alerts": ["alert_81…"] },
    "advice":     { "value": "Rest and water",       "state": "pending" },
    "follow_up":  { "value": "3 days",               "state": "pending" }
  },
  "pending_count": 3,
  "blocking_alerts": 1,
  "can_sign_off": false
}
```
Field `state` is `pending` or `confirmed`. This is the data behind the prototype's "AI draft. 3 to review." banner and the disabled **Complete consultation** button.

### `PATCH /encounters/{id}/note` · D · 🔒audit
Edit one or more fields. Request `{ "fields": { "advice": "Rest, plenty of water, light food" } }`. Editing a field resets its state to `pending` and records `edited_by_doctor: true`. If `medicine` changes the server re-runs the safety check and returns the updated alerts.

### `POST /encounters/{id}/note/fields/{field}/confirm` · D · 🔒audit
The tick button. `field` is one of `complaint, diagnosis, medicine, advice, follow_up`. Response `200 { "field": "medicine", "state": "confirmed", "pending_count": 2 }`. Confirming `medicine` fails with `409 UNACKNOWLEDGED_ALERT` while a blocking alert is unacknowledged.

### `POST /ddi/check` · D
Deterministic safety engine (no LLM). Stateless check used live while the doctor adds drugs, and called again before sign-off.
Request
```json
{
  "encounter_id": "…",
  "proposed_drugs": [ { "name": "Amoxicillin", "strength": "500mg" } ]
}
```
The server loads the patient's allergies and current medicines from the encounter, so the client cannot omit them.
Response `200`
```json
{
  "checked_at": "2026-10-21T05:20:00Z",
  "alerts": [
    {
      "alert_id": "alert_81…",
      "type": "allergy",
      "severity": "high",
      "blocking": true,
      "drug": "Amoxicillin",
      "allergen": "Penicillin",
      "reason_code": "SAME_DRUG_CLASS",
      "message": "Amoxicillin is a penicillin. This patient is allergic to penicillin.",
      "message_localized": "…",
      "citation": "National Formulary of India",
      "suggested_action": "Choose a non-penicillin antibiotic"
    }
  ],
  "safe": false
}
```
Alert types: `allergy` (drug class matches a recorded allergy) and `interaction` (drug pair from the seeded rules: severity `critical|high|moderate`). Allergy alerts come first in the list. Each alert carries a citation.
Errors: `422 UNKNOWN_DRUG` (include the unknown name; the doctor can still proceed with an "unverified" flag that appears in the audit log).

### `POST /encounters/{id}/ddi-acknowledgements` · D · idem · 🔒audit
The doctor consciously overrides a blocking alert (**Continue anyway**).
Request `{ "alert_id": "alert_81…", "action": "override", "reason": "Patient tolerated amoxicillin in 2024; allergy was a rash only.", "confirmed": true }`
`action` is `override` or `replace` (`replace` is used when the doctor removed the drug). `reason` is required for `override`, at least 10 characters. Response `200 { "alert_id": "…", "state": "acknowledged" }`. The acknowledgement is stored with doctor, time, and `ip_hash`.

### `POST /encounters/{id}/sign-off` · D · idem · 🔒audit
From the repo. Screen: Workspace (**Complete consultation**).
Request
```json
{
  "verified_clinical_appropriateness": true,
  "acknowledged_alert_ids": ["alert_81…"],
  "reauth": { "method": "password", "credential": "••••••••" }
}
```
Preconditions, all checked server side:
1. every note field is `confirmed`,
2. every blocking alert has an acknowledgement (or the drug was replaced and the check passes again),
3. `verified_clinical_appropriateness` is `true`,
4. `reauth` succeeds.

Response `200`
```json
{
  "encounter_status": "completed",
  "note_status": "clinician_approved",
  "signed_at": "2026-10-21T05:31:12Z",
  "note_hash": "sha256:…",
  "care_plan_ready": true,
  "fhir_bundle_available": true
}
```
Failure `409 SIGNOFF_BLOCKED` with the reasons: `{ "pending_fields": ["advice"], "unacknowledged_alerts": ["alert_81…"] }`.
Side effects: signs the note hash with the practitioner's key, sets `clinical_notes.status = 'clinician_approved'`, closes the encounter, schedules the 24h and 48h follow-ups, prepares the patient's care plan and translations, and sends the patient a push or SMS.

---

## 13. Care plan and export

### `GET /encounters/{id}/care-plan` · P/R (own), D (author)
Screen: **Care plan**. Only available after sign-off (`404 CARE_PLAN_NOT_READY` before).
```json
{
  "encounter_id": "…",
  "doctor": { "display_name": "Dr. Meena Rao", "registration_number": "KMC-48213" },
  "issued_at": "2026-10-21T05:31:12Z",
  "medicines": [
    {
      "drug": "Paracetamol", "strength": "650mg", "form": "tablet",
      "schedule": { "morning": 1, "afternoon": 1, "night": 1 },
      "with_food": "after", "duration_days": 3
    }
  ],
  "next_dose": { "slot": "afternoon", "at": "2026-10-21T13:00:00+05:30", "drug": "Paracetamol" },
  "advice": [ { "icon": "rest", "label": "Rest" }, { "icon": "water", "label": "Water" }, { "icon": "light_food", "label": "Light food" } ],
  "red_flags": "Go to the nearest hospital if fever lasts more than 3 days or breathing becomes difficult.",
  "follow_up": { "follow_up_id": "…", "due_at": "2026-10-23T05:31:12Z" },
  "language": "en",
  "audio_available": true
}
```
Drug names and strengths are never translated. `schedule` drives the sun / half-sun / moon icons.

### `GET /encounters/{id}/care-plan/audio?lang=kn` · P/R · 🔒audit
Streams spoken advice (audio/mpeg), generated through the TTS adapter and cached encrypted for 24 hours. **No public URL**: the client plays it from this authenticated route. `404 AUDIO_NOT_READY`, `504 TTS_TIMEOUT`.

### `GET /encounters/{id}/fhir-bundle` · D (author), P/R (own) · 🔒audit
`Content-Type: application/fhir+json`. A FHIR R4 `Bundle` of type `document` containing `Patient`, `Practitioner`, `Encounter`, `Consent`, `Condition`, `MedicationRequest` (mapping in `docs/02_data/fhir_r4_mappings.md`). Only after sign-off.

### `POST /encounters/{id}/abdm/share` · D · idem · 🔒audit
Pushes the signed record to the patient's ABHA through the ABDM adapter. Requires the patient's ABHA to be linked and an ABDM consent artefact. Response `202 { "share_id": "…", "status": "pending" }`. Check the current ABDM requirements before building (HIP registration).

---

## 14. AI routes

All AI features follow the same rules:
- **AI never prescribes and never diagnoses autonomously.** Outputs are drafts labelled `ai_generated: true, requires_review: true`.
- **The deterministic engine in section 12 is the only safety authority.**
- **Minimise PHI** sent to the model: no name, ABHA, phone or address.
- **Transcripts and user text are data, not instructions** (prompt-injection safe: they are placed in a delimited field and the model's output is validated against a JSON schema).
- Every AI call is recorded in an `ai_runs` table (model, version, prompt hash, latency, token counts, encounter id) without storing the raw text.
- The LLM provider sits behind one interface (`llm_client`) and is configured by environment variable.
- If the model times out or returns invalid JSON, return `504 AI_TIMEOUT` / `502 AI_INVALID_OUTPUT`. The UI keeps working without AI.

### `GET /ai/jobs/{job_id}` · owner
Status of an async AI call.
```json
{ "job_id": "job_c4…", "kind": "scribe_draft", "status": "succeeded", "result_ref": "/api/v1/encounters/…/note", "error": null }
```
`status`: `queued | running | succeeded | failed`.

### `POST /ai/symptom-triage` · P/R
Screen: Intake → sets the urgency chip. Suggests an **urgency level**, not a diagnosis.
Request
```json
{ "encounter_id": "…", "symptom_codes": ["fever","breathing_difficulty"], "free_text": "Fever for 3 days", "age": 68, "language": "en" }
```
Response `200`
```json
{
  "urgency": "high",
  "reasons": ["Fever with age 65 or above"],
  "red_flag_detected": false,
  "recommended_action": "see_doctor_today",
  "disclaimer_key": "ai.not_a_diagnosis"
}
```
`recommended_action`: `self_care | see_doctor_today | see_doctor_now | call_emergency`. If `red_flag_detected` is `true` (for example chest pain with breathlessness) the response is `urgency: emergency`, `recommended_action: call_emergency`, and the client shows the Emergency screen. Red flags use a **rule list first**, then the model, so the safest path never depends on the model.

### `POST /ai/explain-medicine` · P/R
Plain-language explanation of a prescribed medicine for the care plan.
Request `{ "drug": "Paracetamol", "strength": "650mg", "language": "kn" }`
Response `200 { "summary": "…", "how_to_take": "…", "common_side_effects": ["…"], "when_to_get_help": "…", "source": "National Formulary of India", "ai_generated": true }`
Rules: the text is built from formulary entries; the model only simplifies wording; drug name unchanged.

### `POST /ai/assistant/chat` · P/R · optional (feature flag `assistant_chat`)
New scope, not in your repo docs; keep disabled for the first demo. Request `{ "session_id": "…", "message": "I took the tablet but still have fever", "language": "en" }`. Response is a Server-Sent Events stream (`text/event-stream`) of `delta` events and a final `done` event with `{ "suggested_actions": [ {"type":"book_consultation"} ] }`. Guardrails: no dosing instructions, no diagnoses, always includes the emergency escalation rule, and the red-flag rule list runs on every message.

(The scribe draft route is `POST /encounters/{id}/ai-draft` in section 12.)

---

## 15. Language and voice (Bhashini adapter)

### `POST /translate`
Request
```json
{ "text": "Take Amoxicillin 500mg after food", "source": "en", "target": "kn", "protect_terms": true }
```
Response `200 { "translated_text": "…", "protected_terms": ["Amoxicillin 500mg"], "engine": "bhashini" }`
Rules: terms from the drug list and any dosage pattern are masked before translation and restored after (never translate drug names). Max 2000 characters. `504 TRANSLATION_TIMEOUT` — client shows the English text with a "Translation unavailable" chip.

### `POST /tts`
Request `{ "text": "…", "language": "kn", "voice": "female" }`. Response `200 audio/mpeg` stream. Max 1000 characters; results of generic UI text can be cached, results containing patient data are not cached. Fallback when Bhashini is down: the client uses the device's speech synthesis.

### `POST /stt` · multipart
Request `audio` + `language`. Response `{ "transcript": "…", "confidence": 0.91 }`. Audio is deleted after processing. (The Intake route `POST /intake/voice` wraps this.)

### `GET /i18n/glossary?lang=kn` · public
The verified clinical glossary (term → vernacular text) from your multilingual doc. Cacheable (`ETag`).

---

## 16. Follow-up and reminders

### `GET /patients/me/follow-ups?status=pending` · P/R
```json
{ "items": [ { "follow_up_id": "…", "encounter_id": "…", "day": 3, "total_days": 5, "due_at": "2026-10-23T05:31:12Z", "doctor": {"display_name":"Dr. Meena Rao"} } ] }
```

### `POST /follow-ups/{id}/response` · P/R · idem · 🔒audit
Screen: **Follow-up** (Better / Same / Need help).
Request `{ "response": "better" }` — `better | same | need_help`.
Response `200`
```json
{
  "follow_up_id": "…", "status": "responded", "response": "need_help",
  "triage_alert_flag": true,
  "next_actions": [ {"type":"call_clinic","label":"Call the clinic"}, {"type":"find_care","label":"Find nearest care"} ]
}
```
For `need_help`, the encounter's `triage_alert_flag` becomes `true` and the doctor's queue shows it first (data pipelines doc). For `better`, `next_actions` is empty. `same` again after a second check prompts the doctor to review.

### `POST /follow-ups/{id}/reschedule` · P/R
Request `{ "due_at": "2026-10-24T05:00:00Z" }`. Allowed at most twice. `200`.

### `GET /reminders` · P/R, `POST /reminders` · P/R, `DELETE /reminders/{id}` · P/R
Screen: Care plan (**Set reminders**).
`POST` request `{ "encounter_id": "…", "medication_ids": ["…"], "channels": ["push","sms"], "times": {"morning":"08:00","afternoon":"13:00","night":"21:00"} }`.
Response `201 { "reminder_id": "…", "next_fire_at": "…" }`. The reminder text contains only the drug name and time, no diagnosis.

### `POST /webhooks/messaging` · S
Inbound SMS/WhatsApp quick replies (for example the `Need Doctor Help` button). Verifies the provider's signature header before doing anything (`401` otherwise), maps the reply to the follow-up, and applies the same logic as `/follow-ups/{id}/response`. Always returns `200` quickly and processes in a background worker.

---

## 17. Emergency

Screen: **Emergency**. This group must stay simple and fast, and work on a weak network.

### `POST /emergency/alerts` · P/R · idem · 🔒audit
Triggered by "Tell my family" or by the app after a red flag.
Request
```json
{ "reason": "patient_pressed_sos", "latitude": 15.8497, "longitude": 74.4977, "share_location": true }
```
Response `201`
```json
{
  "alert_id": "…",
  "notified": { "family_contacts": 2, "clinic": true },
  "nearest_facilities": [ { "name": "…", "distance_km": 3.2, "phone": "…", "open_24h": true } ]
}
```
Rules: location is optional and used only when the user shares it; the alert message is sent by SMS in the contact's language; rate limit 3 per hour per user to prevent misuse. **Calling 108 is a phone-dial link on the device, not an API call**, so it works with no network.

### `GET /emergency/facilities/nearby?lat=15.8497&lng=74.4977&radius_km=20&limit=5` · P/R
Returns facilities from the maintained list or a places provider: `name, distance_km, phone, open_24h, address, location`. Cache for 10 minutes.

### `GET /patients/me/emergency-contacts` · P/R, `POST` · P/R, `DELETE /patients/me/emergency-contacts/{id}` · P/R
`POST` request `{ "name": "Sunita Devi", "relationship": "daughter", "mobile": "+919812345678", "language": "kn" }`. Contacts are not given access to health records.

### `GET /emergency/numbers` · public
`{ "ambulance": "108", "national_emergency": "112" }`. Also bundled into the client for offline use.

---

## 18. Realtime events and notifications

### `WS /ws/events?token=<access_jwt>`
One socket per signed-in user for events outside a call.

| `event` | Receiver | `data` |
|---|---|---|
| `consent_requested` | P/R | `{ consent_id, practitioner, record_title, purpose, duration_minutes }` |
| `consent_decided` | D | `{ consent_id, status }` |
| `consent_revoked` | D | `{ consent_id }` |
| `encounter_status` | P/R/D | `{ encounter_id, status }` |
| `note_draft_ready` | D | `{ encounter_id, job_id }` |
| `care_plan_ready` | P/R | `{ encounter_id }` |
| `follow_up_due` | P/R | `{ follow_up_id }` |
| `triage_alert` | D | `{ encounter_id, patient_display_name }` |
| `async_message` | P/R/D | `{ encounter_id, message_id }` |

Envelope `{ "event": "consent_requested", "id": "evt_…", "ts": "…", "data": { … } }`. The server redelivers events missed during a reconnect when the client sends `{ "type": "resume", "last_event_id": "evt_…" }` (kept 10 minutes in Redis).

### `GET /notifications?limit=20&cursor=` · P/R/D
In-app history of the events above, localised text. `POST /notifications/{id}/read` marks one read.

### `POST /devices/push-token` · P/R/D
Request `{ "token": "…", "platform": "android|web", "language": "kn" }`. `204`. Push payloads never contain medical details (only "You have a new request").

---

## 19. Admin, audit and external callbacks

### `POST /admin/practitioners/{id}/verify-nmc` · A · 🔒audit
Runs the National Medical Commission registry check through the adapter and sets `credential_status`. Response `200 { "credential_status": "verified", "checked_at": "…" }`. A doctor cannot log in until this is `verified`.

### `GET /audit/events?actor_id=&resource_id=&from=&to=&limit=50` · A (all) · P (own records only)
Read-only. The table is append-only (triggers block update and delete) and each row carries a hash of the previous row.

### `POST /webhooks/abdm` · S
ABDM callbacks (ABHA verification results, consent artefacts, data-transfer notifications). Verify the gateway signature first; unknown callback types return `200` and are logged by `request_id` only.

---

## 20. Screen → route map (Stitch prototype)

| # | Screen | Routes called |
|---|---|---|
| 01 | Welcome | `GET /meta/app-config` |
| 02 | Language | `PATCH /me/language` (after login) or local storage before login; `GET /i18n/glossary`; `POST /tts` for the Listen pill |
| 03 | Login | `POST /auth/abha/initiate` → `/auth/abha/verify`, or `POST /auth/otp/request` → `/auth/otp/verify` |
| 04 | Consent | `GET /encounters/{id}/consent-notice`, `POST /tts`, `POST /encounters/{id}/consent` |
| 05 | Intake | `POST /intake/voice`, `GET/POST /patients/me/allergies`, `GET/POST /patients/me/medications`, `POST /ai/symptom-triage`, `PATCH /encounters/{id}/intake` |
| 06 | Home | `GET /patients/me/home`, `WS /ws/events` |
| 07 | Video | `POST /rtc/sessions`, `WS /ws/rtc/{id}`, `POST /rtc/{id}/network-report`, `POST /encounters/{id}/end` |
| 08 | Report request | event `consent_requested`, `GET /consents/{id}`, `POST /consents/{id}/decision` |
| 09 | Care plan | `GET /encounters/{id}/care-plan`, `GET …/care-plan/audio`, `POST /reminders` |
| 10 | Follow-up | `GET /patients/me/follow-ups`, `POST /follow-ups/{id}/response`, `POST /follow-ups/{id}/reschedule` |
| 11 | Emergency | `POST /emergency/alerts`, `GET /emergency/facilities/nearby`, `GET /emergency/numbers` |
| 12 | Records | `GET /patients/me/records`, `POST /patients/me/records`, `POST /consents/{id}/revoke` |
| 13 | Access history | `GET /patients/me/access-history`, `POST /consents/{id}/revoke`, `POST /consents/revoke-all` |
| 14 | Doctor queue | `POST /auth/practitioner/login` → `/auth/mfa/verify`, `GET /doctors/me/dashboard`, `GET /doctors/me/queue`, `POST /encounters/{id}/start` |
| 15 | Workspace | `GET /encounters/{id}/patient-summary`, `POST /rtc/sessions`, `POST /consents/request`, `GET /consents/{id}/grant`, `GET /records/{id}/stream`, `POST /encounters/{id}/ai-draft`, `GET/PATCH /encounters/{id}/note`, `POST …/note/fields/{field}/confirm`, `POST /encounters/{id}/sign-off` |
| 16 | Safety alert | `POST /ddi/check`, `POST /encounters/{id}/ddi-acknowledgements` |
| 17 | Kannada Home | Same routes as 06 with `Accept-Language: kn` |

---

## 21. Seed data for demo and tests

| Entity | Value |
|---|---|
| Doctor | Dr. Meena Rao, General Physician, registration `KMC-48213`, verified |
| Patient | Kamla Devi, 68, female, language `kn`, ABHA `91-4820-1928-1120` |
| Other queue patients | Rajesh Kumar, 24, chest pain, follow-up; Sunita Patil, 42, sugar check, routine |
| Allergy | Penicillin (class `penicillin`, severity severe) |
| Current medicine | Metformin 500mg |
| Drug classes | Amoxicillin → penicillin; Ampicillin → penicillin; Paracetamol → analgesic |
| Interaction rules | the four seeded pairs in `docs/04_features_and_engines/ddi_safety_engine.md` |
| Records | Blood test (12 Oct), Chest X-ray (28 Sep), Prescription (14 Sep) |
| Consent history | Dr. Rao (active), Dr. Sharma (expired), Dr. Verma (expired) |

Demo script test: add Amoxicillin → `POST /ddi/check` returns the blocking allergy alert → `sign-off` fails with `SIGNOFF_BLOCKED` → doctor replaces the drug (or overrides with a reason) → `sign-off` succeeds → care plan appears on the patient side.

---

## 22. Error code catalogue

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Field missing or wrong format; `details.fields` lists them |
| `UNAUTHENTICATED` | 401 | Missing or expired token |
| `TOKEN_REUSED` | 401 | Refresh token was reused; session revoked |
| `FORBIDDEN` | 403 | Role not allowed |
| `NOT_YOUR_ENCOUNTER` | 403 | Doctor not assigned to this encounter |
| `CREDENTIAL_NOT_VERIFIED` | 403 | Doctor's NMC check not complete |
| `CONSENT_REQUIRED` | 403 / 422 | No encounter or record consent |
| `CONSENT_REVOKED` | 403 | Patient revoked access |
| `CONSENT_EXPIRED` | 410 | Access window ended |
| `REQUEST_EXPIRED` | 410 | Pending consent request timed out |
| `OTP_INVALID`, `OTP_EXPIRED` | 400, 410 | Wrong or old OTP |
| `ABHA_NOT_FOUND` | 404 | No such ABHA |
| `RECORD_NOT_FOUND` | 404 | Also returned when the record is not visible to the caller |
| `ACTIVE_ENCOUNTER_EXISTS` | 409 | Patient already has an open encounter |
| `REQUEST_PENDING` | 409 | A consent request for this record is already pending |
| `CALL_NOT_STARTED` | 409 | RTC session requested before doctor started |
| `NOTE_ALREADY_APPROVED` | 409 | Note signed; no edits |
| `UNACKNOWLEDGED_ALERT` | 409 | Blocking safety alert not handled |
| `SIGNOFF_BLOCKED` | 409 | Pending fields or alerts; details listed |
| `UNKNOWN_DRUG` | 422 | Drug not in formulary data |
| `EMPTY_TRANSCRIPT` | 422 | Nothing to draft from |
| `NO_SPEECH_DETECTED` | 422 | Audio had no usable speech |
| `FILE_TOO_LARGE` / `UNSUPPORTED_TYPE` / `MALWARE_DETECTED` | 413 / 415 / 422 | Upload rejected |
| `RATE_LIMITED` | 429 | Too many requests; `Retry-After` header set |
| `AI_TIMEOUT` / `AI_INVALID_OUTPUT` | 504 / 502 | LLM call failed; UI continues without AI |
| `STT_TIMEOUT` / `TTS_TIMEOUT` / `TRANSLATION_TIMEOUT` | 504 | Bhashini call failed; client falls back |
| `ABDM_UNAVAILABLE` | 502 | ABDM gateway failed |

---

## 23. Suggested build order

1. **Foundation:** `/health`, `/meta/app-config`, auth (`otp`, `refresh`, `me`), `/me/language`, error format, audit writer.
2. **Patient basics:** profile, allergies, medications, `POST /encounters`, `consent-notice`, `consent`, `intake`, `GET /patients/me/home`.
3. **Consent core (your headline feature):** record upload, `consents/request`, `decision`, `grant`, `revoke`, `records/{id}/stream` with Redis token checks, access history, `revoke-all`.
4. **Doctor side:** practitioner login with MFA, dashboard, queue, `start`, `patient-summary`, `patient/records`.
5. **Video:** `/rtc/sessions`, signalling WebSocket, tier changes, `network-report`, async messages.
6. **Clinical:** transcripts, `ai-draft`, note read/edit/confirm, `ddi/check`, acknowledgements, `sign-off`.
7. **After the visit:** care plan, care-plan audio, follow-ups, reminders, emergency.
8. **Integrations:** Bhashini (`translate`, `tts`, `stt`), ABHA login, FHIR export, ABDM share, NMC verify.
9. **Extras:** triage, explain-medicine, captions, assistant chat (flagged off).

For a demo that has to work with limited time, do steps 1 to 3 and 6 first. Those cover login, consent with real enforcement, and the drug-allergy catch, which are the strongest parts of the story.
