# CareBridge India (SwasthyaSetu AI)

<div align="center">

![ABDM v2.4 Compliant](https://img.shields.io/badge/ABDM-v2.4%20Compliant-059669?style=for-the-badge&logo=shield)
![DPDP Act 2023](https://img.shields.io/badge/DPDP%20Act%202023-Enforced-4f46e5?style=for-the-badge&logo=lock)
![HL7 FHIR R4](https://img.shields.io/badge/HL7%20FHIR-R4%20Bundle-0284c7?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.12+-009688?style=for-the-badge&logo=fastapi)
![React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20TypeScript-61dafb?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Bundler-Vite-646cff?style=for-the-badge&logo=vite)

**An open, modular, patient-centric digital care & privacy layer built for the Ayushman Bharat Digital Mission (ABDM).**

[Features](#-key-features) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [API & WebSockets](#-api--websocket-endpoints) • [Compliance & Security](#-compliance--security)

</div>

---

## 📖 Executive Summary

Contemporary Indian telemedicine applications face three critical infrastructural bottlenecks:
1. **The Language Barrier:** Over 80% of semi-urban and rural patients struggle to comprehend English discharge summaries, leading to medication non-compliance.
2. **Network Volatility:** Cellular drops across 2G/3G/intermittent 4G rural corridors abruptly terminate WebRTC calls without graceful fallback.
3. **Coarse-Grained Privacy Exploitation:** Traditional platforms enforce "all-or-nothing" blanket data consents. Patients cannot grant time-limited access to a single diagnostic report (e.g., an ultrasound scan for 60 minutes) without exposing their entire lifetime medical history.

**CareBridge India (SwasthyaSetu AI)** solves these challenges through:
- **Audio-First Vernacular Onboarding:** Tri-lingual support in **Kannada (ಕನ್ನಡ)**, **Hindi (हिन्दी)**, and **English**, complete with speech synthesis.
- **Granular, Purpose-Bound Consent Engine:** Time-expiring HMAC access tokens enforced under the **DPDP Act 2023** with OTP verification and real-time WebSocket notifications.
- **Network-Adaptive Tele-Consultation:** Automatic 3-tier degradation (**HD Video 450 kbps** $\rightarrow$ **Audio Priority 50 kbps** $\rightarrow$ **Store & Forward 5 kbps**) with an interactive pre-call waiting lobby.
- **Clinician-in-the-Loop AI Scribe & CDSS:** Voice-driven SOAP note generation and a deterministic Drug-Drug Interaction (DDI) engine with formulary citations.
- **ABHA Identity Engine:** Aadhaar/mobile OTP verification with instant realistic ABHA ID generation.

---

## 🌟 Key Features

### 1. 🪪 Instant ABHA ID Generation & Split Auth
- **No-ABHA-ID Workflow:** Patients without an ABHA ID can register on-the-fly with 12-digit Aadhaar/Mobile OTP simulation.
- **Realistic Digital ABHA Card:** Generates a downloadable ABDM-standard card complete with unique 14-digit ABHA number, `@abdm` address, QR code, and demographics.
- **Role-Locked Authentication:** Cryptographically verified portal roles for Patients (ABHA verified) and Doctors (NMC verified). Cross-role session swapping is strictly prevented.

### 2. 🛡️ Granular, Purpose-Bound Consent Vault (DPDP Act 2023)
- **Doctor Patient-Linking Flow:** Doctors can enter a patient's ABHA ID to request clinical access with specified encounter purpose and duration.
- **Real-Time Push Notifications:** Connected patients receive an instant interactive notification banner via WebSockets.
- **OTP-Verified Consent Gate:** Patients review doctor credentials, requested scope, and clinical purpose before approving via a 6-digit OTP.
- **Time-Expiring HMAC Tokens:** Access automatically revokes after the approved duration (e.g., 60 minutes).
- **One-Click Instant Revocation:** Patients retain sovereign control to revoke access immediately at any point.
- **Cryptographic Audit Trail:** Every consent event is logged in a tamper-evident audit ledger viewable in the UI.

### 3. 📹 Network-Adaptive Tele-Consultation Engine
- **Pre-Call Tele-Consultation Lobby:** The call interface is not open permanently. Patients arrive in a pre-call waiting room showing doctor availability, encounter details (`#ENC-9481`), and pre-flight device readiness.
- **Incoming Call Ringing Flow:** Supports both on-demand patient dial-in and incoming doctor call alerts with animated ringing and **Accept / Decline** buttons.
- **In-Call Network Quality Controller:** Direct bandwidth switching directly on the call interface:
  - 🟢 **HD Video (450 kbps):** 720p HD full-duplex video stream with active call timer.
  - 🟡 **Audio Priority (50 kbps):** Bandwidth-saving voice mode with dynamic animated audio visualizer waves.
  - 🔴 **Store & Forward (5 kbps):** Offline-first asynchronous messaging queue.

### 4. 🤖 Clinician-in-the-Loop AI Scribe & CDSS
- **AI Ambient Scribe:** Listens to doctor-patient consultation and drafts structured **SOAP notes** (Subjective, Objective, Assessment, Plan).
- **Clinician Approval Gate:** AI notes cannot be published or added to records without explicit physician verification and digital signature.
- **Deterministic DDI Engine:** Checks prescribed medications against active patient drugs and warns of contraindications with clinical formulary citations.

### 5. 🌐 Vernacular Audio & FHIR R4 Interoperability
- **Dynamic Multilingual Audio:** Read aloud clinical findings, consent notices, and care plans in **Kannada**, **Hindi**, or **English**.
- **FHIR R4 Bundle Export:** Export patient encounters, clinical observations, and discharge care plans as standard HL7 FHIR R4 JSON bundles.

---

## 🏗️ Architecture

```
                                  +------------------------------------+
                                  |   CareBridge India (Frontend)      |
                                  |   React 19 • TypeScript • Vite     |
                                  +-----------------+------------------+
                                                    |
                                          HTTP / WS | (Signaling & Events)
                                                    v
                                  +------------------------------------+
                                  |    FastAPI Microservices Engine    |
                                  |    Python 3.12+ • SQLAlchemy async |
                                  +-----------------+------------------+
                                                    |
        +-------------------+-----------------------+-----------------------+-------------------+
        |                   |                       |                       |                   |
        v                   v                       v                       v                   v
+---------------+   +---------------+       +---------------+       +---------------+   +---------------+
|  ABHA & Auth  |   | DPDP Consent  |       | Clinical Vault|       | AI Scribe &   |   | Cryptographic |
|    Engine     |   | HMAC Manager  |       |  FHIR R4 DB   |       | CDSS Engine   |   |  Audit Trail  |
+---------------+   +---------------+       +---------------+       +---------------+   +---------------+
        |                   |                       |                       |                   |
        +-------------------+-----------------------+-----------------------+-------------------+
                                                    |
                                                    v
                                  +------------------------------------+
                                  |    SQLite Async Storage Layer      |
                                  |    (carebridge.db / aiosqlite)     |
                                  +------------------------------------+
```

---

## 📂 Project Structure

```
swasthyasetu_ai/
├── backend/
│   ├── app/
│   │   ├── config.py                 # Application configuration & settings
│   │   ├── database.py               # Async SQLAlchemy database session engine
│   │   ├── main.py                   # FastAPI entrypoint, middleware & WebSockets
│   │   ├── models.py                 # SQLAlchemy ORM models (Users, Consents, Records)
│   │   ├── seed_data.py              # Pre-loaded ABDM demo records & patients
│   │   ├── routers/
│   │   │   ├── auth.py               # ABHA ID & Doctor authentication routes
│   │   │   ├── consents.py           # DPDP consent requests, OTP approval & revocation
│   │   │   ├── records.py            # Patient health records vault & additions
│   │   │   ├── encounters.py         # Clinical tele-consultation encounters
│   │   │   ├── scribe.py             # Ambient clinical AI SOAP note generator
│   │   │   ├── cdss.py               # Drug-Drug Interaction (DDI) safety checks
│   │   │   ├── fhir.py               # HL7 FHIR R4 bundle serialization
│   │   │   ├── audit.py              # Cryptographic audit log ledger
│   │   │   └── translate.py          # Dynamic multilingual translation router
│   │   └── services/
│   │       ├── connection_manager.py # Real-time WebSocket signaling manager
│   │       └── consent_engine.py     # HMAC token generation & revocation logic
│   ├── carebridge.db                 # SQLite database file
│   └── requirements.txt              # Backend Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx            # Clean ABDM navigation bar & role status
│   │   │   ├── ModernAuthView.tsx    # Split login interface (Patient & Doctor)
│   │   │   ├── AbhaCreationModal.tsx # Multi-step Aadhaar/Mobile ABHA registration
│   │   │   ├── PatientPortal.tsx     # Patient lobby, active call, records & care plan
│   │   │   ├── DoctorPortal.tsx      # Doctor triage, AI Scribe, CDSS & patient vault
│   │   │   ├── LinkPatientModal.tsx  # Doctor ABHA request modal
│   │   │   ├── AddMedicalRecordModal.tsx # Patient medical record creation modal
│   │   │   ├── ConsentModal.tsx      # Purpose-specific OTP consent modal
│   │   │   └── AuditModal.tsx        # DPDP Act 2023 cryptographic audit ledger
│   │   ├── services/
│   │   │   ├── apiClient.py          # Authenticated fetch wrapper
│   │   │   └── translator.ts         # Dynamic language translation engine
│   │   ├── types.ts                  # TypeScript interface definitions
│   │   ├── translations.ts           # Vernacular localization dictionaries
│   │   ├── App.tsx                   # Main root view & WebSocket event router
│   │   ├── index.css                 # Custom modern design system
│   │   └── main.tsx                  # Vite application mounting point
│   ├── package.json                  # Frontend scripts & dependencies
│   └── vite.config.ts                # Vite dev server & proxy settings
│
└── docs/                             # Architecture specifications & PRD documents
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.12+**
- **Node.js 20+** and **npm**

---

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create and activate a Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI development server
uvicorn app.main:app --reload --port 8000
```

The backend server will start at **`http://localhost:8000`**.  
Interactive Swagger API documentation is available at **`http://localhost:8000/docs`**.

---

### 2. Frontend Setup

In a new terminal window:

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

The frontend application will start at **`http://localhost:5173`**.

---

## 👥 Demo Personas & Credentials

| Role | Name | Identifier | Details |
| :--- | :--- | :--- | :--- |
| **Patient** | Ramesh Gowda | `91-4820-1928-1120@abdm` | 54 M, Hassan, Karnataka. Kannada/English native. |
| **Representative** | Sunita Devi | Authorized Family Proxy | Daughter-in-law with legal proxy consent authorization. |
| **Doctor** | Dr. Ananya Sharma | `NMC-581920` | MD (General Medicine), Hassan District Tele-Care Hub. |

> 💡 **Tip:** You can also click **"Don't have an ABHA ID? Create ABHA ID"** on the patient login page to generate a fresh custom identity with Aadhaar OTP verification.

---

## 🔌 API & WebSocket Endpoints

### Core REST Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Authenticate Patient or Doctor |
| `POST` | `/api/v1/auth/register-abha` | Create and issue new ABDM ABHA ID |
| `GET` | `/api/v1/auth/me` | Fetch active authenticated profile & medical history |
| `POST` | `/api/v1/consents/request` | Doctor requests access to patient records |
| `POST` | `/api/v1/consents/approve` | Patient grants OTP-verified HMAC consent token |
| `POST` | `/api/v1/consents/revoke/{id}` | Immediate revocation of active consent token |
| `GET` | `/api/v1/records/patient/{id}`| Fetch patient health records from secure vault |
| `POST` | `/api/v1/records` | Upload/add a new medical record or condition |
| `POST` | `/api/v1/scribe/transcribe` | Process consultation audio into SOAP note draft |
| `POST` | `/api/v1/cdss/ddi-check` | Real-time Drug-Drug Interaction analysis |
| `GET` | `/api/v1/fhir/encounter/{id}`| Export encounter as HL7 FHIR R4 JSON bundle |
| `GET` | `/api/v1/audit/logs` | Retrieve DPDP Act 2023 tamper-evident audit logs |

### WebSocket Endpoint
- **`ws://localhost:8000/ws/telehealth`**
  - Handles real-time WebRTC media signaling.
  - Broadcasts incoming ABHA link requests (`ABHA_LINK_REQUEST`).
  - Broadcasts consent approvals and medical history synchronization events.

---

## 🔒 Compliance & Security

- **Digital Personal Data Protection (DPDP) Act 2023:** Enforces strict consent purpose binding, data minimization, right to revoke, and complete cryptographic accountability.
- **ABDM Telemedicine Practice Guidelines (TPG 2020):** Registered medical practitioner verification, patient identity confirmation, and clinical record retention standards.
- **End-to-End Encryption:** 256-bit AES encryption for all data-at-rest and TLS/WSS for all data-in-transit.
- **No Unconsented Data Access:** Doctor accounts cannot view patient records without an active, non-expired cryptographic HMAC token.

---

## 📄 License

This project is licensed under the Apache License 2.0. See the `LICENSE` file for details. Built with ❤️ for accessible, privacy-first healthcare across India.
