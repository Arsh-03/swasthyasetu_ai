# Clinical AI IntelliSense & Consultation Documentation Module

**Module Folder:** `docs/07_ai_intellisense_feature/`  
**Project:** CareBridge India (SwasthyaSetu AI)  
**Classification:** Real-Time Clinical Copilot & Ambient Scribe  

---

## 📑 Module Documentation Index

This directory contains the production-grade engineering, clinical, and UI/UX documentation for the **Dual-Path Consultation Documentation Engine**:

1. [01_architecture_and_pipeline.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/07_ai_intellisense_feature/01_architecture_and_pipeline.md)
   - **System Overview & Dual-Path Architecture:** Synchronized in-consultation real-time IntelliSense paired with post-call ambient meeting minutes (MoM).
   - Real-time WebRTC/WebSocket telemetry, latency budgets (<150ms keystroke SLA), and dual-path reconciliation.

2. [02_realtime_intellisense_engine.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/07_ai_intellisense_feature/02_realtime_intellisense_engine.md)
   - **Real-Time Keystroke Tokenizer & Predictive Autocomplete:** 3-tier cascaded architecture (Local Radix Trie, Shorthand Expander, Contextual SLM).
   - Clinical auto-punctuation, vitals syntax parser, keyboard interactions (Tab, Arrows, Esc), and zero-keystroke-retention security.

3. [03_medical_nomenclature_standardizer.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/07_ai_intellisense_feature/03_medical_nomenclature_standardizer.md)
   - **Colloquial & Vernacular to Standard Terminology Engine:** Real-time semantic conversion of informal and regional idioms into universal standards.
   - Clinical mappings: *"Sugar"* $\rightarrow$ *Type 2 Diabetes Mellitus (SNOMED: 44054006 / ICD-10: E11.9)* or *Fasting Blood Glucose (LOINC)*, *"Heart Attack"* $\rightarrow$ *Acute Myocardial Infarction (ICD-10: I21.9)* vs *Cardiac Arrest (ICD-10: I46.9)*, *"BP"*, *"Dama"*, *"Gas"*, *"Piliya"*, etc.
   - Interactive UI nomenclature pills and HL7 FHIR R4 Condition serialization.

4. [04_in_call_consent_and_abha_records.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/07_ai_intellisense_feature/04_in_call_consent_and_abha_records.md)
   - **In-Call ABHA Health Record Manifest & Dynamic Patient Consent:** Zero-knowledge metadata tagging in doctor console (`[ECG Available]`, `[Lipid Profile]`).
   - In-call permission request triggering real-time interactive pop-up on patient side (WebRTC DataChannel / WebSocket).
   - Multilingual audio TTS explanation in Kannada/Hindi, patient Accept/Decline protocol, and ephemeral in-canvas stream unlocking without local file saving.

5. [05_post_consultation_mom_scribe.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/07_ai_intellisense_feature/05_post_consultation_mom_scribe.md)
   - **Post-Consultation Ambient Meeting Minutes (MoM) Scribe:** Call-end ingestion, isolated dual-channel stereo audio diarization.
   - Bhashini/Whisper Indic multilingual transcription and clinical MoM generation.
   - Dual-stream reconciliation (Doctor live notes + Post-call scribe) and mandatory NMC Clinician Review & Signature Gate.

6. [06_ui_ux_consultation_notepad_specs.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/07_ai_intellisense_feature/06_ui_ux_consultation_notepad_specs.md)
   - **UI/UX Component & Interaction Specifications:** Complete color tokens, doctor notepad ghost-text DOM mechanics, ABHA record tag badges.
   - Mobile patient in-call consent modal wireframe, high-touch accessibility, and post-call clinician verification approval console.
