# 09 · Consultation Call & AI Minutes

During a video consultation, the doctor can turn on **"Quick AI minutes & auto-update notes"**. With the patient's consent, the conversation is transcribed. The minutes are extracted, compared with the doctor's note, and anything missing is added to the note, highlighted in violet for review.

## Calling

- **Either side can call.** The patient calls from *Live consultation*; the doctor calls from the header or *Live Notepad*. Each can choose **video** or **audio only**.
- **The other side rings on any page.** They see a ringing card with a ring tone and a flashing tab title, and can answer, answer audio only, or decline.
  - If the doctor has a different patient open, the call reaches them through `WS /ws/v1/doctor/lobby`. Answering opens that patient's consultation.
  - Unanswered calls stop after 45 s.
- **If the camera can't be used** (no camera, permission refused, or already in use by another browser), the call continues with audio only.
- **The call keeps running across tabs**, because its state lives at portal level (`useConsultationCall`).
- **Doctor:** when a call starts, a floating window opens (bottom-right) with the video, the AI-minutes switch and the notepad. It can be minimised or enlarged.
- **Patient:** sees the call inline on *Live consultation*, and in a floating window on other tabs.
- **Notepad saving:** the notepad autosaves, and keeps its text in memory when it moves between the tab and the call window.

## Flow

1. Doctor and patient connect (see *Calling*). The call is WebRTC 1:1, signalled over `WS /ws/v1/encounters/{id}/call`.
2. Doctor switches the AI toggle on. The server creates a call session and sends `CONSENT_REQUEST` to the patient.
3. Patient sees the consent screen in English, हिन्दी or ಕನ್ನಡ (`frontend/src/components/call/consentText.ts`). It explains:
   - what is recorded
   - how it is recorded
   - why
   - that names, phone, ABHA ID and address are removed and the AI sees only the anonymous medical discussion
   - that processing stays on CareBridge servers
   - that the audio is deleted after transcription
   - that they can refuse or stop at any time
4. **Allow:** each side records **only its own microphone**, audio only, in 15 s chunks, and uploads to `POST /api/v1/calls/{session_id}/audio`.
   - The speaker label comes from the logged-in role, not from the client.
   - Uploads are refused without consent.
5. The server transcribes each chunk, then **de-identifies** the text (`services/deidentify.py`). The audio is discarded and never written to disk.
6. Minutes extraction runs on the redacted English text only (`services/call_minutes.py`). It uses built-in rules plus an optional local LLM. The result is compared with the current note.
7. Missing items are sent to the doctor as `AI_MINUTES`.
   - While the toggle is on, they are auto-inserted into the right note section with the patient's quote and its English translation.
   - The doctor can remove any of them.
   - Allergies added this way immediately feed the medication-safety check.
8. Either side can stop: the doctor turns the toggle off, or the patient presses **Stop recording**. Consent events are written to the audit log.

## Privacy design

| Rule | How |
|---|---|
| AI never knows who the patient/doctor is | Names (including Indic-script forms), titles and relations, phone, Aadhaar, ABHA, e-mail, PIN codes, dates, and the patient's address places are replaced with placeholders such as `[PATIENT]` and `[PHONE]` before any model call. |
| No third parties | ASR and LLM endpoints are your own servers (`SCRIBE_ASR_URL`, `INTELLISENSE_LOCAL_URL`). There is no cloud API code path. |
| Nothing kept | Audio is never stored. Transcripts live in memory for the call session and expire after 3 h. Only what the doctor keeps in the note is saved. |
| Consent first | No session or upload without explicit patient consent. Withdrawal stops recording on both sides. |

**Known limits of de-identification:**
- A bare first name with no title, if it isn't in the patient or doctor record, may slip through.
- The same applies to place names that aren't in the patient's address.

The model still cannot link such text to a person, because no identifiers travel with it. A named-entity model on the ASR server could close this gap later.

## Configuration (`.env`)

| Variable | Meaning |
|---|---|
| `SCRIBE_ASR_PROVIDER` | `stub` (scripted Hindi/Kannada/English demo, the default), `http` (your Whisper-style server), or empty (off) |
| `SCRIBE_ASR_URL` | OpenAI-compatible base URL. The app calls `/v1/audio/transcriptions` and, if translating, `/v1/audio/translations`. |
| `SCRIBE_ASR_MODEL` | e.g. `whisper-large-v3` |
| `SCRIBE_ASR_LANGUAGE` | empty = auto-detect |
| `SCRIBE_ASR_TRANSLATE` | `true` to also get an English translation for extraction |
| `SCRIBE_LLM_PROVIDER` | empty = rules only; `local` = also ask your Ollama model (`INTELLISENSE_LOCAL_URL`) |
| `SCRIBE_LLM_MODEL` | Ollama model name, e.g. a small instruct model |

## Network note

Calls use no STUN/TURN servers (`ICE_SERVERS = []` in `callClient.ts`), so they connect on the same LAN or machine. For calls across the internet, add a self-hosted TURN server (e.g. coturn) to keep media off third-party relays.

## Review needed

The Hindi and Kannada consent text was machine-drafted. It must be checked by native speakers, and ideally by legal (DPDP Act), before real use.
