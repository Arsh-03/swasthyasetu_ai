# CareBridge India (SwasthyaSetu AI)

<div align="center">

![ABDM v2.4 Compliant](https://img.shields.io/badge/ABDM-v2.4%20Compliant-059669?style=for-the-badge&logo=shield)
![DPDP Act 2023](https://img.shields.io/badge/DPDP%20Act%202023-Enforced-4f46e5?style=for-the-badge&logo=lock)
![HL7 FHIR R4](https://img.shields.io/badge/HL7%20FHIR-R4%20Bundle-0284c7?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.12+-009688?style=for-the-badge&logo=fastapi)
![Doctor Portal](https://img.shields.io/badge/Doctor%20Portal-React%2019%20%7C%20Vite-61dafb?style=for-the-badge&logo=react)
![Patient App](https://img.shields.io/badge/Patient%20App-Expo%20SDK%2058%20%7C%20React%20Native-000020?style=for-the-badge&logo=expo)

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

The project has three parts: one backend and two separate client apps.

```
+-----------------------------+              +-----------------------------+
|   Patient App (mobile)      |              |   Doctor Portal (web)       |
|   Expo • React Native • TS  |              |   React 19 • Vite • TS      |
|   Android / iOS / Web       |              |   Tailwind • lucide-react   |
+--------------+--------------+              +--------------+--------------+
               |                                            |
               |        HTTP (REST)  +  WS /ws/telehealth   |
               +---------------------+----------------------+
                                     |
                                     v
                  +------------------------------------+
                  |    FastAPI Backend                 |
                  |    Python 3.12+ • SQLAlchemy async |
                  +-----------------+------------------+
                                    |
   +-------------+-------------+----+--------+-------------+--------------+
   |             |             |             |             |              |
   v             v             v             v             v              v
+--------+  +---------+  +-----------+  +---------+  +-----------+  +-----------+
| ABHA & |  | DPDP    |  | Clinical  |  | AI      |  | Care Plan |  | Audit     |
| Auth   |  | Consent |  | Vault &   |  | Scribe  |  | & Appoint-|  | Trail     |
|        |  | Tokens  |  | FHIR R4   |  | & CDSS  |  | ments     |  |           |
+--------+  +---------+  +-----------+  +---------+  +-----------+  +-----------+
                                    |
                                    v
                  +------------------------------------+
                  |  Database                          |
                  |  SQLite (default, local dev)       |
                  |  or Neon Postgres via DATABASE_URL |
                  +------------------------------------+
```

---

## 📂 Project Structure

```
swasthyasetu_ai/
├── backend/                          # FastAPI server
│   ├── app/
│   │   ├── main.py                   # Entry point, routers & /ws/telehealth WebSocket
│   │   ├── config.py                 # Settings (reads backend/.env)
│   │   ├── database.py               # Async engine: SQLite or Neon Postgres
│   │   ├── seed_data.py              # Loads demo patients, doctors & records
│   │   ├── models/models.py          # SQLAlchemy ORM models
│   │   ├── schemas/schemas.py        # Pydantic request/response schemas
│   │   ├── seed/                     # Demo patient charts & queue (JSON)
│   │   ├── routers/
│   │   │   ├── auth.py               # Login, ABHA creation, patient/doctor registration
│   │   │   ├── consents.py           # Consent request, OTP grant, decision & revoke
│   │   │   ├── records.py            # Health records vault & decrypted streaming
│   │   │   ├── encounters.py         # Symptom intake & call mode (HD / audio / async)
│   │   │   ├── patients.py           # Doctor's patient queue & patient chart
│   │   │   ├── appointments.py       # Next appointment & rescheduling
│   │   │   ├── careplan.py           # Care plan, dose logging & recovery check-in
│   │   │   ├── scribe.py             # AI SOAP note draft & doctor sign-off
│   │   │   ├── cdss.py               # Drug-drug interaction checks
│   │   │   ├── fhir.py               # HL7 FHIR R4 bundle export
│   │   │   ├── audit.py              # Audit log (+ filterable /audit/events)
│   │   │   ├── doctor.py             # Doctor portal: dashboard, calendar, patients, visits, notifications, settings
│   │   │   └── translate.py          # Kannada / Hindi / English translation
│   │   └── services/                 # Token vault, DDI engine, FHIR, scribe,
│   │                                 # translation & WebSocket connection manager
│   └── requirements.txt
│
├── frontend Doctor/                  # Doctor web portal (React + Vite)
│   └── src/
│       ├── App.tsx                   # Sign-in, live events, the call (kept running on every page), routing
│       ├── portal/                   # The portal: Home · My patients · Audit trail · Settings + meeting room
│       │   ├── Shell.tsx                   # Sidebar, language dropdown, notification bell, profile menu
│       │   ├── screens/                    # Home, Patients, Patient (tabs), Visit, Meeting, Audit, Settings
│       │   ├── meeting/                    # Device choice, floating notepad, visit note form
│       │   ├── i18n.ts                     # English / Kannada / Hindi texts
│       │   └── time.ts, router.ts, ui.tsx  # Time zone & formats, hash routes, building blocks
│       ├── components/
│       │   ├── DoctorLoginView.tsx         # NMC registration login
│       │   ├── ClinicalNotepad.tsx         # AI IntelliSense notepad
│       │   ├── ConsentRequestModal.tsx     # Ask a patient for record access
│       │   └── call/                       # Call windows and overlays
│       └── services/                 # api.ts, doctorApi.ts, call engine copy
│
├── frontend Patient/                 # Patient mobile app (Expo + React Native)
│   ├── App.tsx                       # Root view, tab bar & WebSocket event handling
│   └── src/
│       ├── components/
│       │   ├── PatientLoginView.tsx        # ABHA / mobile + OTP sign-in (illustrated, stepper, Listen)
│       │   ├── PatientHeader.tsx           # Glass toolbar: brand, language pill, avatar, sign-out
│       │   ├── HomeView.tsx                # Today tab: greeting, appointment, quick actions, SOS
│       │   ├── HeroAppointmentCard.tsx     # Next appointment (loading / none / error states), Listen, join call
│       │   ├── TactileGrid.tsx             # Quick-action tiles & Emergency SOS
│       │   ├── SymptomIntakeModal.tsx      # Pre-call symptom intake
│       │   ├── PatientTelehealthCall.tsx   # Network-adaptive video call
│       │   ├── IncomingCallModal.tsx       # Doctor is calling
│       │   ├── ConsentGateModal.tsx        # Approve doctor access with OTP
│       │   ├── CarePlanView.tsx            # Medicines, audio advice & check-in
│       │   ├── RecordsLockerView.tsx       # Health records
│       │   ├── WhoSawMyRecordsView.tsx     # Who accessed my records & revoke
│       │   └── EmergencySOSModal.tsx       # Dial 108 / 112
│       ├── services/api.ts           # Backend client
│       └── theme/tokens.ts           # Colours, radii & shadows
│
├── docs/                             # Architecture, data, security & feature docs
│   └── API_ROUTES.md                 # Full route design spec
└── .env.example                      # Backend environment template
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.11+** (the backend uses `asyncio.timeout`)
- **Node.js 20+** and **npm**
- For the patient app on a phone: the **Expo Go** app, or an Android emulator / iOS simulator

Start the backend first. Both apps talk to it at `http://localhost:8000`.

---

### Quick start (recommended)

One command sets everything up and starts everything. It creates a Python virtual environment in `backend/.venv`, installs the backend requirements **into that environment** (not your system Python), installs the packages of both apps, creates `.env` with a random `SECRET_KEY`, and starts:

- the backend on port **8000**,
- the **Doctor portal** on port **5173** (login `NMC-KA-581920` / `password123`),
- the **Patient app's web version** on port **8081** (tap "Demo 1-Click").

Consultation calls (video or audio, either side can call), consent-based AI minutes and the AI IntelliSense notepad work between these two. On a phone (Expo Go) the Patient app shows a note instead of the call: real calls on a phone need a development build with a WebRTC module.

**Windows:** double-click `start.bat`, or in PowerShell:
```powershell
.\start.ps1                # set up if needed, then start (opens the browser)
.\start.ps1 -SetupData     # first time: also download + import ICD-11, RxNorm and DDInter (~95 MB)
.\stop.ps1                 # stop all servers
```

**macOS / Linux:**
```bash
./start.sh                 # Ctrl+C stops both servers
./start.sh --setup-data    # first time: also download + import the clinical datasets
```

Later runs skip the installs and only reinstall when `backend/requirements.txt` or an app's `package-lock.json` change (`-Reinstall` / `--reinstall` rebuilds the virtual environment).

**Clinical datasets:** `backend/data/terminology.db` is not in git, so each machine builds it once with `-SetupData`. The free datasets (WHO ICD-11/ICD-10, NLM RxNorm, DDInter 2.0) download automatically. SNOMED CT, LOINC and CDCI need accounts; see [docs/08_standards_integration](docs/08_standards_integration/). DDInter is CC BY-NC-SA 4.0 (non-commercial use only).

To run backend commands yourself, use the environment's Python: `backend\.venv\Scripts\python.exe` on Windows, `backend/.venv/bin/python` on macOS/Linux (for example `python -m app.terminology status` from the `backend` folder).

---

### Manual setup

### 1. Backend

```bash
cd backend

python3 -m venv venv
source venv/bin/activate          # fish: source venv/bin/activate.fish

pip install -r requirements.txt

# Optional: copy the env template and set SECRET_KEY / DATABASE_URL
cp ../.env.example .env

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: **`http://localhost:8000`**
- Swagger docs: **`http://localhost:8000/docs`**
- Health check: **`http://localhost:8000/health`**

**Database:** with no `DATABASE_URL` set, the backend uses a local SQLite file (`backend/carebridge.db`). To use Neon Postgres instead, set `DATABASE_URL` (pooled) and optionally `DATABASE_URL_UNPOOLED` (direct, for schema changes) in `backend/.env`.

---

### 2. Doctor Portal (web)

In a new terminal:

```bash
cd "frontend Doctor"
npm install
npm run dev
```

Opens at **`http://localhost:5173`**.

---

### 3. Patient App (mobile)

In a new terminal:

```bash
cd "frontend Patient"
npm install
npx expo start
```

Then:
- press **`w`** to open it in a browser,
- press **`a`** for an Android emulator, or
- scan the QR code with **Expo Go** on your phone.

> ⚠️ The app reaches the backend at `localhost` (or `10.0.2.2` on the Android emulator), set in `src/services/api.ts`. On a physical phone, change `API_HOST` to your computer's LAN IP address.

> 💡 If code changes don't show up (common when the project is on an external drive), restart with `npx expo start --clear`.

---

## 👥 Demo Personas & Credentials

| Role | Name | Sign-in | Details |
| :--- | :--- | :--- | :--- |
| **Patient** | Ramesh Gowda | ABHA `91-4820-1928-1120@abdm` or mobile `9845012345`, OTP `123456` | 54 M, farmer, Hassan, Karnataka. Prefers Kannada. |
| **Representative** | Sunita Devi | Chosen in the symptom intake form | Family member with nominee consent. |
| **Doctor** | Dr. Ananya Sharma | `NMC-KA-581920` / `password123` | MD (General Medicine), Hassan District Tele-Care Hub. |

> 💡 **Tip:** On the patient sign-in screen, tap **"Demo 1-Click: Ramesh Gowda"** to fill in the demo ABHA ID and OTP automatically. The screen shows a two-step indicator (ID → OTP), a **Listen** button that reads the whole screen aloud, and a language pill (ಕನ್ನಡ / हिंदी / English) whose choice is remembered.

### Try the full flow
1. Sign in as the **doctor** in the web portal and as the **patient** in the mobile app.
2. On the doctor's **Home**, open **Ramesh Gowda**'s appointment (schedule list or calendar). The meeting room shows a camera/microphone check and whether the patient is in the app.
3. Click **Join with video**. The patient's app rings; accept it. Take notes in the floating notepad during the call.
4. End the call and sign the visit note. The patient app opens the care plan automatically; the visit appears under the patient's **Visits** tab.
5. On the patient's **Records** tab, request access to a record. The patient approves it with the OTP.
6. On the patient's **Privacy** tab, see who accessed which record and revoke access.

---

## 🔌 API & WebSocket Endpoints

All REST routes are under `/api/v1`. The live, complete list is always at **`http://localhost:8000/docs`**.

### Auth & Identity
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/auth/profiles` | List demo profiles |
| `POST` | `/auth/login` | Sign in as patient or doctor |
| `POST` | `/auth/create-abha` | Create a new ABHA ID |
| `POST` | `/auth/register/patient` | Register a patient |
| `POST` | `/auth/register/doctor` | Register a doctor |
| `GET` | `/auth/me` | Current user's profile |
| `GET` | `/auth/patient/{patient_id}/details` | Patient details (doctor) |
| `POST` | `/auth/patient/medical-history` | Patient updates own medical history |
| `POST` | `/auth/patient/{patient_id}/doctor-update-history` | Doctor updates a patient's history |

### Consent (DPDP Act 2023)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/consents/link-patient-request` | Doctor asks to link a patient by ABHA ID |
| `POST` | `/consents/request` | Doctor requests access to a record |
| `GET` | `/consents/pending-for-patient` | Patient's pending requests |
| `POST` | `/consents/{consent_id}/verify-otp-and-grant` | Patient approves with OTP |
| `POST` | `/consents/{consent_id}/decision` | Patient approves or declines |
| `POST` | `/consents/{consent_id}/revoke` | Revoke access immediately |
| `GET` | `/consents/{consent_id}/status` | Consent status |
| `GET` | `/consents/history` | Consent history for the current user |

### Records, Encounters & Care
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/records/patient/{patient_id}` | List a patient's records |
| `POST` | `/records/add` | Add a medical record |
| `GET` | `/records/{record_id}/stream` | Read a decrypted record (needs active consent) |
| `POST` | `/encounters/intake` | Submit pre-call symptom intake |
| `GET` | `/encounters/{encounter_id}` | Encounter details |
| `POST` | `/encounters/{encounter_id}/mode` | Switch call mode (HD / audio / async) |
| `GET` | `/patients/queue` | Doctor's patient queue |
| `GET` | `/patients/{patient_id}/chart` | Patient chart |
| `GET` | `/appointments/next` | Patient's next appointment |
| `PUT` | `/appointments/{appointment_id}` | Reschedule an appointment |
| `GET` | `/careplan` | Patient's care plan |
| `POST` | `/careplan/doses` | Log a dose taken |
| `POST` | `/careplan/checkin` | Submit recovery check-in |

### AI, Safety & Interoperability
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/scribe/generate` | Draft a SOAP note |
| `POST` | `/scribe/sign/{encounter_id}` | Doctor signs the care plan |
| `GET` | `/scribe/{encounter_id}` | Get the clinical note |
| `POST` | `/cdss/validate` | Check prescriptions for drug interactions |
| `GET` | `/fhir/encounter/{encounter_id}` | Export encounter as FHIR R4 bundle |
| `GET` | `/audit/logs` | Audit log |
| `GET` | `/audit/events` | Audit log with filters (time, category, problems, search) and links |

### Doctor portal
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/doctor/dashboard` | Next appointment, today's list, key numbers, chart data, urgent alerts |
| `GET` | `/doctor/appointments` | Appointments in a date range (calendar) |
| `POST` / `PATCH` | `/doctor/appointments[/{id}]` | Book, reschedule or cancel (409 outside available hours unless `force`) |
| `POST` | `/doctor/appointments/{id}/open` | Open the appointment's meeting room (consultation) |
| `GET` | `/doctor/patients` · `/doctor/patients/{id}` | My patients · one patient with visits |
| `GET` | `/doctor/visits/{encounter_id}` | One past visit (note, plan, notepad, activity) |
| `GET` / `POST` | `/doctor/notifications` · `/doctor/notifications/read` | Notification bell |
| `GET` / `PUT` | `/doctor/settings` | Profile, preferences, weekly hours and leave |
| `GET` | `/translate/languages` | Supported languages |
| `POST` | `/translate` | Translate text |
| `POST` | `/translate/batch` | Translate several texts |
| `POST` | `/translate/careplan` | Translate a care plan |

### WebSocket
**`ws://localhost:8000/ws/telehealth`** carries live events between the two apps:
- `consent_request` / `consent_approved`: record access requests and approvals
- `call_invitation`, `call_accepted`, `call_declined`, `call_ended`: video call signalling
- `appointment_rescheduled`: doctor changes the next appointment; the patient's home screen updates live

---

## 🔒 Compliance & Security

- **Digital Personal Data Protection (DPDP) Act 2023:** Enforces strict consent purpose binding, data minimization, right to revoke, and complete cryptographic accountability.
- **ABDM Telemedicine Practice Guidelines (TPG 2020):** Registered medical practitioner verification, patient identity confirmation, and clinical record retention standards.
- **End-to-End Encryption:** 256-bit AES encryption for all data-at-rest and TLS/WSS for all data-in-transit.
- **No Unconsented Data Access:** Doctor accounts cannot view patient records without an active, non-expired cryptographic HMAC token.

---

## 📄 License

This project is licensed under the Apache License 2.0. See the `LICENSE` file for details. Built with ❤️ for accessible, privacy-first healthcare across India.
