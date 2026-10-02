# Patient & Doctor Portals Feature Specifications

**Document ID:** FEAT-PORTALS-CB-2026-V1  
**Project:** CareBridge India  
**Scope:** Functional Matrix, State Handlers, and Role Views  

---

## 1. Patient Portal Feature Matrix

| Feature | Description | State / Action | Vernacular / Accessibility |
| :--- | :--- | :--- | :--- |
| **Vernacular Switcher** | 1-click toggle between Kannada, Hindi, and English. | Persistent in LocalStorage | Immediate UI text & audio reload |
| **Representative Declaration** | Declares self vs. authorized representative. | Sets `relationship_type` | Clear legal disclaimer |
| **Pre-Consultation Consent** | Reviews privacy terms before starting call. | Signs encounter consent | High-contrast "🔊 Listen" button |
| **Record Manager** | Lists ABDM-linked diagnostic scans. | Default: `PROTECTED` | Shows lock badge and date |
| **Consent Prompt Modal** | Displays doctor's specific request for a scan. | `Approve` or `Decline` | Audio prompt plays automatically on request |
| **Discharge Care Plan** | Shows doctor-signed medications and dietary rules. | Read & Download PDF | Spoken in patient's preferred language |
| **48-Hour Follow-Up** | 3-button interactive response card. | `Better`, `Same`, `Need Help` | Escalates directly to clinic if alert flagged |

---

## 2. Doctor Portal Feature Matrix

| Feature | Description | State / Action | Clinical Safeguard |
| :--- | :--- | :--- | :--- |
| **Consultation Queue** | Live list of waiting patients with ABHA IDs. | `Queued`, `In-Call`, `Finished` | Prioritizes triaged follow-ups |
| **Record Requester** | Selects specific scan, clinical purpose, duration. | Generates HMAC token | Blocks access until patient approves |
| **Decrypted Scan Viewer** | Displays patient's authorized scan on canvas. | Stream via `/api/v1/records` | Auto-closes on 60m token expiration |
| **AI Scribe Editor** | Formats voice dialogue into SOAP draft. | Editable text area | Prohibits unverified finalization |
| **DDI Safety Console** | Real-time drug-drug interaction alerts. | Non-dismissible alert badge | Requires explicit checkbox acknowledgement |
| **1-Click FHIR Export** | Generates ABDM-compatible FHIR Bundle. | Downloads JSON / Bundle | Standard HL7 R4 compliance |
