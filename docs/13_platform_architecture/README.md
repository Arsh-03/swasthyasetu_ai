# Platform architecture: one backend or many?

**Short answer:** for now, keep one backend organised by module (a *modular monolith*), and run it as a few
**process types** from the same codebase. Don't split into many microservices or a grid system yet. The heavy
work, AI inference, already runs elsewhere (Colab GPU or Gemini). Move to separate services only when a
specific trigger below happens.

## What the backend does today

| Load | Where it runs | Nature |
| :--- | :--- | :--- |
| REST API: auth, records, consent, appointments, notes | FastAPI (async) | Light, mostly waiting on the database |
| WebSockets: call signalling, waiting room, live minutes, chat | FastAPI | Many long-lived, mostly idle connections |
| Speech-to-text (Whisper large-v3) | **Colab GPU** (self-hosted) | Heavy, needs a GPU |
| Language model: autocomplete, CHIBI agent, summaries | **Colab Ollama** or **Gemini / OpenAI** (`ai_client.py`) | Heavy, remote |
| SETU-Shield, note parsing, rule engines, drug safety | FastAPI, in process | About 3 ms per request |
| Partner API (consent layer, de-identification, note parsing) | FastAPI, `/partner/v1` | Light, public, rate-limited |

The backend mostly coordinates: it waits on the database, the network and the AI servers. One async Python
process handles thousands of idle WebSocket connections and hundreds of requests per second for this kind of
work. Managing these AI services from one backend is feasible, because the backend only *calls* them; it
doesn't run them.

## What actually stops it from scaling out

Several things live in one process's memory, so a second copy of the backend wouldn't see them:

| State | Where | Needed to scale out |
| :--- | :--- | :--- |
| Call rooms, waiting room, lobby sockets | `routers/calls.py` `_rooms`, `_lobbies` | Redis pub/sub, or sticky sessions per consultation |
| Live call sessions, transcripts, CHIBI memory | `services/call_minutes.py` `_sessions` | Redis (with expiry), keyed by session |
| Consent grant vault | `services/token_vault.py` | Redis with TTL; the database already keeps the hash |
| Summaries waiting for the patient's answer | `live_assistant.py` `_pending` | Redis with TTL |
| Partner rate-limit counters | `routers/partner.py` `_calls` | Redis counters |
| SETU-Shield request log | `privacy_gateway.py` `LEDGER` | Already audited in the database; move the log to a table |

This is the **real** next step for scale, and it's small: one Redis instance, with no change to how the code
is organised.

## Recommended shape: one codebase, a few process types

```
                    ┌──────────────── one repository, shared models and services ────────────────┐
 Patient app ─┐     │                                                                             │
 Doctor portal┼──►  │  api        REST for both apps (stateless; scale by adding copies)          │
 ASHA app ────┘     │  realtime   WebSockets: calls, waiting room, minutes, chat (sticky / Redis)  │
                    │  workers    CHIBI batches, minutes check, summaries, webhooks (queue)       │
 Partner apps ────► │  partner    /partner/v1 behind its own gateway: keys, quotas, audit        │
                    └──────────────────┬───────────────────────────┬──────────────────────────────┘
                                       │                           │
                              Postgres (Neon)               Redis (state, queue)
                                       │
                         AI servers (outside): Whisper GPU · Ollama · Gemini/OpenAI, only through SETU-Shield
```

- **api** and **partner** are the same FastAPI app, started with a different set of routers. Partner traffic
  then gets its own limits, scaling and firewall rules, and can't slow down the doctors.
- **realtime** keeps the WebSockets. It's the only part that needs sticky routing, or Redis pub/sub once it
  has more than one copy.
- **workers** move slow AI calls (CHIBI batches, minutes checks, summaries, webhooks) off the request path
  into a queue: Redis plus a small worker loop, or Celery/Arq.

## When to split further (triggers, not guesses)

