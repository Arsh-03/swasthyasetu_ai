// Shared types for the AI IntelliSense consultation notepad.
// Mirrors backend/app/services/clinical_lexicon.py and routers/intellisense.py.

export type CodeSystem = 'SNOMED_CT' | 'ICD_10' | 'ICD_11' | 'LOINC' | 'RxNorm' | 'CDCI';
export type Severity = 'routine' | 'critical';
export type NoteSection = 'complaints' | 'history' | 'exam' | 'assessment' | 'labs' | 'plan';

export interface TerminologyCode {
  system: CodeSystem;
  code: string;
  display?: string;
}

export interface LexiconTerm {
  text: string;
  category: string;
  weight: number;
  codes: TerminologyCode[];
}

export interface ShorthandEntry {
  abbr: string;
  expansion: string;
  category: string;
  codes?: TerminologyCode[];
}

export interface RegexRule {
  pattern: string;
  replacement: string;
  flags: string;
  category?: string;
}

export interface NomenclatureCandidateDef {
  name: string;
  category: string;
  severity: Severity;
  codes: TerminologyCode[];
  prior: number;
  sections: NoteSection[];
  keywords: string[];
}

export interface NomenclatureEntry {
  phrases: string[];
  not_followed_by?: string[];
  candidates: NomenclatureCandidateDef[];
}

export interface Lexicon {
  version: string;
  auto_convert_threshold: number;
  terms: LexiconTerm[];
  shorthand: ShorthandEntry[];
  shorthand_patterns: RegexRule[];
  punctuation_rules: RegexRule[];
  section_headings: { pattern: string; section: NoteSection }[];
  nomenclature: NomenclatureEntry[];
  template: string;
  /** Plain English / narrative words spell-check must never "correct". */
  common_words?: string[];
  tier3?: Tier3Info;
}

/** Tier 3 language-model completion availability, reported by the server. */
export interface Tier3Info {
  enabled: boolean;
  /** 'stub' = canned development suggestions, 'local' = self-hosted model server. */
  provider?: 'stub' | 'local' | string;
  model?: string;
  state?: 'disabled' | 'starting' | 'ready' | 'paused' | 'offline';
}

export interface CompletionResult {
  completion: string | null;
  cached?: boolean;
  provider?: string;
  model?: string;
  latency_ms?: number;
  skipped?: string;
  tier3?: Tier3Info;
}

export interface NomenclatureCandidate {
  name: string;
  codes: TerminologyCode[];
  category: string;
  severity: Severity;
  score: number;
}

/** A colloquial term found in the note, with ranked standard concepts. */
export interface NomenclatureMatch {
  start: number;
  end: number;
  original: string;
  section: NoteSection | null;
  confidence: number;
  auto_convert: boolean;
  candidates: NomenclatureCandidate[];
}

export interface SpellingIssue {
  start: number;
  end: number;
  original: string;
  suggestion: string;
  /** Clear-cut fix: applied automatically when auto-correct is on. */
  auto?: boolean;
}

export interface AnalysisResult {
  section: NoteSection | null;
  nomenclature: NomenclatureMatch[];
  spelling: SpellingIssue[];
  /** Medication safety checks for this patient (server only). */
  safety?: SafetyResult;
  server_ms?: number;
}

export type SafetySeverity = 'contraindicated' | 'major' | 'moderate' | 'caution' | 'minor' | 'unknown';

export interface SafetyAlert {
  kind: 'interaction' | 'allergy';
  severity: SafetySeverity;
  title: string;
  detail: string;
  source: string;
  context: string;
  /** Where the medicines involved appear in the note. */
  spans: [number, number][];
  low_priority: boolean;
}

export interface SafetyResult {
  alerts: SafetyAlert[];
  medicines: { start: number; end: number; text: string; drugs: string[] }[];
  checked_against: { current_medications: string[]; allergies: string[] };
  interaction_data: string;
}

/** Inline suggestion shown as ghost text / dropdown at the cursor. */
export interface Suggestion {
  kind: 'complete' | 'phrase' | 'shorthand' | 'nomenclature' | 'spelling' | 'ai';
  replaceStart: number;
  replaceEnd: number;
  insert: string;
  label: string;
  detail?: string;
  codes?: TerminologyCode[];
  severity?: Severity;
  /** Original text, for coded-term revert. */
  original?: string;
  confidence?: number;
  alternatives?: NomenclatureCandidate[];
  /** Where it came from (e.g. "SNOMED CT", "ICD-11"); shown on the coded-term chip. */
  source?: string;
}

/** Official terminology available on the server (local store, see docs/08_standards_integration). */
export interface TerminologyInfo {
  available: boolean;
  systems: string[];
}

export interface TermSearchItem {
  system: CodeSystem;
  code: string;
  display: string;
  term: string;
  category: string | null;
  label: string;
  codes: TerminologyCode[];
}

export interface TermSearchResult {
  span_words: number;
  results: TermSearchItem[];
}

/**
 * A tracked span in the note.
 * 'coded'     — standardized term the doctor accepted (or auto-converted); shown as a pill.
 * 'dismissed' — doctor reverted/ignored a conversion here; the engine won't re-suggest it.
 */
export interface Annotation {
  id: string;
  /**
   * coded: standardized term with codes (chip). autocorrect: a spelling fix that was applied
   * automatically (no chip; undoing it turns it into 'dismissed' so it isn't re-applied).
   */
  kind: 'coded' | 'autocorrect' | 'dismissed' | 'call';
  start: number;
  end: number;
  original: string;
  name: string;
  codes: TerminologyCode[];
  category: string;
  severity: Severity;
  confidence: number;
  alternatives: NomenclatureCandidate[];
  auto: boolean;
  /** For automatic changes: how far past the word the doctor's cursor was, to restore it on Ctrl+Z. */
  caretGap?: number;
}

export type EngineStatus = 'connecting' | 'live' | 'rest' | 'offline';
