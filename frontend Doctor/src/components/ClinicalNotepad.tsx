// AI IntelliSense consultation notepad (docs/07_ai_intellisense_feature).
//
// Rendering: a transparent <textarea> sits on top of an overlay <div> with identical font metrics.
// The overlay draws ghost text, coded-term highlights and review underlines; the textarea handles input.
// Edits go through document.execCommand('insertText') so the browser's native Ctrl+Z also undoes
// standardizations.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { authFetch, getStoredToken, apiUrl } from '../services/backend';
import { IntelliSenseConnection, loadLexicon } from '../services/intellisense/intellisenseClient';
import { LocalEngine, formatCode, shiftAnnotations, type TextEdit } from '../services/intellisense/localEngine';
import { TypingRhythm, aiRemaining, shouldRequest, type AiSuggestion } from '../services/intellisense/tier3';
import type {
  AnalysisResult, Annotation, SafetyAlert, CompletionResult, EngineStatus, Lexicon, NomenclatureCandidate, NomenclatureMatch,
  NoteSection, Suggestion, TermSearchResult, TerminologyInfo, Tier3Info,
} from '../services/intellisense/types';
import type { CallFinding, CallMinutes } from '../services/call/callTypes';
import './ClinicalNotepad.css';
import { Icon, type IconName } from './ui/Icon';

// Design-system icons (Phosphor via <Icon>), named like the components they replace.
const glyph = (name: IconName) =>
  function Glyph({ size = 16, className }: { size?: number; className?: string }) {
    return <Icon name={name} size={size} className={className} />;
  };
const NotebookPen = glyph('clinicalNotes');
const Save = glyph('save');
const Wifi = glyph('online');
const WifiOff = glyph('offline');
const Zap = glyph('bolt');
const ChevronDown = glyph('chevronDown');
const RotateCcw = glyph('undo');
const FileJson = glyph('code');
const AlertTriangle = glyph('warning');
const Check = glyph('check');
const X = glyph('close');
const Keyboard = glyph('keyboard');
const WandSparkles = glyph('aiAssist');
const ListChecks = glyph('checklist');
const Sparkles = glyph('aiAssist');
const ShieldAlert = glyph('drugAlert');
const MessagesSquare = glyph('chat');
const Plus = glyph('add');

interface ClinicalNotepadProps {
  encounterId: string;
  patientName?: string;
  /** Minutes from the consultation call (AI), with items missing from this note. */
  callMinutes?: CallMinutes | null;
  /** True while "Quick AI minutes & auto-update notes" is on: missing items are added automatically. */
  autoApplyCall?: boolean;
  /** Current note text (debounced), so the call can compare it with the conversation. */
  onTextChange?: (text: string) => void;
}

