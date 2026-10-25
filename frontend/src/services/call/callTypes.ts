// Types shared by the consultation call and the notepad.

export type CallRole = 'doctor' | 'patient';

/** AI minutes status shown to the doctor. */
export type AiState = 'off' | 'waiting_consent' | 'recording' | 'finishing' | 'declined' | 'withdrawn' | 'unavailable';

export interface TranscriptLineView {
  speaker: 'doctor' | 'patient' | string;
  start_ms: number;
  text: string;        // as spoken (any language)
  english: string;     // English used for analysis
  language: string;
}

/** Something said in the call that isn't in the doctor's note yet. */
export interface CallFinding {
  id: string;
  kind: 'symptom' | 'allergy' | 'medication' | 'family' | 'advice' | 'other' | string;
  section: 'complaints' | 'history' | 'plan' | 'exam' | 'labs' | string;
  text: string;
  severity: 'routine' | 'urgent' | string;
  source: 'rules' | 'model' | string;
  speaker: string;
  at_ms: number | null;
  quote: string;
  quote_english: string;
}

export interface CallMinutes {
  session_id: string;
  transcript: TranscriptLineView[];
  minutes: Record<string, string[]>;
  missing: CallFinding[];
  identifiers_removed: Record<string, number>;
  engine: { speech: string | null; analysis: string };
}
