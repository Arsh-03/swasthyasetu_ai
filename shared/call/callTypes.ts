// Types shared by the consultation call and the notepad.

export type CallRole = 'doctor' | 'patient';

/** Languages of the patient-facing call texts. */
export type CallLanguage = 'en' | 'hi' | 'kn';

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

/** Live assistant (backend/app/services/live_assistant.py). */
export type AssistEngine = 'live' | 'demo';

export interface AssistSuggestion {
  id: string;
  kind: 'ASK' | 'CHECK' | 'NOTE' | 'SAFETY' | string;
  text: string;
}

export interface AssistAlert {
  id: string;
  kind: 'red_flag' | 'allergy' | string;
  severity: string;
  title: string;
  detail: string;
  quote: string;
  quote_english: string;
  at_ms: number | null;
  source: string;
}

export interface AssistState {
  /** Speech-to-text: your own server ('live') or the scripted demo conversation ('demo'). */
  speech: AssistEngine | null;
  /** Suggestions: your own model ('live') or the built-in demo engine ('demo'). */
  model: AssistEngine | null;
  /** Text arriving right now (token by token), or null. */
  streaming: string | null;
  suggestions: AssistSuggestion[];
  alerts: AssistAlert[];
}

export interface CallMinutes {
  session_id: string;
  transcript: TranscriptLineView[];
  minutes: Record<string, string[]>;
  missing: CallFinding[];
  identifiers_removed: Record<string, number>;
  engine: { speech: string | null; analysis: string };
}