const fmtTime = (ms: number | null) => (ms === null ? '' : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`);
const IDENTIFIER_LABELS: Record<string, string> = {
  PATIENT: 'patient name', DOCTOR: 'doctor name', PERSON: 'other name', PHONE: 'phone number', ABHA: 'ABHA ID',
  ID: 'ID number', EMAIL: 'e-mail', PIN: 'PIN code', PLACE: 'place', DATE: 'date',
};

const DEBOUNCE_MS = 80;
const AUTOSAVE_MS = 4000;

/** Latest text per consultation, kept in memory so the notepad can move (e.g. into the call window)
 *  without losing anything typed since the last save. */
const liveDrafts = new Map<string, { content: string; anns: Annotation[] }>();
const TIER3_POLL_MS = 30000;
/** Official-terminology lookups wait for a short typing pause; local suggestions stay instant. */
const TERM_SEARCH_DEBOUNCE_MS = 120;
const TERM_QUERY_WORDS = 4;
const MAX_TERM_RESULTS = 4;
const KIND_LABELS: Record<Suggestion['kind'], string> = {
  complete: 'Complete', phrase: 'Phrase', shorthand: 'Expand', nomenclature: 'Standardize', spelling: 'Spelling', ai: 'AI',
};
const AUTO_THRESHOLD_DEFAULT = 0.9;
const SECTION_LABELS: Record<NoteSection, string> = {
  complaints: 'Chief Complaints', history: 'Past History', exam: 'Vitals & Examination',
  assessment: 'Assessment', labs: 'Investigations', plan: 'Plan / Medications',
};

let annotationSeq = 0;
const newId = () => `ann_${Date.now().toString(36)}_${annotationSeq++}`;

type CodedDraft = Omit<Annotation, 'id' | 'start' | 'end'>;

function codedFromCandidate(original: string, c: NomenclatureCandidate, alternatives: NomenclatureCandidate[],
  confidence: number, auto: boolean): CodedDraft {
  return {
    kind: 'coded', original, name: c.name, codes: c.codes, category: c.category, severity: c.severity,
    confidence, alternatives: alternatives.filter(a => a.name !== c.name), auto,
  };
}

interface Mark { start: number; end: number; cls: string }

const SEVERITY_LABEL: Record<SafetyAlert['severity'], string> = {
  contraindicated: 'Contraindicated', major: 'Major', moderate: 'Moderate', caution: 'Caution', minor: 'Minor', unknown: 'Ungraded',
};

const SafetyRow: React.FC<{ alert: SafetyAlert }> = ({ alert: a }) => (
  <div className={`np-safety-row sev-${a.severity}`}>
    <span className="np-sev">{SEVERITY_LABEL[a.severity]}</span>
    <div>
      <div className="np-safety-title">{a.kind === 'allergy' ? 'Allergy' : 'Interaction'}: {a.title}</div>
      <div className="np-safety-detail">{a.detail}</div>
      <div className="np-safety-source">{a.context} · Source: {a.source}</div>
    </div>
  </div>
);

export const ClinicalNotepad: React.FC<ClinicalNotepadProps> = ({
  encounterId, patientName, callMinutes = null, autoApplyCall = false, onTextChange,
}) => {
  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  const engine = useMemo(() => (lexicon ? new LocalEngine(lexicon) : null), [lexicon]);
  const autoThreshold = lexicon?.auto_convert_threshold ?? AUTO_THRESHOLD_DEFAULT;

  const [text, setText] = useState('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState<EngineStatus>('connecting');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<{ text: string; result: AnalysisResult } | null>(null);

  const [dismissed, setDismissed] = useState(false);
  const [forced, setForced] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [navigated, setNavigated] = useState(false);
  const [autoStandardize, setAutoStandardize] = useState(true);
  // Auto-correct clear-cut typos and tidy punctuation when a line is finished.
  const [autoCorrect, setAutoCorrect] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [openPill, setOpenPill] = useState<string | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fhirPreview, setFhirPreview] = useState<string | null>(null);

  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Tier 3 (language-model) completion
  const [tier3, setTier3] = useState<Tier3Info | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiPending, setAiPending] = useState(false);

  // Official terminology (SNOMED CT / ICD-11 / LOINC / RxNorm / CDCI) from the server's local store
  const [termInfo, setTermInfo] = useState<TerminologyInfo | null>(null);
  const [termResults, setTermResults] = useState<{ text: string; cursor: number; result: TermSearchResult } | null>(null);

  // Refs mirror state so sequential programmatic edits (which fire onChange synchronously) see fresh values.
  const textRef = useRef('');
  const annRef = useRef<Annotation[]>([]);
  const pendingCoded = useRef<{ start: number; end: number; draft: CodedDraft } | null>(null);
  const pendingSelection = useRef<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const connRef = useRef<IntelliSenseConnection | null>(null);
  const seqRef = useRef(0);
  const sentTextRef = useRef<{ seq: number; text: string } | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const aiSeqRef = useRef(0);
  const termSeqRef = useRef(0);
  const termSentRef = useRef<{ seq: number; text: string; cursor: number } | null>(null);
  const termTimerRef = useRef<number | undefined>(undefined);
  const termInfoRef = useRef<TerminologyInfo | null>(null);
  useLayoutEffect(() => { termInfoRef.current = termInfo; }, [termInfo]);
  const aiSentRef = useRef<{ seq: number; text: string; cursor: number } | null>(null);
  const aiSuggestionRef = useRef<AiSuggestion | null>(null);
  const aiLastEmptyRef = useRef<{ text: string; cursor: number } | null>(null);
  const rhythmRef = useRef(new TypingRhythm());
  const aiTimerRef = useRef<number | undefined>(undefined);
  const tier3Ref = useRef<Tier3Info | null>(null);
  const engineRef = useRef<LocalEngine | null>(null);
  useLayoutEffect(() => {
    tier3Ref.current = tier3;
    engineRef.current = engine;
    aiSuggestionRef.current = aiSuggestion;
  }, [tier3, engine, aiSuggestion]);
  const autoStdRef = useRef(autoStandardize);
  useLayoutEffect(() => { autoStdRef.current = autoStandardize; }, [autoStandardize]);
  const autoCorrectRef = useRef(autoCorrect);
  useLayoutEffect(() => { autoCorrectRef.current = autoCorrect; }, [autoCorrect]);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // ---------------------------------------------------------------------------
  // Load lexicon + saved draft
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let active = true;
    (async () => {
      const lex = await loadLexicon();
      let content = lex?.template ?? '';
      let anns: Annotation[] = [];
      try {
        const res = await authFetch(`/api/v1/intellisense/encounters/${encodeURIComponent(encounterId)}/notepad`);
        if (res.ok) {
          const data = await res.json();
          content = data.content ?? content;
          anns = (data.coded_terms ?? []).map((t: Omit<Annotation, 'id' | 'kind' | 'alternatives' | 'auto'>) => ({
            ...t, id: newId(), kind: 'coded', alternatives: [], auto: false,
          }));
        }
      } catch { /* offline: start from template */ }
      if (!active) return;
      const live = liveDrafts.get(encounterId);
      if (live) { content = live.content; anns = live.anns; }
      setLexicon(lex);
      if (lex?.tier3) setTier3(lex.tier3);
      textRef.current = content;
      annRef.current = anns;
      setText(content);
      setAnnotations(anns);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [encounterId]);

  // ---------------------------------------------------------------------------
  // Text change pipeline
  // ---------------------------------------------------------------------------
  const commitText = useCallback((newText: string) => {
    const shifted = shiftAnnotations(annRef.current, textRef.current, newText);
    const pending = pendingCoded.current;
    pendingCoded.current = null;
    if (pending && newText.slice(pending.start, pending.end) === pending.draft.name) {
      shifted.push({ ...pending.draft, id: newId(), start: pending.start, end: pending.end });
    }
    shifted.sort((a, b) => a.start - b.start);
    textRef.current = newText;
    annRef.current = shifted;
    setText(newText);
    setAnnotations(shifted);
    setDirty(true);
  }, []);

  /** Replace [start, end) with `replacement`, keeping native undo. Optionally attach a coded term. */
  const replaceRange = useCallback((start: number, end: number, replacement: string,
    coded?: CodedDraft, cursorAfter?: number) => {
    const ta = taRef.current;
    if (!ta) return;
    pendingCoded.current = coded ? { start, end: start + replacement.length, draft: { ...coded, name: replacement } } : null;
    ta.focus();
    ta.setSelectionRange(start, end);
    let ok = false;
    try { ok = document.execCommand('insertText', false, replacement); } catch { ok = false; }
    if (!ok) {
      commitText(textRef.current.slice(0, start) + replacement + textRef.current.slice(end));
    }
    const caret = cursorAfter ?? start + replacement.length;
    pendingSelection.current = caret;
    ta.setSelectionRange(caret, caret);
    setCursor(caret);
  }, [commitText]);

  /** Apply several non-overlapping edits, last first so earlier offsets stay valid. */
  const applyEdits = useCallback((edits: TextEdit[]) => {
    if (!edits.length) return;
    const caret = taRef.current?.selectionStart ?? 0;
    let caretShift = 0;
    for (const e of [...edits].sort((a, b) => b.start - a.start)) {
      replaceRange(e.start, e.end, e.replacement, e.coded);
      if (e.end <= caret) caretShift += e.replacement.length - (e.end - e.start);
    }
    const target = Math.max(0, caret + caretShift);
    taRef.current?.setSelectionRange(target, target);
    pendingSelection.current = target;
    setCursor(target);
  }, [replaceRange]);

  // ---------------------------------------------------------------------------
  // Consultation call: items said in the call but missing from the note
  // ---------------------------------------------------------------------------
  /** finding id -> added / removed (removed items are never re-added). Keeps the finding so it stays listed. */
  const [callApplied, setCallApplied] = useState<Record<string, { status: 'added' | 'removed'; finding: CallFinding }>>({});
  const callAppliedRef = useRef(callApplied);
  useLayoutEffect(() => { callAppliedRef.current = callApplied; }, [callApplied]);

  /** Insert text without moving the doctor's cursor or focus (they may be typing elsewhere). */
  const insertSilently = useCallback((pos: number, str: string, draft: CodedDraft, nameStart: number) => {
    const ta = taRef.current;
    const old = textRef.current;
    const caret = ta?.selectionStart ?? old.length;
    pendingCoded.current = { start: nameStart, end: nameStart + draft.name.length, draft };
    commitText(old.slice(0, pos) + str + old.slice(pos));
    const newCaret = caret >= pos ? caret + str.length : caret;
    pendingSelection.current = newCaret;
  }, [commitText]);

  const addCallFinding = useCallback((f: CallFinding) => {
    if (!engine || callAppliedRef.current[f.id]) return;
    const text = textRef.current;
    const section = (['complaints', 'history', 'exam', 'assessment', 'labs', 'plan'].includes(f.section)
      ? f.section : 'history') as NoteSection;
    const at = engine.sectionInsertionPoint(text, section);
    const draft: CodedDraft = {
      kind: 'call', original: '', name: f.text, codes: [], category: `From the call · ${f.kind}`,
      severity: f.severity === 'urgent' ? 'critical' : 'routine', confidence: 1, alternatives: [], auto: true,
    };
    if (at !== null) {
      insertSilently(at, `\n${f.text}`, draft, at + 1);
    } else {
      const block = `${text.endsWith('\n') || !text ? '' : '\n'}\n${SECTION_LABELS[section]}:\n${f.text}`;
      insertSilently(text.length, block, draft, text.length + block.length - f.text.length);
    }
    setCallApplied(prev => ({ ...prev, [f.id]: { status: 'added', finding: f } }));
  }, [engine, insertSilently]);

  const removeCallFinding = useCallback((f: CallFinding) => {
    const ann = annRef.current.find(a => a.kind === 'call' && a.name === f.text);
    if (ann) {
      const old = textRef.current;
      const start = old[ann.start - 1] === '\n' ? ann.start - 1 : ann.start;   // take the line break with it
      const caret = taRef.current?.selectionStart ?? old.length;
      commitText(old.slice(0, start) + old.slice(ann.end));
      pendingSelection.current = caret > ann.end ? caret - (ann.end - start) : Math.min(caret, start);
    }
    setCallApplied(prev => ({ ...prev, [f.id]: { status: 'removed', finding: f } }));
  }, [commitText]);

  // Auto-add new findings while AI minutes are on.
  useEffect(() => {
    if (!autoApplyCall || !callMinutes || loading) return;
    for (const f of callMinutes.missing) if (!callAppliedRef.current[f.id]) addCallFinding(f);
  }, [callMinutes, autoApplyCall, addCallFinding, loading]);

  // Share the note text with the call (debounced: the parent re-renders on each update).
  const onTextChangeRef = useRef(onTextChange);
  useLayoutEffect(() => { onTextChangeRef.current = onTextChange; }, [onTextChange]);
  useEffect(() => {
    const t = window.setTimeout(() => onTextChangeRef.current?.(text), 1000);
    return () => window.clearTimeout(t);
  }, [text]);

  useLayoutEffect(() => {
    if (pendingSelection.current !== null && taRef.current) {
      const pos = pendingSelection.current;
      pendingSelection.current = null;
      if (document.activeElement === taRef.current) taRef.current.setSelectionRange(pos, pos);
    }
  });

  // ---------------------------------------------------------------------------
  // Server analysis (debounced) + auto-standardization
  // ---------------------------------------------------------------------------
  const applyAutoConversions = useCallback((snapshot: string, result: AnalysisResult) => {
    if (textRef.current !== snapshot || document.activeElement !== taRef.current) return;
    const caret = taRef.current?.selectionStart ?? snapshot.length;
    // Only touch finished words: the doctor's cursor must have moved past them.
    const finished = (start: number, end: number) => !(caret >= start && caret <= end);
    const edits: TextEdit[] = [];
    if (autoStdRef.current) {
      for (const m of result.nomenclature) {
        if (!m.auto_convert || !finished(m.start, m.end)) continue;
        edits.push({
          start: m.start, end: m.end, replacement: m.candidates[0].name,
          coded: { ...codedFromCandidate(m.original, m.candidates[0], m.candidates, m.confidence, true), caretGap: caret - m.end },
        });
      }
    }
    const corrected: string[] = [];
    if (autoCorrectRef.current) {
      for (const s of result.spelling) {
        if (!s.auto || !finished(s.start, s.end) || edits.some(e => s.start < e.end && e.start < s.end)) continue;
        edits.push({
          start: s.start, end: s.end, replacement: s.suggestion,
          coded: {
            kind: 'autocorrect', original: s.original, name: s.suggestion, codes: [], category: 'Spelling',
            severity: 'routine', confidence: 1, alternatives: [], auto: true, caretGap: caret - s.end,
          },
        });
        corrected.push(`${s.original} \u2192 ${s.suggestion}`);
      }
    }
    if (!edits.length) return;
    applyEdits(edits);
    if (corrected.length) setNotice(`Auto-corrected: ${corrected.join(', ')}. Press Ctrl+Z to undo.`);
  }, [applyEdits]);

  const handleResult = useCallback((seq: number, result: AnalysisResult | null, latency: number) => {
    const sent = sentTextRef.current;
    // Drop stale responses: positions are only valid for the exact text that was analyzed.
    if (!sent || seq !== sent.seq || textRef.current !== sent.text) return;
    const current = sent.text;
    let final = result;
    if (!final && engine) {
      const skip = annRef.current.map(a => [a.start, a.end] as [number, number]);
      const caret = taRef.current?.selectionStart ?? current.length;
      final = { section: engine.detectSection(current, caret), nomenclature: engine.localNomenclature(current, skip), spelling: [] };
    }
    if (!final) return;
    if (result) setLatencyMs(Math.round(latency));
    setAnalysis({ text: current, result: final });
    applyAutoConversions(current, final);
  }, [engine, applyAutoConversions]);

  const handleResultRef = useRef(handleResult);
  useLayoutEffect(() => { handleResultRef.current = handleResult; }, [handleResult]);

  // Tier 3 reply handler (stable: reads refs only).
  const handleCompletion = useCallback((seq: number, result: CompletionResult | null) => {
    if (result?.tier3) setTier3(result.tier3);
    const sent = aiSentRef.current;
    if (!sent || seq !== sent.seq) return;
    aiSentRef.current = null;
    setAiPending(false);
    if (!result?.completion) {
      // Model had nothing to add here; don't ask again until a few more characters are typed.
      if (!result?.skipped || result.skipped === 'no_context') aiLastEmptyRef.current = { text: sent.text, cursor: sent.cursor };
      return;
    }
    const ai: AiSuggestion = { text: sent.text, cursor: sent.cursor, completion: result.completion, provider: result.provider };
    // Show it if the doctor hasn't moved, or has been typing exactly what it suggests.
    const caret = taRef.current?.selectionStart ?? -1;
    if (aiRemaining(ai, textRef.current, caret) !== null) setAiSuggestion(ai);
  }, []);

  // Terminology reply handler (stable: reads refs only). Shown only if the doctor hasn't moved on.
  const handleTerms = useCallback((seq: number, result: TermSearchResult | null) => {
    const sent = termSentRef.current;
    if (!sent || seq !== sent.seq || !result) return;
    if (textRef.current === sent.text && taRef.current?.selectionStart === sent.cursor) {
      setTermResults({ text: sent.text, cursor: sent.cursor, result });
    }
  }, []);

  useEffect(() => {
    const conn = new IntelliSenseConnection(encounterId, {
      onStatus: setStatus,
      onResult: (seq, result, latency) => handleResultRef.current(seq, result, latency),
      onCompletion: handleCompletion,
      onTier3: setTier3,
      onTerms: handleTerms,
      onTerminology: setTermInfo,
    });
    connRef.current = conn;
    const poll = window.setInterval(() => void conn.fetchTier3(), TIER3_POLL_MS);
    return () => { window.clearInterval(poll); conn.close(); connRef.current = null; };
  }, [encounterId, handleCompletion, handleTerms]);

  const scheduleAnalysis = useCallback(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const seq = ++seqRef.current;
      const snapshot = textRef.current;
      sentTextRef.current = { seq, text: snapshot };
      const req = {
        text: snapshot,
        cursor: taRef.current?.selectionStart ?? snapshot.length,
        skip_ranges: annRef.current.map(a => [a.start, a.end] as [number, number]),
      };
      if (connRef.current) void connRef.current.analyze(seq, req);
      else handleResultRef.current(seq, null, 0);
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => { if (!loading) scheduleAnalysis(); }, [loading, scheduleAnalysis]);
  useEffect(() => () => {
    window.clearTimeout(debounceRef.current);
    window.clearTimeout(aiTimerRef.current);
    window.clearTimeout(termTimerRef.current);
  }, []);

  // ---------------------------------------------------------------------------
  // Tier 3: language-model sentence completion
  // ---------------------------------------------------------------------------

  /** While a word is being typed, look it up in the official terminologies (debounced). */
  const scheduleTermSearch = useCallback(() => {
    window.clearTimeout(termTimerRef.current);
    if (!termInfoRef.current?.available) return;
    termTimerRef.current = window.setTimeout(() => {
      const ta = taRef.current;
      const conn = connRef.current;
      if (!ta || !conn || ta.selectionStart !== ta.selectionEnd) return;
      const snapshot = textRef.current;
      const caret = ta.selectionStart;
      if (/[\w/]/.test(snapshot[caret] ?? '')) return;               // only at the end of a word
      const line = snapshot.slice(snapshot.lastIndexOf('\n', caret - 1) + 1, caret);
      if (!/[A-Za-z]{3,}$/.test(line) || /:\s*$/.test(line)) return;  // typing a word of 3+ letters
      const query = line.trim().split(/\s+/).slice(-TERM_QUERY_WORDS).join(' ');
      const seq = ++termSeqRef.current;
      termSentRef.current = { seq, text: snapshot, cursor: caret };
      void conn.searchTerms(seq, query, engineRef.current?.detectSection(snapshot, caret) ?? null);
    }, TERM_SEARCH_DEBOUNCE_MS);
  }, []);

  /** The doctor typed again while the model was still answering: stop it, the answer is stale. */
  const cancelPendingAi = useCallback(() => {
    if (!aiSentRef.current) return;
    aiSentRef.current = null;
    connRef.current?.cancelCompletion();
    setAiPending(false);
  }, []);

  const scheduleAiCompletion = useCallback((force = false) => {
    window.clearTimeout(aiTimerRef.current);
    const t3 = tier3Ref.current;
    if (!t3?.enabled || t3.state === 'offline' || t3.state === 'paused') return;
    aiTimerRef.current = window.setTimeout(() => {
      const ta = taRef.current;
      const conn = connRef.current;
      if (!ta || !conn || document.activeElement !== ta || ta.selectionStart !== ta.selectionEnd) return;
      const snapshot = textRef.current;
      const caret = ta.selectionStart;
      // Still typing through the last suggestion: it's in use, no new request needed.
      if (aiRemaining(aiSuggestionRef.current, snapshot, caret) !== null) return;
      if (!shouldRequest(snapshot, caret, aiLastEmptyRef.current, force)) return;
      // Faster local tiers win; don't spend a model call when they already have an answer.
      if (!force && engineRef.current && engineRef.current.suggest(snapshot, caret).length) return;
      const seq = ++aiSeqRef.current;
      aiSentRef.current = { seq, text: snapshot, cursor: caret };
      setAiPending(true);
      void conn.complete(seq, snapshot, caret);
    }, force ? 0 : rhythmRef.current.delayMs());
  }, []);

  // ---------------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------------
  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    let caret = e.target.selectionStart;
    rhythmRef.current.keystroke();
    cancelPendingAi();
    const before = new Map(annRef.current.map(a => [a.id, a]));
    commitText(newText);
    if ((e.nativeEvent as InputEvent).inputType === 'historyUndo') {
      // Ctrl+Z on an automatic change: the browser re-selects the restored word, so the next keystroke
      // would overwrite it. Put the cursor back where the doctor was typing instead.
      const undone = annRef.current.find(a => a.kind === 'dismissed' && before.get(a.id)?.kind !== 'dismissed'
        && before.get(a.id)?.caretGap !== undefined);
      if (undone) {
        caret = Math.min(newText.length, undone.start + undone.original.length + (before.get(undone.id)?.caretGap ?? 0));
        e.target.setSelectionRange(caret, caret);
        pendingSelection.current = caret;
      }
    }
    setCursor(caret);
    setHighlight(0);
    setNavigated(false);
    setForced(false);

    const native = e.nativeEvent as InputEvent;
    const typedBoundary = native.inputType === 'insertLineBreak' ||
      (native.inputType === 'insertText' && /^[\s,.;]$/.test(native.data ?? ''));
    if (typedBoundary && native.inputType === 'insertLineBreak' && autoCorrectRef.current && engine) {
      setDismissed(false);
      // Finished a line: tidy its punctuation, spacing and vitals (coded terms are left untouched).
      const lineEnd = caret - 1;
      const lineStart = newText.lastIndexOf('\n', lineEnd - 1) + 1;
      const protectedRanges = annRef.current.filter(a => a.kind === 'coded').map(a => [a.start, a.end] as [number, number]);
      const edits = engine.tidyLine(newText, lineStart, lineEnd, protectedRanges);
      if (edits.length) {
        window.setTimeout(() => { if (textRef.current === newText) applyEdits(edits); }, 0);
      }
    } else if (typedBoundary) {
      // Vitals are formatted when the line is finished (Enter), not mid-line: formatting
      // "BP 120/80" while the doctor is still typing "mmHg" would double the unit.
      setDismissed(false);
    }
    scheduleAnalysis();
    scheduleAiCompletion();
    scheduleTermSearch();
  };

  const onSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (ta.selectionStart === ta.selectionEnd && ta.selectionStart !== cursor) {
      setCursor(ta.selectionStart);
      setHighlight(0);
      setNavigated(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Suggestions at the cursor
  // ---------------------------------------------------------------------------
  // Reuse the last analysis between keystrokes, keeping only items whose text is still in place.
  const currentAnalysis: AnalysisResult | null = useMemo(() => {
    if (!analysis) return null;
    if (analysis.text === text) return analysis.result;
    const still = <T extends { start: number; end: number; original: string }>(x: T) =>
      text.slice(x.start, x.end) === x.original;
    return {
      ...analysis.result,
      nomenclature: analysis.result.nomenclature.filter(still),
      spelling: analysis.result.spelling.filter(still),
    };
  }, [analysis, text]);

  const suggestions: Suggestion[] = useMemo(() => {
    if (!engine || dismissed) return [];
    const out: Suggestion[] = [];
    const match = currentAnalysis?.nomenclature.find(m => m.end === cursor && !m.auto_convert);
    if (match) {
      for (const c of match.candidates) {
        out.push({
          kind: 'nomenclature', replaceStart: match.start, replaceEnd: match.end, insert: c.name, label: c.name,
          detail: c.codes.map(formatCode).join(' · '), codes: c.codes, severity: c.severity,
          original: match.original, confidence: match.confidence, alternatives: match.candidates,
        });
      }
    }
    out.push(...engine.suggest(text, cursor, forced).slice(0, 4));

    // Coded results from the official terminologies, after the instant local ones.
    if (termResults && termResults.text === text && termResults.cursor === cursor) {
      const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
      const words = [...text.slice(lineStart, cursor).matchAll(/\S+/g)];
      const span = Math.min(termResults.result.span_words, words.length);
      if (span > 0) {
        const start = lineStart + (words[words.length - span].index ?? 0);
        const typed = text.slice(start, cursor);
        const taken = new Set(out.map(s => s.insert.toLowerCase()));
        for (const item of termResults.result.results.slice(0, MAX_TERM_RESULTS)) {
          const insert = /^[A-Z]/.test(typed) && /^[a-z]/.test(item.term) ? item.term[0].toUpperCase() + item.term.slice(1) : item.term;
          if (taken.has(insert.toLowerCase())) {
            // Same wording as a local suggestion: give that suggestion the official codes instead of a duplicate.
            const local = out.find(s => s.insert.toLowerCase() === insert.toLowerCase());
            if (local) {
              const have = new Set((local.codes ?? []).map(c => c.system));
              const extra = item.codes.filter(c => !have.has(c.system));
              if (extra.length) {
                local.codes = [...(local.codes ?? []), ...extra];
                local.source = local.source ?? item.label;
                local.detail = `${item.label} · ${item.code}${local.detail ? ` · ${local.detail}` : ''}`;
              }
            }
            continue;
          }
          taken.add(insert.toLowerCase());
          out.push({
            kind: 'complete', replaceStart: start, replaceEnd: cursor, insert, label: item.term,
            detail: `${item.label} · ${item.code}${item.display.toLowerCase() !== item.term.toLowerCase() ? ` · ${item.display}` : ''}`,
            codes: item.codes, source: item.label,
          });
        }
      }
    }
    const remaining = aiRemaining(aiSuggestion, text, cursor);
    if (remaining) {
      // While the doctor is typing along with it, the AI suggestion takes priority.
      out.unshift({
        kind: 'ai', replaceStart: cursor, replaceEnd: cursor, insert: remaining,
        label: remaining.trim(),
        detail: `AI suggestion${aiSuggestion?.provider === 'stub' ? ' · demo stub' : ' · on-premise model'} · review before accepting`,
      });
    }
    return out.slice(0, 8);
  }, [engine, dismissed, currentAnalysis, text, cursor, forced, aiSuggestion, termResults]);

  const top = suggestions[Math.min(highlight, suggestions.length - 1)];
  const atLineEnd = text[cursor] === undefined || text[cursor] === '\n';
  let ghost = '';
  if (top && atLineEnd && top.replaceEnd === cursor) {
    const typed = text.slice(top.replaceStart, top.replaceEnd);
    ghost = top.insert.toLowerCase().startsWith(typed.toLowerCase()) && top.insert.length > typed.length
      ? top.insert.slice(typed.length)
      : `  → ${top.insert}`;
  }

  const accept = (s: Suggestion) => {
    let coded: CodedDraft | undefined;
    if (s.kind === 'nomenclature' && s.alternatives) {
      const chosen = s.alternatives.find(a => a.name === s.insert)!;
      coded = codedFromCandidate(s.original ?? '', chosen, s.alternatives, 1, false);
    } else if (s.codes?.length) {
      coded = {
        kind: 'coded', original: s.original ?? text.slice(s.replaceStart, s.replaceEnd), name: s.insert,
        codes: s.codes, category: s.source ?? (s.kind === 'shorthand' ? 'Shorthand' : 'Lexicon'), severity: s.severity ?? 'routine',
        confidence: 1, alternatives: [], auto: false,
      };
    }
    // A phrase ends mid-sentence ("is suffering from"), so add the space the next word needs.
    const insert = s.kind === 'phrase' && !/[ \t]/.test(text[s.replaceEnd] ?? '') ? `${s.insert} ` : s.insert;
    // A fix for the word just finished leaves the doctor's trailing space/punctuation, and the caret, after it.
    const caretAfter = s.replaceEnd < cursor ? cursor + insert.length - (s.replaceEnd - s.replaceStart) : undefined;
    replaceRange(s.replaceStart, s.replaceEnd, insert, coded, caretAfter);
    setHighlight(0);
    setNavigated(false);
    setForced(false);
    setAiSuggestion(null);
    scheduleAnalysis();
    scheduleAiCompletion();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
      e.preventDefault();
      setDismissed(false);
      setForced(true);
      scheduleAiCompletion(true);
      return;
    }
    if (!suggestions.length) return;
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      accept(suggestions[Math.min(highlight, suggestions.length - 1)]);
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && suggestions.length > 1) {
      e.preventDefault();
      setNavigated(true);
      setHighlight(h => (h + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
    } else if (e.key === 'Enter' && navigated) {
      e.preventDefault();
      accept(suggestions[Math.min(highlight, suggestions.length - 1)]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDismissed(true);
      setAiSuggestion(null); // a dismissed AI suggestion must not reappear while typing along
    }
  };

  // ---------------------------------------------------------------------------
  // Overlay rendering
  // ---------------------------------------------------------------------------
  const marks: Mark[] = useMemo(() => {
    const out: Mark[] = annotations.filter(a => a.kind === 'coded' || a.kind === 'call').map(a => ({
      start: a.start, end: a.end,
      cls: a.kind === 'call' ? (a.severity === 'critical' ? 'np-mark-call-urgent' : 'np-mark-call')
        : a.severity === 'critical' ? 'np-mark-critical' : a.confidence < autoThreshold ? 'np-mark-ambiguous' : 'np-mark-coded',
    }));
    if (currentAnalysis) {
      for (const m of currentAnalysis.nomenclature) {
        if (!m.auto_convert) out.push({ start: m.start, end: m.end, cls: 'np-mark-review' });
      }
      for (const s of currentAnalysis.spelling) out.push({ start: s.start, end: s.end, cls: 'np-mark-spelling' });
      // Medicines involved in a serious safety alert, underlined in the note itself.
      if (analysis?.text === text) {
        for (const a of currentAnalysis.safety?.alerts ?? []) {
          if (a.low_priority) continue;
          const cls = a.severity === 'contraindicated' || a.severity === 'major' ? 'np-mark-danger' : 'np-mark-warn';
          for (const [start, end] of a.spans) out.push({ start, end, cls });
        }
      }
    }
    out.sort((a, b) => a.start - b.start);
    const clean: Mark[] = [];
    for (const m of out) if (!clean.length || m.start >= clean[clean.length - 1].end) clean.push(m);
    return clean;
  }, [annotations, currentAnalysis, autoThreshold, analysis?.text, text]);

  const renderOverlay = () => {
    const limit = ghost ? cursor : text.length;
    const nodes: React.ReactNode[] = [];
    let pos = 0;
    let caretPlaced = false;
    const pushPlain = (from: number, to: number) => {
      if (!caretPlaced && cursor >= from && cursor <= to) {
        if (cursor > from) nodes.push(text.slice(from, cursor));
        nodes.push(<span key="caret" ref={caretRef} className="np-caret-marker" />);
        caretPlaced = true;
        if (to > cursor) nodes.push(text.slice(cursor, to));
      } else if (to > from) {
        nodes.push(text.slice(from, to));
      }
    };
    for (const m of marks) {
      if (m.start >= limit) break;
      pushPlain(pos, m.start);
      nodes.push(<mark key={`m${m.start}`} className={m.cls}>{text.slice(m.start, Math.min(m.end, limit))}</mark>);
      pos = Math.min(m.end, limit);
    }
    pushPlain(pos, limit);
    if (!caretPlaced) nodes.push(<span key="caret" ref={caretRef} className="np-caret-marker" />);
    if (ghost) nodes.push(<span key="ghost" className="np-ghost">{ghost}</span>);
    nodes.push('​'); // keeps a trailing newline's empty line rendered
    return nodes;
  };

  useLayoutEffect(() => {
    const caret = caretRef.current;
    const overlay = overlayRef.current;
    if (!caret || !overlay || !suggestions.length) {
      setDropdownPos(null);
      return;
    }
    const lineHeight = parseFloat(getComputedStyle(overlay).lineHeight) || 24;
    const maxLeft = Math.max(8, overlay.clientWidth - 380);
    setDropdownPos({
      top: caret.offsetTop - scrollTop + lineHeight + 4,
      left: Math.min(caret.offsetLeft, maxLeft),
    });
  }, [suggestions.length, cursor, text, scrollTop, ghost]);

  const onScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const st = e.currentTarget.scrollTop;
    if (overlayRef.current) overlayRef.current.scrollTop = st;
    setScrollTop(st);
  };

  // ---------------------------------------------------------------------------
  // Coded-term & review actions
  // ---------------------------------------------------------------------------
  const protectedRanges = () => annRef.current.map(a => [a.start, a.end] as [number, number]);

  const revertAnnotation = (a: Annotation) => {
    setOpenPill(null);
    replaceRange(a.start, a.end, a.original);
    scheduleAnalysis();
  };

  const switchAlternative = (a: Annotation, alt: NomenclatureCandidate) => {
    setOpenPill(null);
    const all = [{ name: a.name, codes: a.codes, category: a.category, severity: a.severity, score: 0 }, ...a.alternatives];
    replaceRange(a.start, a.end, alt.name, codedFromCandidate(a.original, alt, all, 1, false));
    scheduleAnalysis();
  };

  const resolveMatch = (m: NomenclatureMatch, c: NomenclatureCandidate) => {
    replaceRange(m.start, m.end, c.name, codedFromCandidate(m.original, c, m.candidates, 1, false));
    scheduleAnalysis();
  };

  const ignoreRange = (start: number, end: number, original: string) => {
    const dismissedAnn: Annotation = {
      id: newId(), kind: 'dismissed', start, end, original, name: original, codes: [], category: '',
      severity: 'routine', confidence: 0, alternatives: [], auto: false,
    };
    annRef.current = [...annRef.current, dismissedAnn].sort((a, b) => a.start - b.start);
    setAnnotations(annRef.current);
    scheduleAnalysis();
  };

  const runFormatAll = () => {
    if (engine) { applyEdits(engine.formatAll(textRef.current, protectedRanges())); scheduleAnalysis(); }
  };
  const runExpandAll = () => {
    if (engine) { applyEdits(engine.expandAllShorthand(textRef.current, protectedRanges())); scheduleAnalysis(); }
  };

  const saveDraft = async (auto = false): Promise<boolean> => {
    if (!auto) setSaveMsg(null);
    const coded = annRef.current.filter(a => a.kind === 'coded').map(a => ({
      start: a.start, end: a.end, original: a.original, name: a.name, codes: a.codes,
      category: a.category, severity: a.severity, confidence: a.confidence,
    }));
    try {
      const res = await authFetch(`/api/v1/intellisense/encounters/${encodeURIComponent(encounterId)}/notepad`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: textRef.current, coded_terms: coded }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDirty(false);
      setSaveMsg({ ok: true, text: auto ? 'Saved automatically' : `Draft saved · ${data.saved_coded_terms} coded term(s)` });
      return true;
    } catch (err) {
      setSaveMsg({ ok: false, text: `Could not save draft (${(err as Error).message}). Your text is still here.` });
      return false;
    }
  };

  // Autosave a few seconds after typing stops.
  const saveRef = useRef(saveDraft);
  useLayoutEffect(() => { saveRef.current = saveDraft; });
  useEffect(() => {
    if (!dirty || loading) return;
    const t = window.setTimeout(() => { void saveRef.current(true); }, AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [dirty, loading, text]);

  // Keep the latest text in memory, and save it when the notepad closes (or moves into the call window).
  const dirtyRef = useRef(dirty);
  useLayoutEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => {
    if (!loading) liveDrafts.set(encounterId, { content: text, anns: annotations });
  }, [encounterId, loading, text, annotations]);
  useEffect(() => () => {
    if (!dirtyRef.current) return;
    const token = getStoredToken();
    const coded = annRef.current.filter(a => a.kind === 'coded').map(a => ({
      start: a.start, end: a.end, original: a.original, name: a.name, codes: a.codes,
      category: a.category, severity: a.severity, confidence: a.confidence,
    }));
    void fetch(apiUrl(`/api/v1/intellisense/encounters/${encodeURIComponent(encounterId)}/notepad`), {
      method: 'PUT', keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ content: textRef.current, coded_terms: coded }),
    }).catch(() => undefined);
  }, [encounterId]);

  const exportFhir = async () => {
    if (dirty && !(await saveDraft())) return;
    try {
      const res = await authFetch(`/api/v1/intellisense/encounters/${encodeURIComponent(encounterId)}/fhir`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFhirPreview(JSON.stringify(await res.json(), null, 2));
    } catch (err) {
      setSaveMsg({ ok: false, text: `FHIR export failed (${(err as Error).message}).` });
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const coded = annotations.filter(a => a.kind === 'coded');
  const safety = currentAnalysis?.safety;
  const urgentAlerts = safety?.alerts.filter(a => !a.low_priority) ?? [];
  const minorAlerts = safety?.alerts.filter(a => a.low_priority) ?? [];
  const reviewMatches = currentAnalysis?.nomenclature.filter(m => !m.auto_convert && m.end !== cursor) ?? [];
  const spelling = currentAnalysis?.spelling ?? [];
  const section = engine?.detectSection(text, cursor) ?? null;

  const aiName = tier3?.provider === 'stub' ? 'AI demo' : 'AI on-premise';
  const aiView = !tier3?.enabled
    ? { cls: 'off', label: 'AI off', title: 'Tier 3 sentence completion is not configured on the server' }
    : tier3.state === 'offline'
      ? { cls: 'warn', label: `${aiName} · offline`, title: `Model server unreachable (${tier3.model}). Other suggestions still work.` }
      : tier3.state === 'paused'
        ? { cls: 'warn', label: `${aiName} · paused`, title: 'Paused for a minute after repeated model errors. Other suggestions still work.' }
        : { cls: 'on', label: aiName, title: `Tier 3 sentence completion · model: ${tier3.model}` };

  const statusView = {
    live: { icon: <Zap size={14} />, label: `Live engine${latencyMs !== null ? ` · ${latencyMs} ms` : ''}`, cls: 'live' },
    rest: { icon: <Wifi size={14} />, label: 'Server (HTTP fallback)', cls: 'rest' },
    connecting: { icon: <Wifi size={14} />, label: 'Connecting…', cls: 'rest' },
    offline: { icon: <WifiOff size={14} />, label: 'Offline · local engine', cls: 'offline' },
  }[status];

  return (
    <div className="cb-card portal-card-elevated np-root">
      <div className="cb-card-header">
        <div className="cb-card-title">
          <NotebookPen size={20} className="text-primary" />
          <span>AI IntelliSense Notepad{patientName ? ` · ${patientName}` : ''}</span>
        </div>
        <div className="np-status-group">
        <span className={`np-status np-status-${statusView.cls}`} title="IntelliSense engine connection">
          {statusView.icon}{statusView.label}
        </span>
        <span
          className={`np-status np-ai-status ${aiView.cls} ${aiPending ? 'pending' : ''}`}
          title={aiView.title}
        >
          <Sparkles size={14} />
          {aiView.label}{aiPending ? ' · thinking…' : ''}
        </span>
        </div>
      </div>

      <div className="np-toolbar">
        <button type="button" className="np-btn" onClick={runExpandAll} disabled={!engine}>
          <WandSparkles size={15} /> Expand shorthand
        </button>
        <button type="button" className="np-btn" onClick={runFormatAll} disabled={!engine}>
          <ListChecks size={15} /> Format note
        </button>
        <label className="np-toggle">
          <input type="checkbox" checked={autoStandardize} onChange={e => setAutoStandardize(e.target.checked)} />
          Auto-standardize confident terms
        </label>
        <label className="np-toggle" title="Fix clear-cut typos when a word is finished, and tidy punctuation when you press Enter. Ctrl+Z undoes.">
          <input type="checkbox" checked={autoCorrect} onChange={e => setAutoCorrect(e.target.checked)} />
          Auto-correct &amp; punctuate
        </label>
        <span className="np-toolbar-spacer" />
        <button type="button" className="np-btn" onClick={exportFhir}>
          <FileJson size={15} /> FHIR coded terms
        </button>
        <button type="button" className="np-btn np-btn-primary" onClick={() => void saveDraft()}>
          <Save size={15} /> {dirty ? 'Save draft' : 'Saved'}
        </button>
      </div>

      {!engine && !loading && (
        <div className="clinical-alert clinical-alert-warning np-banner">
          <AlertTriangle size={18} />
          <span>IntelliSense vocabulary couldn't be loaded. You can keep typing; suggestions will start once the server is reachable.</span>
        </div>
      )}

      <div className="np-editor">
        <div ref={overlayRef} className="np-layer np-overlay" aria-hidden="true">{renderOverlay()}</div>
        <textarea
          ref={taRef}
          className="np-layer np-input"
          value={text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onSelect={onSelect}
          onScroll={onScroll}
          onBlur={() => setDropdownPos(null)}
          onFocus={() => setCursor(taRef.current?.selectionStart ?? 0)}
          spellCheck={false}
          disabled={loading}
          placeholder={loading ? 'Loading notepad…' : 'Type consultation notes. Shorthand like "h/o htn, dm2" works.'}
          aria-label="Clinical consultation notepad"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
        />
        {dropdownPos && suggestions.length > 0 && (
          <ul className="np-dropdown" style={{ top: dropdownPos.top, left: dropdownPos.left }} role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={`${s.kind}-${s.insert}`}
                role="option"
                aria-selected={i === highlight}
                className={`np-option ${i === highlight ? 'active' : ''} ${s.severity === 'critical' ? 'critical' : ''}`}
                onMouseDown={e => { e.preventDefault(); accept(s); }}
              >
                <span className={`np-kind np-kind-${s.kind}`}>
                  {KIND_LABELS[s.kind]}
                </span>
                <span className="np-option-label">{s.label}</span>
                {s.detail && <span className="np-option-detail">{s.detail}</span>}
                {i === highlight && <kbd>Tab</kbd>}
              </li>
            ))}
            {suggestions[0]?.kind === 'nomenclature' && suggestions[0].confidence !== undefined && (
              <li className="np-option-footer">
                Ambiguous term · confidence {Math.round(suggestions[0].confidence * 100)}% · pick the intended meaning
              </li>
            )}
          </ul>
        )}
      </div>

      {notice && <div className="np-notice" role="status">{notice}</div>}

      <div className="np-footer-hints">
        <Keyboard size={14} />
        <span><kbd>Tab</kbd> accept</span>
        <span><kbd>↑</kbd><kbd>↓</kbd> choose, <kbd>Enter</kbd> confirm</span>
        <span><kbd>Esc</kbd> dismiss</span>
        <span><kbd>Ctrl</kbd>+<kbd>Space</kbd> suggest</span>
        <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> undo a correction</span>
        {section && <span className="np-section">Context: {SECTION_LABELS[section]}</span>}
      </div>

      {saveMsg && (
        <div className={`np-save-msg ${saveMsg.ok ? 'ok' : 'err'}`} role="status">
          {saveMsg.ok ? <Check size={15} /> : <AlertTriangle size={15} />} {saveMsg.text}
        </div>
      )}

      {callMinutes && (
        <section className="np-panel np-call">
          <h4><MessagesSquare size={16} /> From the consultation call (AI minutes)</h4>
          <p className="np-call-meta">
            {callMinutes.transcript.length} transcript line(s) · speech: {callMinutes.engine.speech ?? 'n/a'} · analysis: {callMinutes.engine.analysis}
            {Object.keys(callMinutes.identifiers_removed).length > 0 && (
              <> · removed before AI: {Object.entries(callMinutes.identifiers_removed)
                .map(([k, n]) => `${n} ${IDENTIFIER_LABELS[k] ?? k.toLowerCase()}${n > 1 ? 's' : ''}`).join(', ')}</>
            )}
          </p>
          {callMinutes.missing.length === 0 && Object.values(callApplied).every(v => v.status !== 'added') && (
            <p className="np-empty">Everything discussed so far is already in your note.</p>
          )}
          {[...callMinutes.missing, ...Object.values(callApplied)
            .filter(v => v.status === 'added' && !callMinutes.missing.some(m => m.id === v.finding.id))
            .map(v => v.finding)]
            .filter(f => callApplied[f.id]?.status !== 'removed')
            .map(f => {
              const added = callApplied[f.id]?.status === 'added';
              return (
                <div key={f.id} className={`np-call-row ${f.severity === 'urgent' ? 'urgent' : ''} ${added ? 'added' : ''}`}>
                  <div className="np-call-main">
                    <div className="np-call-text">
                      {f.severity === 'urgent' && <AlertTriangle size={14} />} {f.text}
                      <span className="np-call-section">{SECTION_LABELS[f.section as NoteSection] ?? f.section}</span>
                    </div>
                    {f.quote && (
                      <div className="np-call-quote">
                        {f.speaker === 'patient' ? 'Patient' : f.speaker === 'doctor' ? 'Doctor' : 'Conversation'}
                        {f.at_ms !== null && ` (${fmtTime(f.at_ms)})`}: “{f.quote}”
                        {f.quote_english && f.quote_english !== f.quote && <span className="np-call-en"> · English: “{f.quote_english}”</span>}
                      </div>
                    )}
                  </div>
                  {added ? (
                    <div className="np-call-actions">
                      <span className="np-call-badge"><Check size={13} /> Added to note</span>
                      <button type="button" className="np-icon-btn" title="Remove from note" onClick={() => removeCallFinding(f)}><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="np-call-actions">
                      <button type="button" className="np-choice" onClick={() => addCallFinding(f)}><Plus size={13} /> Add to note</button>
                      <button type="button" className="np-icon-btn" title="Ignore" onClick={() => setCallApplied(p => ({ ...p, [f.id]: { status: 'removed', finding: f } }))}><X size={14} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          {callMinutes.transcript.length > 0 && (
            <details className="np-call-transcript">
              <summary>Call transcript (your screen only; the AI sees it without names or IDs)</summary>
              {callMinutes.transcript.map((l, i) => (
                <div key={i} className="np-call-line">
                  <span className={`np-call-speaker ${l.speaker}`}>{l.speaker === 'doctor' ? 'Doctor' : 'Patient'} {fmtTime(l.start_ms)}</span>
                  <span>{l.text}{l.english && l.english !== l.text && <span className="np-call-en"> ({l.english})</span>}</span>
                </div>
              ))}
            </details>
          )}
          <p className="np-call-meta">AI-added lines are highlighted in violet. Please review them before signing.</p>
        </section>
      )}

      {safety && (safety.medicines.length > 0 || safety.alerts.length > 0) && (
        <section className="np-panel np-safety" aria-live="polite">
          <h4>
            <ShieldAlert size={16} /> Medication safety
            {urgentAlerts.length === 0 && <span className="np-safe-ok"><Check size={14} /> No serious interactions or allergy conflicts found</span>}
          </h4>
          {urgentAlerts.map(a => <SafetyRow key={`${a.kind}-${a.title}`} alert={a} />)}
          {minorAlerts.length > 0 && (
            <details className="np-safety-minor">
              <summary>{minorAlerts.length} lower-priority interaction{minorAlerts.length > 1 ? 's' : ''} (minor or ungraded)</summary>
              {minorAlerts.map(a => <SafetyRow key={`${a.kind}-${a.title}`} alert={a} />)}
            </details>
          )}
          <p className="np-safety-meta">
            Medicines found: {safety.medicines.map(m => m.drugs.join(' + ')).join(', ') || 'none'}
            {' · '}Checked against {safety.checked_against.current_medications.length} current medication(s) and {safety.checked_against.allergies.length} recorded allergy(ies).
            {' '}Interaction data: {safety.interaction_data === 'DDInter' ? 'DDInter 2.0 (CC BY-NC-SA 4.0) + curated rules' : 'curated rules only'}.
            {' '}Alerts support, not replace, clinical judgement.
          </p>
        </section>
      )}

      {(reviewMatches.length > 0 || spelling.length > 0) && (
        <section className="np-panel">
          <h4>Needs your review</h4>
          {reviewMatches.map(m => (
            <div key={`r${m.start}`} className="np-review-row">
              <span className="np-review-term">“{m.original}”</span>
              <span className="np-review-meta">{Math.round(m.confidence * 100)}% sure · means:</span>
              {m.candidates.map(c => (
                <button key={c.name} type="button" className={`np-choice ${c.severity === 'critical' ? 'critical' : ''}`}
                  onClick={() => resolveMatch(m, c)}>
                  {c.name} <small>{c.codes.map(formatCode).join(' · ')}</small>
                </button>
              ))}
              <button type="button" className="np-icon-btn" title="Keep as written"
                onClick={() => ignoreRange(m.start, m.end, m.original)}><X size={14} /></button>
            </div>
          ))}
          {spelling.map(s => (
            <div key={`s${s.start}`} className="np-review-row">
              <span className="np-review-term np-spell">“{s.original}”</span>
              <span className="np-review-meta">possible misspelling of</span>
              <button type="button" className="np-choice" onClick={() => { replaceRange(s.start, s.end, s.suggestion); scheduleAnalysis(); }}>
                {s.suggestion}
              </button>
              <button type="button" className="np-icon-btn" title="Ignore"
                onClick={() => ignoreRange(s.start, s.end, s.original)}><X size={14} /></button>
            </div>
          ))}
        </section>
      )}

      <section className="np-panel">
        <h4>Coded terms ({coded.length})</h4>
        {coded.length === 0 ? (
          <p className="np-empty">
            Colloquial terms like “sugar”, “heart attack” or “dama” are converted to SNOMED CT / ICD-10 / LOINC as you type.
          </p>
        ) : (
          <div className="np-pills">
            {coded.map(a => {
              const tone = a.severity === 'critical' ? 'critical' : a.confidence < autoThreshold ? 'ambiguous' : 'coded';
              return (
                <div key={a.id} className={`np-pill np-pill-${tone}`}>
                  <span className="np-pill-name">{a.name}</span>
                  {a.codes.map(c => <span key={c.system} className={`np-code np-code-${c.system}`}>{formatCode(c)}</span>)}
                  {a.auto && <span className="np-auto" title={`Auto-converted (${Math.round(a.confidence * 100)}% confidence)`}>auto</span>}
                  <button type="button" className="np-icon-btn" aria-label={`Options for ${a.name}`}
                    onClick={() => setOpenPill(openPill === a.id ? null : a.id)}><ChevronDown size={14} /></button>
                  {openPill === a.id && (
                    <div className="np-popover">
                      <div className="np-popover-meta">Written as “{a.original}” · {a.category}</div>
                      {a.alternatives.map(alt => (
                        <button key={alt.name} type="button" className="np-popover-item" onClick={() => switchAlternative(a, alt)}>
                          Switch to {alt.name} <small>{alt.codes.map(formatCode).join(' · ')}</small>
                        </button>
                      ))}
                      <button type="button" className="np-popover-item np-revert" onClick={() => revertAnnotation(a)}>
                        <RotateCcw size={13} /> Revert to “{a.original}”
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {fhirPreview && (
        <section className="np-panel">
          <div className="np-panel-head">
            <h4>FHIR R4 bundle (from saved draft)</h4>
            <button type="button" className="np-icon-btn" aria-label="Close" onClick={() => setFhirPreview(null)}><X size={14} /></button>
          </div>
          <pre className="np-fhir">{fhirPreview}</pre>
        </section>
      )}
    </div>
  );
};
