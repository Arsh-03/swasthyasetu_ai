# SETU-Shield v1: privacy standard for sending patient data to AI

**SETU-Shield** governs every request that carries consultation data to an AI model, whether our own server
(Ollama + Whisper on Colab today) or a third-party API later. The goal is that the AI gets enough to give a
general clinical answer, and nothing that identifies the patient or the doctor.

Masking names is only the second of seven steps. The other steps cover what masking alone misses:
- fields that should never be sent in the first place;
- details that together point to one person, such as an exact age plus a town;
- IDs that link several requests to the same person;
- a mask that failed to catch something;
- having no record of what was sent.

Code: [`backend/app/services/privacy_gateway.py`](../../backend/app/services/privacy_gateway.py).
Tests: `cd backend && python -m tests.test_privacy_gateway`.

## The seven steps

| Step | What happens | Example |
| :--- | :--- | :--- |
| **S1 Minimise** | Each feature has a list of the fields it may send. Everything else is dropped before masking. | Autocomplete may send: note, conversation, age band, sex, section. The patient ID, name and district are dropped. |
| **S2 Mask** | Direct identifiers become placeholders. | `Ramesh Gowda` → `[PATIENT]`, `98450 12345` → `[ID_1]`, `Hassan` → `[PLACE_1]`, `usr_ramesh_gowda` → `[ID_2]` |
| | Misspelt names are caught too: same first letter, one or two letters different, and not an ordinary word. | `Goda`, `Ramsh` → `[PERSON_1]`. `rash`, `dose` and `share` stay. |
| **S3 Generalise** | Details that narrow down a person are made coarser, including inside free text. | Age 54 → `50s`. `54M` → `50s M`. `aged 81` → `aged 80+`. |
| **S4 Unlink** | No patient, doctor or consultation IDs, and no stable per-person tokens. A fresh random request ID each time. | Two requests about the same patient look unrelated to the AI server. |
| | Requests come only from our server, never from a phone or browser. | The AI provider sees one hospital, not individual doctors or patients. |
| **S5 Verify** | The exact payload is scanned before sending for every identifier we hold for this patient and doctor, plus general personal-data patterns. | If anything is found, the request is **not sent** and the feature uses its offline rules (fail closed). |
| | What the scan looks for: names in Latin and Indic scripts, misspellings, phone numbers however they are spaced, ABHA, Aadhaar, e-mail, record IDs, NMC numbers, full dates. | |
| **S6 Record** | Each request is logged without its content: purpose, destination, fields, how many identifiers were masked, size and SHA-256. | The first request per consultation and feature goes into the audit trail as `AI_DATA_SHARED_DEIDENTIFIED`. Blocked requests are logged as `AI_OUTBOUND_BLOCKED`. |
| **S7 Restore** | Placeholders in the AI's answer are swapped back inside our server, only for the doctor's own screen. | The AI suggests "[PATIENT] advised rest"; the doctor sees "Ramesh Gowda advised rest". |

### Hard rules

- **Voice never goes to a third party.** A voice identifies a person, and masking can't remove that. Raw
  audio is only sent when `AI_SPEECH_DESTINATION=self_hosted`. If it is set to `third_party`, the audio is refused.
- **Fail closed.** If the check finds personal data, nothing is sent and the feature keeps working with offline rules.
- **No AI keys or gateway tokens in the apps.** Only the backend talks to AI servers.

## Every outbound AI request goes through it

| Feature | Purpose id | What it may send |
| :--- | :--- | :--- |
| Notepad autocomplete | `notepad_autocomplete` | Masked note excerpt, masked conversation, age band, sex, section |
| Live assistant | `live_suggestions` | Masked transcript, masked note, allergy names |
| Call minutes check | `minutes_check` | Masked transcript, masked note, items already found |
| Patient summary | `patient_summary` | Masked facts, language |
| Speech to text | `speech_to_text` | Audio, self-hosted only |

## See it working, no AI server needed

In the doctor portal, open the notepad and click **What the AI sees**. It shows three things:
- your note next to the exact request the autocomplete would send;
- a pass/fail line for each of S1–S7;
- the recent AI requests for this consultation (no content).

Nothing is sent when you open it. API:

- `GET /api/v1/privacy/standard`: the steps, each feature's allowed fields, and where requests go
- `POST /api/v1/privacy/preview` `{encounter_id, text}`: the exact request that would be sent, with the result of each check
- `GET /api/v1/privacy/ledger?encounter_id=`: recent AI requests (no content)

## Settings (`.env`)

| Variable | Default | Meaning |
| :--- | :--- | :--- |
| `AI_TEXT_DESTINATION` | `self_hosted` | `third_party` when the language model is an outside API |
| `AI_SPEECH_DESTINATION` | `self_hosted` | `third_party` blocks all audio uploads |

## On the phone

- **Login token:** kept in memory only, never written to storage.
- **Offline data:** the ASHA worker's unsent visit readings are encrypted with AES-256-GCM
  ([`secureVault.ts`](../../frontend%20Patient/src/services/secureVault.ts)):
  - **Android / iOS:** the random key lives in the Android Keystore / iOS Keychain, readable only by this app, on this
    device, while it is unlocked. Copying the app's files gives only ciphertext.
  - **Web:** a non-extractable WebCrypto key in IndexedDB.
  - **Tampering:** GCM detects edits, so a record changed on disk fails to decrypt and is ignored rather than trusted.

### What a modified APK can and cannot do

No app can stop someone from unpacking and changing an APK. The design makes that useless:

- **Nothing to steal:** the app contains no AI keys, gateway tokens or other secrets.
- **The server decides everything:** consent, roles, the join window and every SETU-Shield step run on the
  server. A modified app can only do what its signed-in user is already allowed to do.
- **No access to the original app's data:** Android won't install a re-signed APK over the original, so the
  original must be removed first, and that wipes its data and its Keystore key.

### Not done yet (for production)

- **App attestation:** Play Integrity or App Attest, so the server can refuse modified builds outright.
- **HTTPS:** the local demo uses http; the Colab tunnel already uses HTTPS.
- **Encryption at rest on the server:** field-level encryption of stored records, with keys in a key manager.

## Known limits

- **Masking is rule-based:** an unusual name said without a title, and not on record, can slip past the masking.
  The verify step only knows the names we hold.
- **Context can still narrow things down:** a very rare condition plus an age band could in theory point to one
  person. Generalisation reduces this but doesn't remove it.
