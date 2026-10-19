# UI/UX Specifications: Doctor Consultation Notepad & Patient In-Call Consent

**Document ID:** FEAT-UIUX-INTELLISENSE-2026-V1  
**Project:** CareBridge India (SwasthyaSetu AI)  
**Scope:** Complete Component Specifications, Interaction State Machines & Accessibility Tokens  
**Version:** 1.0.0 (Production Blueprint)

---

## 1. Visual Design System & Color Tokens

The consultation UI follows CareBridge India's high-contrast, accessible design system engineered for prolonged clinical usage without eye strain and responsive across desktop, tablet, and mobile browsers.

```css
:root {
  /* Surface & Background */
  --cb-bg-base: hsl(220, 24%, 97%);
  --cb-surface-card: hsl(0, 0%, 100%);
  --cb-surface-elevated: hsl(220, 20%, 94%);
  --cb-border-subtle: hsl(220, 16%, 88%);
  
  /* Primary Clinical Accents */
  --cb-primary-teal: hsl(175, 75%, 28%);
  --cb-primary-teal-light: hsl(175, 60%, 93%);
  --cb-primary-teal-hover: hsl(175, 75%, 22%);
  
  /* Typography Colors */
  --cb-text-main: hsl(222, 47%, 11%);
  --cb-text-muted: hsl(215, 16%, 47%);
  --cb-text-ghost: hsl(215, 16%, 65%);
  
  /* Status & Alerts */
  --cb-status-success: hsl(152, 69%, 31%);
  --cb-status-success-bg: hsl(152, 57%, 94%);
  --cb-status-warning: hsl(38, 92%, 50%);
  --cb-status-warning-bg: hsl(40, 96%, 95%);
  --cb-status-danger: hsl(0, 84%, 60%);
  --cb-status-danger-bg: hsl(0, 86%, 97%);
  
  /* Standardized Nomenclature Pill Accents */
  --cb-pill-snomed: hsl(190, 80%, 25%);
  --cb-pill-snomed-bg: hsl(190, 70%, 92%);
  --cb-pill-icd: hsl(260, 60%, 35%);
  --cb-pill-icd-bg: hsl(260, 50%, 94%);
}
```

---

## 2. Doctor Console: Real-Time IntelliSense Notepad Component

### 2.1 Component Wireframe & DOM Hierarchy

```
+---------------------------------------------------------------------------------------------------+
|  [Tabs: 📝 Real-Time Notepad (Active) | 🫀 Live ECG Canvas | 📋 Reconciled MoM ]                 |
+---------------------------------------------------------------------------------------------------+
|  PATIENT RECORDS WITH ABHA:                                                                       |
|  [ 🫀 ECG Trace (18 Oct 2026) 🔒 Request Access ]  [ 🧪 Lipid Profile 🔒 Request Access ]         |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  Chief Complaints & History:                                                                      |
|  Patient presents with complaints of severe chest pain for 2 days radiating to left arm.         |
|  History of [ 🏷️ Type 2 Diabetes Mellitus | SNOMED: 44054006 ▾ ] and                              |
|  [ 🏷️ Acute Myocardial Infarction | ICD-10: I21.9 ▾ ] in 2022.                                    |
|                                                                                                   |
|  Vitals & Observations:                                                                           |
|  BP: 154/96 mmHg | Pulse: 104 bpm | SpO2: 96% on room air                                         |
|  Patient appears diaphoretic, mild distress.                                                      |
|                                                                                                   |
|  Differential Assessment:                                                                         |
|  Acute Coronary Syndrome [ r/o STEMI                                                            ] |  <-- Ghost Text
|                          +----------------------------------------------------------------------+ |
|                          | 💡 Suggestion: Rule out ST-Elevation Myocardial Infarction (Tab ↹)   | |
|                          |    1. Acute ST-Elevation Myocardial Infarction [ICD-10: I21.0]       | |
|                          |    2. Unstable Angina Pectoris [ICD-10: I20.0]                       | |
|                          |    3. Non-ST Elevation Myocardial Infarction [ICD-10: I21.4]         | |
|                          +----------------------------------------------------------------------+ |
|                                                                                                   |
|  Plan / Medications:                                                                              |
|  Tab. Sorbitrate 5mg sublingual SOS for chest pain                                                |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
|  [ 💾 Save Draft Note ]                   [ ⚡ Trigger Post-Call MoM Scribe ] [ ✍️ Verify & Sign ] |
+---------------------------------------------------------------------------------------------------+
```

### 2.2 Ghost Text Overlay Implementation Mechanics
The Notepad uses a two-layer rendering technique to achieve smooth ghost text without flickering:
1. **Background Layer (`<div class="ghost-overlay">`):** Renders the full text including completed ghost text in muted gray (`var(--cb-text-ghost)`), absolutely positioned directly behind the editable surface.
2. **Foreground Layer (`<textarea class="editor-input">` or `contenteditable`):** Has transparent background and identical font metrics (`font-family: 'JetBrains Mono', monospace`, `line-height: 1.6`, `font-size: 15px`).
3. When the user presses `Tab`, a JavaScript event listener catches the keydown, prevents default focus jump, appends the ghost text snippet to the cursor index, and fires the syntax standardizer.

---

## 3. ABHA Record Tags & In-Call Consent Trigger Bar

### 3.1 Tag States
The ABHA Record Manifest bar provides instant visual feedback on record access states:

