# CareBridge India (SwasthyaSetu AI)

<div align="center">

![ABDM v2.4 Compliant](https://img.shields.io/badge/ABDM-v2.4%20Compliant-059669?style=for-the-badge&logo=shield)
![DPDP Act 2023](https://img.shields.io/badge/DPDP%20Act%202023-Enforced-4f46e5?style=for-the-badge&logo=lock)
![HL7 FHIR R4](https://img.shields.io/badge/HL7%20FHIR-R4%20Bundle-0284c7?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.12+-009688?style=for-the-badge&logo=fastapi)
![Doctor Portal](https://img.shields.io/badge/Doctor%20Portal-React%2019%20%7C%20Vite-61dafb?style=for-the-badge&logo=react)
![Patient App](https://img.shields.io/badge/Patient%20App-Expo%20SDK%2058%20%7C%20React%20Native-000020?style=for-the-badge&logo=expo)

**An open, modular, patient-centric digital care & privacy layer built for the Ayushman Bharat Digital Mission (ABDM).**

[Features](#-key-features) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [Demo Logins](#-demo-personas--credentials) • [API & WebSockets](#-api--websocket-endpoints) • [Team Workflow](#-team-workflow) • [Compliance & Security](#-compliance--security)

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
- **CHIBI, a privacy-first clinical assistant:** listens to consultations in batches with memory, fills the doctor's note quietly, and never sends a name, ID or voice to an outside AI (SETU-Shield).
- **Several doctors per patient:** a "My Doctors" directory with department search, shared free slots and booking.
- **Built for low literacy:** plain-language medicine cards, dose reminders, report scanning (OCR) and "double tap to hear" on every screen.

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

### 6. 🧑‍⚕️ CHIBI Assistant & SETU-Shield
- **During a consultation:** CHIBI listens in batches (every 3 lines or 12 s), keeps a running summary, and writes what was said into the right heading of the note. A fuller version of a line updates it in place instead of adding a new one. What the doctor missed shows as grey hints in the note itself (no pop-ups).
- **After the consultation:** a short summary, key points, things to consider, follow-up and "missing from your note", with a Copy button.
- **Outside consultations:** pulse reading, consent requests, and voice navigation in the patient app ("open my medicines", "call 108", change language).
- **SETU-Shield:** a 7-step privacy standard for every AI request (minimise, mask, generalise, unlink, verify, record, restore). If any identifier is left, the request is blocked.
- **Test Lab** (doctor portal → CHIBI Lab): try it by talking, with no call.

### 7. 👩‍⚕️ My Doctors & Booking
- A patient can see several doctors, one per health issue. Search by department, see each doctor's next free slot, and book video or in-person visits.
- Each doctor's page shows upcoming visits, past visits and the medicines that doctor prescribed. Doctors see the patient's other doctors (names and departments only, no clinical details).

### 8. 💊 Medicines, Reminders & Reports
- **Plain-language medicine cards:** what it's for, how to take it, and a picture of the form (tablet, syrup, injection). Dose reminders, and a celebration when a dose is marked taken.
- **One note, used everywhere:** the doctor's signed note (CareBridge note v1 headings) is parsed once. Prescriptions go onto the patient's plan with a schedule, and the patient sees "Your last visit".
- **Report upload with OCR:** photograph or upload a lab report or PDF; PaddleOCR reads it and drafts a summary for review.

### 9. ♿ Accessibility
- **Double tap to hear:** double-tap any text in the patient app to hear it read aloud in Kannada, Hindi or English (turned off automatically when a screen reader is on; a switch in Settings).
- **Listen buttons, large tap targets and a three-language UI** on every screen; ASHA workers can add readings offline for patients without smartphones.

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

**AI:** the backend talks to one AI server, set in `backend/.env`. It can be your own (Ollama + Whisper, e.g. on Colab behind ngrok), or Gemini / OpenAI. Every request passes SETU-Shield first; voice only ever goes to your own Whisper server. With no AI server, every feature falls back to built-in rules.

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
│   │   │   ├── chat.py               # Patient ↔ doctor chat (open around visits, emergency words → 108 + urgent alert)
│   │   │   ├── vitals.py             # Home readings: heart rate (phone camera), BP, sugar, temperature, weight
│   │   │   ├── asha.py               # ASHA worker app: doctors' requests, patient consent, home-visit readings (offline-safe)
│   │   │   ├── care.py               # My Doctors: departments, doctor directory, free slots, booking
│   │   │   ├── calls.py              # Consultation calls, AI minutes, meeting codes & waiting room
│   │   │   ├── intellisense.py       # AI IntelliSense notepad (autocomplete, analysis, saved notepad)
│   │   │   ├── terminology.py        # ICD-11 / RxNorm search
│   │   │   ├── lab.py                # CHIBI Test Lab (talk without a call)
│   │   │   ├── privacy.py            # SETU-Shield: the standard, the ledger, "what the AI sees"
│   │   │   ├── partner.py            # Partner API (/partner/v1, API keys)
│   │   │   └── translate.py          # Kannada / Hindi / English translation
│   │   ├── services/
│   │   │   ├── ai_client.py          # One client for Ollama, Gemini, OpenAI (rate limits, fallbacks)
│   │   │   ├── consult_agent.py      # CHIBI's batch agent with memory
│   │   │   ├── privacy_gateway.py    # SETU-Shield (mask → verify → release → restore)
│   │   │   ├── note_format.py        # CareBridge note v1: headings & parsing (medicines, vitals…)
│   │   │   ├── ocr_service.py        # PaddleOCR for uploaded reports
│   │   │   └── …                     # Token vault, DDI engine, FHIR, scribe, translation, WebSocket manager
│   │   └── partner_admin.py          # CLI: create partner clients and API keys
│   ├── tests/                        # python -m tests.<name>
│   └── requirements.txt
│
├── frontend Doctor/                  # Doctor web portal (React + Vite)
│   └── src/
│       ├── App.tsx                   # Sign-in, live events, the call (kept running on every page), routing
│       ├── portal/                   # The portal: Home · My patients · CHIBI Lab · Audit trail · Settings + meeting room
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
│       │   ├── CarePlanView.tsx            # Medicines, reminders, audio advice & check-in
│       │   ├── medications/                # Plain-language medicine cards, dose button, detail sheet
│       │   ├── doctors/                    # My Doctors, a doctor's page, add a doctor / book
│       │   ├── RecordsLockerView.tsx       # Health records
│       │   ├── UploadReportModal.tsx       # Upload a report (read with OCR)
│       │   ├── MeetingJoinView.tsx         # Join by meeting link (waiting room)
│       │   ├── AshaApp.tsx                 # ASHA worker home & visits
│       │   ├── chibi/                      # CHIBI corner assistant (voice navigation)
│       │   ├── WhoSawMyRecordsView.tsx     # Who accessed my records & revoke
│       │   └── EmergencySOSModal.tsx       # Dial 108 / 112
│       ├── speech/                   # Read-aloud engine & "double tap to hear"
│       ├── services/api.ts           # Backend client (+ secureVault.ts: encrypted offline data)
│       └── theme/tokens.ts           # Colours, radii & shadows
│
├── shared/call/                      # Call engine shared by both apps (edit here, then
│                                     # node scripts/sync-call-engine.mjs copies it into each app)
│
├── docs/                             # Architecture, data, security & feature docs
│   └── API_ROUTES.md                 # Full route design spec
├── credentials.md                    # All demo logins (doctors, patients, representative)
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

`--host 0.0.0.0` is needed for the patient app on a real phone (Expo Go): it calls the backend at your computer's LAN IP, which a `localhost`-only server refuses.

- API: **`http://localhost:8000`**
- Swagger docs: **`http://localhost:8000/docs`**
- Health check: **`http://localhost:8000/health`**

**Database:** with no `DATABASE_URL` set, the backend uses a local SQLite file (`backend/carebridge.db`). To use Neon Postgres instead, set `DATABASE_URL` (pooled) and optionally `DATABASE_URL_UNPOOLED` (direct, for schema changes) in `backend/.env`. New tables and columns are added automatically at start-up.

**Report OCR:** `requirements.txt` includes PaddleOCR (with onnxruntime), a large install. Its models download the first time a report is read.

**AI server (optional):** set these in `.env` (see `.env.example`). Without them, CHIBI and the notepad use built-in rules.

| Setting | Example | Meaning |
| :--- | :--- | :--- |
| `AI_PROVIDER` | empty · `gemini` · `openai` · `openai_compatible` | Empty = your own Ollama server |
| `AI_API_KEY` | (your key) | Gemini / OpenAI key (`GEMINI_API_KEY` / `OPENAI_API_KEY` also work). These count as third parties: masked text only, never voice |
| `AI_MAX_RPM` | `0` | Requests per minute (0 = provider default: Gemini free tier 10, OpenAI 60). Autocomplete uses at most half, so CHIBI always gets through; a "too many requests" reply pauses AI for as long as the provider asks |
| `AI_GATEWAY_TOKEN` | | Your own Ollama + Whisper server on Colab + ngrok ([docs/10_remote_gpu_colab](docs/10_remote_gpu_colab/)). A new Colab session downloads the model automatically; the first answer then takes about 40 s |

Backend tests: `python -m tests.test_consult_agent`, `tests.test_ai_client`, `tests.test_privacy_gateway` (from `backend/`).

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

> ⚠️ **Expo Go (SDK 58) only includes certain native modules.** Use `npx expo install <package>` so versions match, and check that a new native package is in Expo Go before adding it. For example, `expo-av` is not (it crashes with "Cannot find native module 'ExponentAV'"); use `expo-audio` and `expo-speech`. Browser-only code (`window.addEventListener`, `document`, canvas) must check `Platform.OS === 'web'`.

### 4. Live video consultations (WebRTC)

Doctor and patient see and hear each other live. Video and audio go directly between the two devices (WebRTC); the backend WebSocket only passes the connection set-up messages, delivered to the one user they are meant for.

**Patient in a browser** (quickest to test):
- On the same computer as the doctor portal: run `npx expo start --web` and open `http://localhost:8081`.
- On a phone's browser: browsers only allow the camera on `https://` or `localhost` pages. For local testing in Android Chrome, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<your-LAN-IP>:8081`, and relaunch Chrome.

**Patient as a phone app:** video calls use `react-native-webrtc`, which is **not available in Expo Go**. Build a development app once with EAS (free Expo account):

```bash
cd "frontend Patient"
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android   # installable APK
npx expo start                                                        # then open the installed app
```

Installing `expo-dev-client` makes `npx expo start` target that development app. To keep using Expo Go for everything except calls, run `npx expo start --go`.

**Different networks** (patient on mobile data, doctor on clinic Wi-Fi) usually need a TURN relay server. Set `EXPO_PUBLIC_TURN_URL`, `EXPO_PUBLIC_TURN_USERNAME`, `EXPO_PUBLIC_TURN_CREDENTIAL` for the patient app and `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` for the doctor portal. On the same Wi-Fi, no TURN server is needed.

---

## 👥 Demo Personas & Credentials

| Role | Name | Sign-in | Details |
| :--- | :--- | :--- | :--- |
| **Patient** | Ramesh Gowda | ABHA `91-4820-1928-1120@abdm` or mobile `9845012345`, OTP `123456` | 54 M, farmer, Hassan, Karnataka. Prefers Kannada. |
| **Representative** | Sunita Devi | Chosen in the symptom intake form | Family member with nominee consent. |
| **Doctor** | Dr. Ananya Sharma | `NMC-KA-581920` / `password123` | MD (General Medicine), Hassan District Tele-Care Hub. |
| **ASHA worker** | (Hassan) | `ASHA-HSN-0142` / `password123` | Patient app → "ASHA / health worker sign-in". |

All 17 doctors (one or more per department), 10 patients and the representative are listed in [credentials.md](credentials.md). Every demo account uses the password `password123`.

> 💡 **Tip:** On the patient sign-in screen, tap **"Demo 1-Click: Ramesh Gowda"** to fill in the demo ABHA ID and OTP automatically. The screen shows a two-step indicator (ID → OTP), a **Listen** button that reads the whole screen aloud, and a language pill (ಕನ್ನಡ / हिंदी / English) whose choice is remembered.

### Try the full flow
1. Sign in as the **doctor** in the web portal and as the **patient** in the mobile app.
2. On the doctor's **Home**, open **Ramesh Gowda**'s appointment (schedule list or calendar). The meeting room shows a camera/microphone check and whether the patient is in the app.
3. Click **Join with video**. The patient's app rings; accept it. Take notes in the floating notepad during the call.
4. End the call and sign the visit note. The patient app opens the care plan automatically; the visit appears under the patient's **Visits** tab.
5. On the patient's **Records** tab, request access to a record. The patient approves it with the OTP.
6. On the patient's **Privacy** tab, see who accessed which record and revoke access.
7. On the patient's **My Doctors** tab, add a doctor from another department and book a free slot.
8. In the doctor portal, open **CHIBI Lab**, start a test consultation and speak as the patient. The note fills in; **Finish & summarise** shows the summary and what the visit would save.

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
| `POST` | `/auth/upload-initial-report` | Read a report (PDF or image) with OCR during sign-up |
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
| `POST` | `/records/upload` | Upload a report (PDF or image); OCR reads it and drafts a summary |
| `POST` | `/records/ocr-preview` | Read a report with OCR without saving it |
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

### My Doctors (several doctors per patient)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/care/departments` | Departments (with doctor counts) and the health issues a patient picks from |
| `GET` | `/care/doctors?department=` | Doctor directory with each doctor's next free slot |
| `GET` | `/care/doctors/{id}/slots` | Free slots for both the doctor and the patient |
| `POST` / `GET` | `/care/appointments` | Book a visit (video or in person) · all my appointments |
| `POST` | `/care/appointments/{id}/cancel` | Cancel a visit |
| `GET` | `/care/my-doctors` · `/care/my-doctors/{id}` | My doctors (sorted by next visit) · one doctor's visits and medicines |
| `POST` | `/care/my-doctors/{id}/remove` | Remove a doctor from my list |

### Translation
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/translate/languages` | Supported languages |
| `POST` | `/translate` | Translate text |
| `POST` | `/translate/batch` | Translate several texts |
| `POST` | `/translate/careplan` | Translate a care plan |

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

### Chat (patients and doctors)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/chat/threads` | My conversations (doctor: patients · patient: doctors) |
| `GET` | `/chat/threads/{other_id}` | Messages, and whether the patient can write now (open from booking until N days after a visit) |
| `POST` | `/chat/threads/{other_id}/messages` | Send; patient messages with emergency words are flagged (patient told to call 108, doctor alerted) |
| `POST` | `/chat/threads/{other_id}/read` | Mark read (read receipts) |
| `GET` | `/chat/unread` | Unread count |

### ASHA workers (community health workers)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/asha/tasks` · `/asha/patients?q=` · `/asha/patients/{id}` | Doctors' requests, patients in her area, one visit |
| `POST` | `/asha/consent` | The patient agrees she may add readings (tap, thumb impression or verbal; 90 days) |
| `POST` | `/asha/readings` | Readings from a visit (`client_id` makes offline re-sends safe; urgent BP alerts the doctor) |
| `POST` | `/doctor/patients/{id}/requests` | Doctor asks the patient's ASHA worker for readings |

Demo ASHA sign-in (patient app → "ASHA / health worker sign-in"): `ASHA-HSN-0142` / `password123`.

### Home readings
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/vitals` | Patient saves a reading (heart rate from the phone camera: an estimate, 30–220 bpm accepted; outside 45–120 warns the doctor) |
| `GET` | `/vitals/me` · `/vitals/patient/{id}` | Patient's own readings · a patient's readings (doctor) |

**Heart rate from the phone camera** (patient app → Home → Heart rate): the patient covers the back camera and flash with a fingertip for 30 s; `frontend Patient/src/services/heartRate.ts` turns the tiny brightness changes into beats per minute and refuses unclear signals. Works in the web app (Chrome on Android also turns the flash on) and in Expo Go, where the same measurement runs inside a WebView camera page.

### Meetings (Google Meet style)
Every appointment has a meeting code (`abc-defg-hij`) and a link: `<patient app>/?join=<code>`. Patients can join from 10 minutes before the start until 30 minutes after the scheduled end. "Ask to join" puts them in a waiting room until the doctor admits them. If the doctor is already waiting in the meeting, the patient is let in straight away.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/calls/meetings/{code}` | Meeting for the signed-in patient: doctor, time, join window and state (`early` / `open` / `closed` / `cancelled` / `completed`) |
| `POST` | `/calls/meetings/{code}/join` | Opens the call room inside the join window (409 outside it) |

Call-room messages (`/ws/v1/encounters/{id}/call`): `KNOCK` / `KNOCK_CANCEL` (patient), `HOST_WAITING` / `DENY` (doctor); admitting is the doctor's `CALL_START`. The doctor's portal also gets a `patient_waiting` event on `/ws/telehealth`.

**Live assistant:** during a call, the assistant shows one status line and safety alerts inside the note panel (no toast pop-ups). Its suggestions appear as autocomplete and grey hints in the notepad, which takes the right half of the screen. Practice mode uses the doctor's microphone (spoken as the patient) when the speech server is online, and plays the demo script otherwise.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/calls/summaries/pending` · `/calls/summaries/me` | Visit summaries waiting for the patient · all of them |
| `POST` | `/calls/summaries/{id}/accept` · `/decline` | Patient accepts or declines a summary |
| `GET` | `/calls/active-encounter` | The consultation the patient can join now |
| `GET` / `POST` | `/intellisense/lexicon` · `/complete` · `/analyze` | Notepad: clinical words, autocomplete, checks |
| `GET` / `PUT` | `/intellisense/encounters/{id}/notepad` | Saved notepad for a consultation |
| `GET` | `/terminology/search?q=` | ICD-11 / RxNorm search |

### CHIBI, Test Lab, notes and Partner API
- **CHIBI** (Central Health Informatics Bot Interface): the assistant in the corner of both apps. During consultations it listens in batches with memory and shows what was said but isn't in the note as grey hints in the note (no pop-ups). See [docs/14_chibi](docs/14_chibi/README.md).
- **Test Lab** (doctor portal → CHIBI Lab): talk with no call; the note fills in, then a summary and the structured note. `POST /lab/sessions`, `/lab/sessions/{id}/lines`, `/process`, `/end`, `GET /lab/status`.
- **AI provider:** your Ollama server, or Gemini / OpenAI with `AI_PROVIDER` + `AI_API_KEY` (see `.env.example`, `backend/app/services/ai_client.py`).
- **One note, used everywhere:** the notepad uses fixed headings (CareBridge note v1). When signed, it is parsed into structured data: medicines go onto the patient's plan with a schedule, and the visit page and the patient's "Your last visit" card read from it. `GET /doctor/encounters/{id}/structured` pre-fills the sign-off form.
- **Partner API** (`/partner/v1`, `X-API-Key`): the consent layer, SETU-Shield and note parsing for other apps. Keys come from `python -m app.partner_admin`. Architecture and schema: [docs/13_platform_architecture](docs/13_platform_architecture/README.md).
- **SETU-Shield:** `GET /privacy/standard` (the steps and what each feature may send), `GET /privacy/ledger` (what went to the AI, without content), `POST /privacy/preview` (exactly what the AI would see).

### WebSocket
**`ws://localhost:8000/ws/telehealth`** carries live events between the two apps:
- `consent_request` / `consent_approved`: record access requests and approvals
- `call_invitation`, `call_accepted`, `call_declined`, `call_ended`: call ringing and hang-up
- `webrtc` (`ready` / `offer` / `answer` / `candidate` / `media`): WebRTC connection set-up for the live video
- `appointment_rescheduled`: doctor changes the next appointment; the patient's home screen updates live
- `patient_waiting`: a patient asked to join a meeting (doctor portal)

Connect with `?token=<login token>`. Frames that carry a `"to": "<user id>"` field are delivered only to that user, and the server stamps the sender's id as `"from"`.

---

## 🤝 Team Workflow

Everyone works off `main`:

```bash
git pull origin main          # before starting, and again before pushing
# ...commit your work...
git push origin main
```

After pulling, install anything new: `pip install -r requirements.txt` (in `backend/`, inside `.venv`) and `npm install` in each app. Before pushing, check that the backend starts (`python -c "import app.main"`) and that both apps type-check (`npx tsc --noEmit`). If you change `shared/call/`, run `node scripts/sync-call-engine.mjs`.

---

## 🔒 Compliance & Security

- **Digital Personal Data Protection (DPDP) Act 2023:** Enforces strict consent purpose binding, data minimization, right to revoke, and complete cryptographic accountability.
- **ABDM Telemedicine Practice Guidelines (TPG 2020):** Registered medical practitioner verification, patient identity confirmation, and clinical record retention standards.
- **SETU-Shield (AI privacy standard):** every request to an AI model passes seven steps: minimise, mask, generalise, unlink, verify (blocks the request if any identifier is left), record (no content kept) and restore. Voice is never sent to a third party. See [docs/12_privacy_standard](docs/12_privacy_standard/README.md); in the doctor's notepad, **What the AI sees** shows the exact request.
- **Encryption:** offline data on the phone (ASHA visit readings) is encrypted with AES-256-GCM, using a key held in the Android Keystore / iOS Keychain. Traffic uses TLS/WSS in deployment. Field-level encryption of the server database is planned and not yet in place.
- **No Unconsented Data Access:** Doctor accounts cannot view patient records without an active, non-expired cryptographic HMAC token.

---

## 📄 License

This project is licensed under the Apache License 2.0. See the `LICENSE` file for details. Built with ❤️ for accessible, privacy-first healthcare across India.