| Trigger | What to split out |
| :--- | :--- |
| Over ~300 concurrent consultations, or call signalling competes with REST latency | `realtime` as its own service (already its own process type) |
| Partners need an SLA, or traffic from partners is a large share of all traffic | `partner` behind an API gateway (Kong / Cloud Run + API Gateway), separate database credentials |
| AI batches queue up during busy hours | More `workers`, and a second GPU or a hosted API as overflow |
| Separate teams own consent and clinical features | A separate **consent service** with its own database. The consent layer is the most self-contained module and the one other organisations use. |
| Regulation requires patient data to stay in one region or with one tenant | Per-tenant databases (the Partner API already identifies the tenant) |

**Not recommended:** a grid or distributed compute system. The compute-heavy part is AI inference. It
already runs on a GPU outside the backend, and adding inference capacity means another GPU worker behind the
same `ai_client`, not a grid.

## API as a service: the Partner API (built)

Code: [`backend/app/routers/partner.py`](../../backend/app/routers/partner.py). Admin:
`python -m app.partner_admin`.

### Schema

| Table | Purpose | Key columns |
| :--- | :--- | :--- |
| `partner_clients` | The organisation | `client_id`, `name`, `org_type`, `webhook_url`, `webhook_secret`, `status` |
| `partner_keys` | API keys; only the SHA-256 is stored | `key_id`, `client_id`, `prefix`, `key_hash`, `scopes_json`, `rate_per_min`, `last_used_at`, `revoked_at` |
| `partner_usage` | One row per call, with no bodies | `client_id`, `key_id`, `route`, `status_code`, `at` |
| `partner_consents` | A partner's purpose-bound request | `consent_id`, `client_id`, `patient_id`, `purpose`, `data_types_json`, `valid_hours`, `status`, `grant_token_hash`, `expires_at`, `external_ref` |

### Endpoints (`X-API-Key: cb_live_<prefix>_<secret>`)

| Method | Endpoint | Scope | What it does |
| :--- | :--- | :--- | :--- |
| `GET` | `/partner/v1/scopes` | none | Scopes, allowed data types, note format version |
| `GET` | `/partner/v1/me` | `consent:read` | Client, scopes, limit, calls in the last 24 h |
| `POST` | `/partner/v1/consents` | `consent:request` | Ask a patient (by ABHA address) for access: purpose, data types, how many hours |
| `GET` | `/partner/v1/consents/{id}` | `consent:read` | Status: requested, approved, declined, revoked or expired |
| `GET` | `/partner/v1/consents/{id}/token` | `consent:read` | The grant token, **once**, after approval (if the partner has no webhook) |
| `POST` | `/partner/v1/consents/verify` | `consent:read` | Is this token valid now, for what purpose and data? Call before every use. |
| `POST` | `/partner/v1/privacy/deidentify` | `privacy:deidentify` | SETU-Shield as a service: masked text, identifier counts, verification result |
| `POST` | `/partner/v1/notes/parse` | `notes:parse` | A consultation note as structured data (prescription, vitals, follow-up) |

### Consent flow

1. The partner sends `POST /consents`.
2. The patient sees the request in the CareBridge app, in the same consent prompt doctors' requests use,
   with the organisation as the requester.
3. **Approve:** the partner gets a webhook `consent.approved` carrying the token (signed
   `X-CareBridge-Signature: sha256=HMAC(body)`), or collects the token once.
4. **Revoke or expire:** `verify` returns `valid: false` with the reason.

Every step is in the audit trail and in the patient's "Who has seen my records" screen.

### Rules

- **Keys:** shown once, stored as a SHA-256 hash, scoped, rate-limited per minute, revocable.
- **No content in usage logs:** only the route, status and time.
- **What partners receive:** consent status and tokens only. Record data itself is released only by a future
  `records:read` scope, which would check the token on every request.
- **De-identification:** never stores the text. `return_map` hands the placeholder map back to the caller,
  who keeps it.

### Not built yet

- A self-service developer portal (for now keys come from `partner_admin`).
- The `records:read` data release.
- Per-tenant data residency.
- Webhook retries with backoff.