| State | Visual Badge | Interactive Action |
| :--- | :--- | :--- |
| **Locked (Default)** | `[ 🔒 ECG Record (18 Oct 2026) ]` | Clicking triggers **"Request Access"** modal with purpose selection. |
| **Pending Approval** | `[ ⏳ Request Sent... (30s) ]` | Pulsing amber ring; disables duplicate clicks. |
| **Active / Unlocked** | `[ 🟢 ECG Record (28m remaining) ]` | Clicking switches active view to the live in-browser ECG waveform canvas. |
| **Declined** | `[ ❌ Access Declined by Patient ]` | Badge turns soft red; disables re-prompting for 10 minutes. |
| **Expired** | `[ ⏱️ Session Expired ]` | Stream closed; requires fresh explicit consent. |

---

## 4. Patient-Side In-Call Dynamic Consent Pop-Up

### 4.1 Low-Bandwidth Responsive Specification
Designed specifically for sub-$100 Android smartphones (Chrome / PWA / Capacitor):
- Full viewport non-blocking modal overlay (`z-index: 9999`) centered on screen without interrupting the ongoing WebRTC audio/video call.
- Zero horizontal scrolling.
- Massive touch targets (minimum 54px height) to accommodate patients with tremors or low digital familiarity.
- **Audio TTS Speaker Button:** Always prominent; auto-plays explanation in patient's preferred language if designated illiterate.

```html
<div class="incall-consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-title">
  <div class="consent-card">
    <div class="consent-header">
      <span class="pulse-indicator">🔔</span>
      <h3 id="consent-title">Doctor Access Request / ಡಾಕ್ಟರ್ ಅನುಮತಿ ಕೋರಿಕೆ</h3>
    </div>
    
    <div class="consent-body">
      <div class="record-badge">
        <span class="icon">🫀</span>
        <div class="details">
          <strong>ECG Record / ಇಸಿಜಿ ವರದಿ</strong>
          <small>Hassan District Hospital • 18 Oct 2026</small>
        </div>
      </div>
      
      <p class="purpose-text">
        <strong>Dr. Ananya Sharma</strong> requests access for <strong>30 minutes</strong> to assess your acute chest discomfort.
      </p>
      
      <button class="tts-button" onclick="playKannadaConsentAudio()">
        🔊 ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ (Listen in Kannada)
      </button>
    </div>
    
    <div class="consent-actions">
      <button class="btn-decline" onclick="handleConsentDecline()">
        ❌ DECLINE (ಬೇಡ)
      </button>
      <button class="btn-approve" onclick="handleConsentApprove()">
        ✅ ALLOW (ಅನುಮತಿಸಿ)
      </button>
    </div>
  </div>
</div>
```

---

## 5. Post-Call Doctor Verification & Sign-Off Screen

Once the call ends, the screen transitions to the **Post-Consultation Verification Gate**:

```
+---------------------------------------------------------------------------------------------------+
|  ENCOUNTER #ENC-9481 — CLINICAL VERIFICATION & APPROVAL GATE               [ Status: DRAFT_READY ]|
+---------------------------------------------------------------------------------------------------+
|  [ 💡 Ambient Scribe has reconciled your live notes with the audio transcript. Review changes: ]  |
|                                                                                                   |
|  SUBJECTIVE:                                                                                      |
|  Patient presents with acute chest pain radiating to left arm for 48 hours.                       |
|  <span class="highlight-scribe">+ [Ambient Scribe Addition]: Patient noted severe diaphoresis at onset.</span>   |
|                                                                                                   |
|  OBJECTIVE:                                                                                       |
|  BP: 154/96 mmHg | Pulse: 104 bpm | SpO2: 96%                                                     |
|  ECG Review (Hassan DH 18-Oct): Normal sinus rhythm with ST depressions in V4-V6.                |
|                                                                                                   |
|  ASSESSMENT:                                                                                      |
|  [ 🏷️ Acute Coronary Syndrome | ICD-10: I24.9 ]                                                   |
|  [ 🏷️ Type 2 Diabetes Mellitus | SNOMED: 44054006 ]                                              |
|                                                                                                   |
|  PLAN & PRESCRIPTIONS:                                                                            |
|  1. Tab. Sorbitrate 5mg Sublingual SOS (Dispense: 5 tabs)                                         |
|  2. Tab. Aspirin 75mg OD (Dispense: 14 tabs)                                                      |
|  3. URGENT: Referral to Hassan District Hospital Emergency Dept for Serial Troponin-I.            |
|                                                                                                   |
|  ⚠️ SAFETY CHECK: No Drug-Drug Interactions Detected. Verified against NLEM formulary.           |
+---------------------------------------------------------------------------------------------------+
|  [ ❌ Discard Encounter ]            [ ✏️ Edit Manually ]         [ ✍️ Approve & Cryptographically Sign ]|
+---------------------------------------------------------------------------------------------------+
```

### Digital Approval Action:
1. Doctor clicks **"Approve & Cryptographically Sign"**.
2. System prompts for doctor's registered 4-digit PIN or WebAuthn biometric touch.
3. Encounter state transitions to `APPROVED_SIGNED`.
4. Cryptographic HMAC signature + Practitioner NMC Registration Number is stamped onto the record.
5. FHIR R4 Encounter Bundle is emitted to the ABDM Health Information Exchange.
