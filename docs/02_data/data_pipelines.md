# Real-Time Data Pipelines & Async Event Processing

**Document ID:** DATA-PIPE-CB-2026-V1  
**Project:** CareBridge India  
**Stack:** Redis 7 (Pub/Sub + Streams + TTL), Celery / ARQ (Async Tasks), PostgreSQL 16 (Append-Only Event Store)  

---

## 1. High-Level Data Pipeline Topology

```mermaid
flowchart LR
    subgraph EventProducers["Event Producers"]
        W1["Patient PWA Actions\n(Consent Approve / Revoke)"]
        W2["Doctor Actions\n(Record Request / Sign Note)"]
        W3["WebRTC Probe\n(Bandwidth Stats)"]
    end

    subgraph RealTimeBroker["Redis 7 Broker & State Engine"]
        R_TOKEN["Ephemeral Token Store\n(Key: token:<hash> | TTL: 3600s)"]
        R_PUBSUB["Pub/Sub Event Bus\n(Channel: encounter:<id>:events)"]
        R_STREAM["Audit Event Buffer\n(Stream: audit:stream)"]
    end

    subgraph Workers["Async Background Workers"]
        AUDIT_WORKER["Audit Ingestion Worker\n(Batches SHA-256 logs to PG)"]
        NOTIF_WORKER["Follow-Up Scheduler\n(24h / 48h Cron Reminders)"]
        CLEANUP_WORKER["Storage Janitor\n(Purges expired temporary cache)"]
    end

    subgraph Persistence["Permanent Storage"]
        PG_AUDIT[(PostgreSQL audit_events)]
        PG_TASKS[(PostgreSQL follow_up_tasks)]
    end

    W1 --> R_TOKEN
    W1 --> R_PUBSUB
    W2 --> R_STREAM
    W3 --> R_PUBSUB

    R_STREAM --> AUDIT_WORKER
    AUDIT_WORKER --> PG_AUDIT
    
    NOTIF_WORKER --> PG_TASKS
```

---

## 2. Event Types & Stream Payloads

### 2.1 Consent Life-Cycle Events (`audit:stream`)
```json
{
  "event_id": "evt_771928a0",
  "event_type": "CONSENT_GRANTED",
  "actor_id": "patient_ramesh_kn",
  "actor_role": "patient",
  "resource_id": "usg_pelvis_scan_may2026",
  "purpose": "Acute Flank Pain Assessment",
  "granted_to": "practitioner_ananya_sharma",
  "duration_seconds": 3600,
  "timestamp": "2026-10-02T16:45:00.120Z",
  "ip_hash": "a1b2c3d4e5f6...",
  "user_agent": "Mozilla/5.0 (Android PWA)"
}
```

### 2.2 Follow-Up Automated Reminders Pipeline
1. When an encounter is marked `COMPLETED`, a background job schedules a check-in task at $T + 24\text{h}$ and $T + 48\text{h}$.
2. At the scheduled time, the notification worker dispatches:
   - SMS / WhatsApp interactive template in the patient's language (**Kannada** or **Hindi**).
   - Audio voice link for one-click spoken instruction playback.
3. If the patient replies `[Need Doctor Help 🚨]`, the task is immediately flagged with `triage_alert_flag = true`, pushing a priority notification onto Dr. Ananya's consultation queue.
