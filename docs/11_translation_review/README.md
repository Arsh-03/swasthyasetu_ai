# 11 · Translation review (Hindi & Kannada)

The texts below were drafted without a native speaker. They are written to be plain and accurate, but **a native Hindi and a native Kannada speaker should read them once** before real patients use the app. The consent text matters most: patients agree to recording based on it.

Fix a text in place, then (for the consent text) run `node scripts/sync-call-engine.mjs`.

## 1. Recording consent (most important)

File: `shared/call/consentText.ts`, the `hi` and `kn` blocks (copied into both apps by the sync script).

Every point must keep its meaning:

| Point | Must say |
|---|---|
| What is recorded | Only the call's audio; video is never recorded. |
| How | While the option is on, both voices are recorded separately, in short parts. On a phone, the patient's voice is captured by the doctor's app from the call. |
| Why | To write the minutes and check nothing the patient said is missing from the notes; the doctor checks everything first. |
| Your privacy | Name, phone, ABHA ID, address and other personal details are removed and replaced with anonymous labels before any AI use; the AI only sees the medical discussion and never knows who the patient is. |
| Your data stays with CareBridge | Processed only on CareBridge's own servers; no personal data is shared with outside companies. |
| Deleted after use | Audio is deleted once turned into text; only the doctor's notes are kept. |
| Your choice | The patient can say no and the consultation continues; recording can be stopped any time with "Stop recording". |

Also: the heading, the title, the Allow / Don't allow / Stop recording buttons, and the banner shown while recording.

## 2. Patient app: calls and one-tap consent

File: `frontend Patient/src/utils/translations.ts`, in the `kn` and `hi` blocks, the keys under the comment *"Consultation call (real call) & one-tap consent"*:

`incomingAudioCall`, `answerAudioOnly`, `callCalling`, `callConnecting`, `callAudioWith`, `callCancel`, `callWebOnly`, `callSlow`, `toastDoctorDeclined`, `toastDoctorOffline`, `toastNoAnswer`, `toastMissedCall`, `consentOneTap`.

Keep the `{name}` and `{minutes}` placeholders exactly as they are.

## 3. Doctor portal (all screens)

File: `frontend Doctor/src/portal/i18n.ts`, the `kn` and `hi` blocks (about 310 texts: navigation, home, schedule, meeting room, patients, visit summary, audit trail, settings).

Doctors read these, so clinical words may stay in English where that is what doctors use (e.g. "ABHA", "OTP", "BMI"). Keep `{name}`, `{n}`, `{time}`, `{when}`, `{reason}`, `{total}`, `{locked}`, `{shown}`, `{year}` exactly as they are. An English text with `|` ("one|many") has a singular and a plural form; Kannada and Hindi use one form.

## 4. Chat

- Patient app: `frontend Patient/src/utils/translations.ts`, keys `tabChat`, `chat…` and `toastDoctorMessage` (keep `{date}`, `{time}`, `{days}`).
- Emergency words: `backend/app/routers/chat.py`, `EMERGENCY_WORDS`. A native speaker should add the everyday ways people say chest pain, can't breathe, fainted, heavy bleeding, fits, poisoning, suicide in Kannada and Hindi (including Kannada / Hindi written in English letters, e.g. "ede novu", "saans nahi"). Missing a phrase means a real emergency is not flagged.

## 5. Heart rate check

- Patient app: `frontend Patient/src/utils/translations.ts`, keys `heartRate…`, `messageDoctor…` and `hr…` (keep `{n}`). The steps and the disclaimer ("an estimate, not a medical test; if you feel unwell, call 108") must keep their meaning.
- Doctor portal: `frontend Doctor/src/portal/i18n.ts`, keys `homeReadings…` to `actReading`.

## 6. Live assistant and visit summary

- Doctor portal: `frontend Doctor/src/portal/i18n.ts`, keys `assist…`, `addToNote`, `engine…`.
- Patient app: `frontend Patient/src/utils/translations.ts`, keys `summary…` (the offer text must keep: no names, saved only if they say yes).

## 7. ASHA worker screens

- Patient app: `frontend Patient/src/utils/translations.ts`, keys `asha…`. The consent text read to the patient (`ashaConsentBody`) must stay accurate and simple; the urgent message (`ashaUrgent…`) must stay clear.
- Doctor portal: `frontend Doctor/src/portal/i18n.ts`, keys from `homeReadingsHint2` to `kindWeight`.

## Status

| Language | Reviewed by | Date |
|---|---|---|
| Hindi | — | — |
| Kannada | — | — |
