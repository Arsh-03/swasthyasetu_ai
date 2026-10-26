# CHIBI: Central Health Informatics Bot Interface

CHIBI is the assistant's face: a small animated character in the corner of the doctor portal and the patient
app. Features plug into it, so there is one assistant instead of many pop-ups.

| Where | What CHIBI does |
| :--- | :--- |
| Consultation (doctor) | Listens quietly. Every few lines it processes a **batch** with its **memory** of the whole consultation. What was said but isn't in the note appears as grey text on an empty line under the right heading (Tab adds it), or in CHIBI's panel with "+ Add". Danger signs turn it red. Nothing pops up. |
| Doctor, outside a consultation | Shortcuts: the Test Lab, unread messages, notifications |
| Patient app | Join my consultation, check my heart rate, my medicines today, message my doctor, who has seen my records (the consent manager) |
| Test Lab (doctor portal → CHIBI Lab) | Talk with no call: browser speech (or your Whisper server) goes to batches with memory, then the note fills in, then a summary and structured note at the end |

Moods: `idle` (blinks), `listening` (sound rings), `thinking` (dots), `hint` (violet, something is ready),
`alert` (red).

## How the agent works (`backend/app/services/consult_agent.py`)

Each batch runs after 3 new lines or 12 seconds. It sends the AI three things, all through SETU-Shield
(masked, verified, logged):

- **MEMORY:** CHIBI's running summary of the whole consultation. This keeps each request small while still
  carrying the full context.
- **NEW LINES:** what was said since the last batch.
- **NOTE:** what the doctor has written so far.

The AI returns:
- an updated memory;
- new note lines, each tagged with a note-format heading;
- important things said but missing from the note;
- at most 2 suggestions.

The rule engine always runs as well, so CHIBI works with no AI at all. At the end, `finish` writes the
consultation summary.

The AI is your Ollama server or Gemini / OpenAI (`AI_PROVIDER`, see `ai_client.py`). Free tiers allow few
requests per minute, so autocomplete gives way and CHIBI's batches get through.

## Adding a skill (for the navigation / accessibility work)

Doctor portal:

```ts
import { registerChibiSkill } from './portal/Chibi';
const remove = registerChibiSkill({
  id: 'nav-voice', label: 'Navigate by voice', icon: 'mic',
  when: ({ inConsultation }) => !inConsultation,
  run: () => startVoiceNavigation(),
});
```

Patient app:

```ts
import { registerChibiSkill } from './src/components/chibi/Chibi';
registerChibiSkill({ id: 'read-screen', label: 'Read this screen aloud', icon: 'speaker', run: readScreen });
```

Skills appear in CHIBI's panel at once. Call the returned function to remove one.

## The note format CHIBI writes into

The headings are Chief Complaints, History, Allergies, Current Medications, Vitals, Examination, Diagnosis,
Investigations, Rx, Advice and Follow-up ([`note_format.py`](../../backend/app/services/note_format.py)).

When the doctor signs, the note is parsed once:
- every Rx line ("Tab Paracetamol 650 mg TDS x 5 days after food") becomes a medicine on the patient's plan,
  with a morning, afternoon or night schedule;
- new allergies go onto the chart;
- the visit page and the patient's "Your last visit" card read from the same parsed record.

The sign-off form fills itself from the note.
