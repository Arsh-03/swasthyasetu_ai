# CareBridge India — Executive Summary & Product Requirements (PRD)

**Project:** CareBridge India (SwasthyaSetu AI)  
**Classification:** Digital Healthcare Infrastructure / Telemedicine Consent Layer  
**Document Owner:** Product & System Engineering  
**Version:** 1.0.0 (Production Blueprint)

---

## 1. Executive Summary

CareBridge India is an open, modular, patient-centric digital care and privacy layer designed to integrate with the **Ayushman Bharat Digital Mission (ABDM)** ecosystem.

Contemporary Indian telemedicine applications suffer from three critical failures:
1. **The Language Barrier:** Over 80% of semi-urban and rural patients cannot understand clinical discharge summaries written in English, leading to 45%+ medication non-compliance.
2. **Network Volatility:** High latency and packet drops on 2G/3G/intermittent 4G cellular links cause WebRTC video consultations to abruptly terminate without structured degradation.
3. **Coarse-Grained Privacy Exploitation:** Traditional platforms force patients to agree to "all-or-nothing" blanket data collection checkboxes. Patients have no way to grant a doctor access to an ultrasound report for a specific 60-minute consultation without exposing their entire lifetime medical record.

CareBridge India solves these challenges through:
- **Audio-First Vernacular Onboarding:** Native support for Kannada (ಕನ್ನಡ), Hindi (हिन्दी), and English with automated speech synthesis.
- **Granular, Purpose-Specific Consent Engine:** Time-expiring, backend-enforced HMAC access tokens bound to a single clinical purpose and record.
- **Network-Adaptive WebRTC Degradation:** Gracefully steps down from HD Video $\rightarrow$ Audio-Only $\rightarrow$ Asynchronous Store-and-Forward without call termination.
- **Clinician-in-the-Loop AI Scribe & Deterministic DDI Alerts:** Generates structured SOAP notes while enforcing a strict clinician approval gate and verified Drug-Drug Interaction safety checks.
- **PWA-First Architecture with Capacitor APK Bridge:** A responsive web application that runs on any browser and packages cleanly into an Android APK via Capacitor for low-end devices.

---

## 2. Product Requirements & User Personas

### 2.1 Persona Specifications

#### Persona A: Ramesh Gowda (Rural Patient)
- **Profile:** 54-year-old farmer from Hassan district, Karnataka.
- **Device & Literacy:** Sub-$100 Android smartphone on intermittent 3G/4G; literate in Kannada only; limited digital literacy.
- **Critical Need:** Needs to understand doctor's advice in Kannada speech; needs assurance that personal scans won't be leaked or permanently stored on doctor's personal phone.

#### Persona B: Sunita Devi (Authorised Representative)
- **Profile:** 28-year-old daughter-in-law managing care for an elderly relative.
- **Device & Literacy:** Bilingual (Hindi/English), smartphone-fluent.
- **Critical Need:** Legally transparent proxy consent without using the patient's personal phone or forged signatures.

#### Persona C: Dr. Ananya Sharma (Telemedicine Physician)
- **Profile:** General Medicine practitioner at a regional district tele-clinic.
- **Device & Literacy:** Desktop browser / tablet; high patient velocity (25+ consultations/day).
- **Critical Need:** Fast consultation queue, automated SOAP note drafting, zero liability from unauthorized AI prescribing, and verified drug safety warnings.

---

## 3. Functional Requirements Matrix

| ID | Module | Priority | Requirement Description | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **FR-01** | Identity | P0 | Verified login & Authorised Representative capture | Distinct audit trails for patient self vs. proxy participant |
| **FR-02** | Language | P0 | Dynamic UI & Audio TTS in Kannada, Hindi, and English | Audio button reads consent and care plan in chosen tongue |
| **FR-03** | Consent | P0 | Purpose-bound, time-expiring record access request | Doctor requests specific scan for 60m; backend revokes token at expiry |
| **FR-04** | Telehealth | P0 | 3-tier WebRTC adaptive degradation engine | Auto-falls back from video to audio, then store-and-forward |
| **FR-05** | AI Scribe | P0 | Clinician-reviewed SOAP clinical note drafting | Doctor must explicitly verify & sign note before delivery |
| **FR-06** | Safety | P0 | Deterministic Drug-Drug Interaction (DDI) engine | Flags contraindicated drugs with clinical formulary citations |
| **FR-07** | Interop | P1 | HL7 FHIR R4 Bundle export & ABDM compatibility | Export encounter and prescription as valid FHIR JSON |
| **FR-08** | Mobile | P0 | PWA responsive core convertible to Android APK | Runs smoothly at 60fps on mobile browsers and as Capacitor APK |
