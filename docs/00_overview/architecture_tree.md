# CareBridge India — Engineering Documentation Sitemap

Welcome to the enterprise engineering documentation tree for **CareBridge India (SwasthyaSetu AI)**.  
Organized according to professional software architecture and clinical compliance standards.

---

## 🌳 Documentation Tree

```text
docs/
├── 00_overview/
│   ├── prd.md                                # Executive Summary & Product Requirements (PRD)
│   └── architecture_tree.md                  # This Sitemap & Navigation Tree
│
├── 01_architecture/
│   ├── tech_stack_evaluation.md              # Python/FastAPI vs Node, React PWA vs Native, PostgreSQL+Redis
│   ├── network_adaptive_engine.md            # WebRTC Dynamic Bitrate Probe & Multi-Tier Degradation
│   ├── system_topology.md                    # C4 Container Diagram & System Boundaries
│   └── sequence_flows.md                     # End-to-end Sequence Diagrams
│
├── 02_data/
│   ├── schema.md                             # PostgreSQL 16 DDL (Relational + JSONB schemas)
│   ├── fhir_r4_mappings.md                   # HL7 FHIR R4 Bundles & ABDM Schema Mapping
│   └── storage_vault.md                      # Private Encrypted S3/MinIO Storage & Proxy Rules
│
├── 03_security_and_compliance/
│   ├── stride_threat_model.md                # STRIDE Threat Modeling Matrix & Mitigations
│   ├── dpdp_and_disha_compliance.md          # Indian DPDP Act 2023 & DISHA Legal Verification
│   └── consent_token_lifecycle.md            # HMAC-SHA256 Tokenization, Redis TTL, 1-Click Revocation
│
├── 04_features_and_engines/
│   ├── consent_engine.md                     # Granular Purpose-Specific Consent Mechanics
│   ├── ddi_safety_engine.md                  # Clinical Decision Support & Drug-Drug Interaction Rules
│   ├── multilingual_bhashini_engine.md       # Kannada, Hindi, English Vernacular & Audio TTS
│   ├── ai_clinical_scribe.md                 # Clinician-in-the-Loop SOAP Drafting Gate
│   └── patient_and_doctor_portals.md         # Portal Feature Matrices & Interaction Rules
│
├── 05_ui_ux/
│   ├── design_system_tokens.md               # HSL Palettes, Inter/Noto Fonts, 8px Grid & Shadows
│   └── screen_flows.md                       # Screen-by-Screen User Journey Maps
│
├── 06_delivery_and_mobile/
│   ├── pwa_to_apk_capacitor.md               # PWA-First Delivery & Capacitor Android APK Build Pipeline
│   └── sprint_roadmap.md                     # 4-Milestone Hackathon to Pilot Rollout Plan
│
├── 07_ai_intellisense_feature/
│   ├── 01_architecture_and_pipeline.md       # Dual-Path Consultation Documentation Architecture
│   ├── 02_realtime_intellisense_engine.md    # Real-Time Keystroke Tokenizer, Autocomplete & Punctuation
│   ├── 03_medical_nomenclature_standardizer.md # Colloquial-to-Universal Standard Terminology (SNOMED/ICD-10)
│   ├── 04_in_call_consent_and_abha_records.md # In-Call ABHA Record Manifest & Dynamic Patient Consent Pop-up
│   ├── 05_post_consultation_mom_scribe.md    # Post-Call Meeting Minutes (MoM) & Dual-Stream Reconciliation
│   └── 06_ui_ux_consultation_notepad_specs.md # Doctor Notepad UI, Patient Pop-up & Verification Gate Specs
│
└── preview.html                              # Standalone Interactive Visual Prototype
```

---

## ⚡ Quick Links to Key Technical Decisions
- **Real-Time Medical IntelliSense & Autocomplete:** Read [02_realtime_intellisense_engine.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/07_ai_intellisense_feature/02_realtime_intellisense_engine.md).
- **Colloquial to SNOMED/ICD-10 Mapping ("Sugar" -> Diabetes, "Heart Attack" -> AMI):** Read [03_medical_nomenclature_standardizer.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/07_ai_intellisense_feature/03_medical_nomenclature_standardizer.md).
- **In-Call ABHA Record Tags & Dynamic Patient Consent:** Read [04_in_call_consent_and_abha_records.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/07_ai_intellisense_feature/04_in_call_consent_and_abha_records.md).
- **Post-Call Meeting Minutes (MoM) & Dual-Stream Reconciliation:** Read [05_post_consultation_mom_scribe.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/07_ai_intellisense_feature/05_post_consultation_mom_scribe.md).
- **Why React PWA + Capacitor APK:** Read [tech_stack_evaluation.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/01_architecture/tech_stack_evaluation.md#2-frontend--mobile-strategy-pwa-first--capacitor-apk-bridge) and [pwa_to_apk_capacitor.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/06_delivery_and_mobile/pwa_to_apk_capacitor.md).
- **Backend-Enforced Consent & Revocation:** Read [consent_token_lifecycle.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/03_security_and_compliance/consent_token_lifecycle.md).
- **Low-Bandwidth WebRTC Degradation:** Read [network_adaptive_engine.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/01_architecture/network_adaptive_engine.md).
- **Drug-Drug Interaction Safety:** Read [ddi_safety_engine.md](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/04_features_and_engines/ddi_safety_engine.md).
- **Interactive Visual Prototype:** Open [preview.html](file:///c:/Users/AITNS/Documents/swasthyasetu_ai/docs/preview.html).

