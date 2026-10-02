# Multilingual Vernacular & Bhashini Voice Integration Engine

**Document ID:** LANG-BHASHINI-CB-2026-V1  
**Project:** CareBridge India  
**Target Languages:** Kannada (`kn-IN`), Hindi (`hi-IN`), English (`en-IN`)  
**AI Platform:** Bhashini (National Language Translation Mission, MeitY India)  

---

## 1. Architectural Strategy: The Audio-First Imperative

In semi-urban and rural healthcare delivery across Karnataka and northern states:
- Written clinical language contains complex jargon that patients cannot parse even if they can read basic vernacular text.
- Text-to-Speech (TTS) audio affordances convert abstract written consent into culturally and linguistically clear spoken Kannada and Hindi.

```mermaid
graph LR
    subgraph Input["Clinical Source Event"]
        DR_NOTE[Doctor's Diagnosis & Prescription\n(English Clinical Scribe)]
        CONSENT_REQ[Record Access Request\n(Doctor Specified)]
    end

    subgraph TranslationLayer["Bhashini NLP Layer"]
        NMT[Neural Machine Translation\nEN -> Kannada / Hindi]
        CLIN_CHECK[Clinical Terminology Dictionary\n(Preserves drug brand names without translation)]
    end

    subgraph VoiceSynthesis["TTS Speech Synthesis"]
        TTS[Bhashini / Web Speech API\nLocalized Speech Audio Stream]
    end

    DR_NOTE --> NMT
    CONSENT_REQ --> NMT
    NMT --> CLIN_CHECK
    CLIN_CHECK --> TTS
    TTS --> PATIENT[Patient Audio Playback\n'🔊 Listen in Kannada']
```

---

## 2. Preserving Clinical Integrity in Translation

A known hazard in automated medical translation is that drug names can be erroneously translated literally (e.g., translating a brand name into a common noun).

**CareBridge Safe Vernacular Rules:**
1. **Never translate pharmaceutical names:** Drug names, active chemical ingredients, and metric dosages (e.g. *Tamsulosin 0.4mg*) remain in their original Latin/English form or transliterated phonetically, accompanied by universal visual iconography (sun/moon for day/night timing).
2. **Standardized Clinical Glossaries:** Common terms are mapped to verified vernacular terms:
   - *Ultrasound Pelvis & Abdomen* $\rightarrow$ ಉದರ ಮತ್ತು ಶ್ರೋಣಿಯ ಸ್ಕ್ಯಾನ್ ವರದಿ (Kannada) / पेट और पेल्विस का अल्ट्रासाउंड (Hindi).
   - *Acute Renal Colic* $\rightarrow$ ಮೂತ್ರಪಿಂಡದ ಕಲ್ಲಿನ ತೀವ್ರ ನೋವು (Kannada) / गुर्दे की पथरी का दर्द (Hindi).
   - *Purpose-bound consent* $\rightarrow$ ನಿರ್ದಿಷ್ಟ ಉದ್ದೇಶಕ್ಕಾಗಿ ಮಾತ್ರ ಅನುಮತಿ (Kannada).
