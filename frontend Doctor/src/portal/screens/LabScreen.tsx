// CHIBI Test Lab: try the consultation AI with just your voice (no video call).
// You speak -> text (the browser's speech recognition, or your Whisper server) -> every few lines CHIBI's agent
// processes a batch with its running memory -> the notepad fills in, suggestions wait quietly -> Finish gives the
// consultation summary and the structured note exactly as a real visit would save it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClinicalNotepad } from '../../components/ClinicalNotepad';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { authFetch } from '../../services/backend';
import { ChunkRecorder } from '../../services/call/audioRecorder';
import type { CallFinding, CallMinutes } from '../../services/call/callTypes';
import { Button, Card, PageHeader, Pill, Segmented, SelectInput } from '../ui';

interface LabFact { id: string; key: string; heading: string; section: string; text: string; source: string; why?: string | null }
interface LabTurn { at: number; lines: number; engine: string; ms: number; facts: number; suggestions: number }
interface LabAlert { id: string; title: string; detail: string; quote?: string }
interface LabMed { name: string; form?: string | null; strength?: string | null; frequency?: string | null; duration?: string | null; timing?: string | null; text: string }
interface LabFinal { summary: string; key_points?: string[]; considerations?: string[]; follow_up?: string[]; gaps?: string[]; engine: string }
interface Structured {
  complaints: string[]; history: string[]; allergies: string[]; current_medications: LabMed[];
  vitals: Record<string, { value: string; unit: string }>; examination: string[]; diagnosis: string[];
  investigations: string[]; prescription: LabMed[]; advice: string[]; follow_up: { text: string | null; in_days: number | null };
}
interface LabState {
  session_id: string; encounter_id: string;
  transcript: { speaker: string; text: string; at_ms: number }[];
  pending_lines: number; busy: boolean; memory: string; facts: LabFact[]; missed: LabFact[];
  suggestions: { id: string; kind: string; text: string }[]; alerts: LabAlert[]; turns: LabTurn[];
  identifiers_removed: Record<string, number>;
  ai: { provider: string; model: string; online: boolean; destination: string; detail: string };
  batch: { min_lines: number; max_wait_s: number };
  final?: LabFinal | null; structured?: Structured;
}
interface LabStatus { ai: LabState['ai'] & { enabled: boolean }; speech_server: boolean }

// Chrome / Edge speech recognition (not in the TS DOM types).
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void;
}
const SpeechRecognitionCtor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
  .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

const LANGS = [
  { id: 'en-IN', label: 'English (India)' }, { id: 'hi-IN', label: 'Hindi' }, { id: 'kn-IN', label: 'Kannada' },
];

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await authFetch(`/api/v1/lab${path}`, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const toFinding = (f: LabFact): CallFinding => ({
  id: f.id, kind: f.key, section: f.section, heading: f.heading, text: f.text, severity: 'routine', source: f.source,
  speaker: 'conversation', at_ms: null, quote: '', quote_english: '', why: f.why ?? null,
});

export function LabScreen() {
  const [status, setStatus] = useState<LabStatus | null>(null);
  const [state, setState] = useState<LabState | null>(null);
  const [engine, setEngine] = useState<'browser' | 'whisper'>('browser');
  const [lang, setLang] = useState('en-IN');
  const [speaker, setSpeaker] = useState<'patient' | 'doctor'>('patient');
  const [autoWrite, setAutoWrite] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const noteRef = useRef<string | undefined>(undefined);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const chunkRef = useRef<{ rec: ChunkRecorder; stream: MediaStream } | null>(null);
  const wantListen = useRef(false);
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;
  const sessionRef = useRef<string | null>(null);
  sessionRef.current = state?.session_id ?? null;

  useEffect(() => {
    api<LabStatus>('/status').then(setStatus).catch(e => setError((e as Error).message));
  }, []);

  // Poll while a session is open (batches run on the server; this also picks up Whisper transcripts).
  useEffect(() => {
    if (!state?.session_id || state.final) return;
    const id = window.setInterval(() => {
      api<LabState>(`/sessions/${state.session_id}`).then(s => setState(prev => (prev?.final ? prev : s))).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(id);
  }, [state?.session_id, state?.final]);

  const sendLine = useCallback(async (text: string) => {
    const sid = sessionRef.current;
    if (!sid || !text.trim()) return;
    try {
      setState(await api<LabState>(`/sessions/${sid}/lines`, {
        lines: [{ text: text.trim(), speaker: speakerRef.current, language: lang.slice(0, 2) }], note: noteRef.current,
      }));
    } catch (e) { setError((e as Error).message); }
  }, [lang]);

  const stopListening = useCallback(() => {
    wantListen.current = false;
    recRef.current?.stop();
    recRef.current = null;
    if (chunkRef.current) {
      chunkRef.current.rec.stop();
      chunkRef.current.stream.getTracks().forEach(t => t.stop());
      chunkRef.current = null;
    }
    setListening(false);
    setInterim('');
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  const startListening = async (sid: string) => {
    setError(null);
    if (engine === 'whisper') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const rec = new ChunkRecorder(stream, sid, msg => setError(msg), 'patient');
        rec.start();
        chunkRef.current = { rec, stream };
        setListening(true);
      } catch (e) { setError(`Microphone: ${(e as Error).message}`); }
      return;
    }
    if (!SpeechRecognitionCtor) {
      setError('This browser has no speech recognition. Use Chrome or Edge, or switch to your Whisper server.');
      return;
    }
    const rec = new SpeechRecognitionCtor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) void sendLine(r[0].transcript);
        else live += r[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') setError(`Speech recognition: ${e.error}`); };
    // Chrome stops after a pause: start again while you're still "listening".
    rec.onend = () => { if (wantListen.current) { try { rec.start(); } catch { /* already running */ } } };
    wantListen.current = true;
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const begin = async () => {
    setError(null);
    try {
      const s = await api<{ session_id: string }>('/sessions', {});
      noteRef.current = undefined;
      const full = await api<LabState>(`/sessions/${s.session_id}`);
      setState(full);
      sessionRef.current = s.session_id;
      await startListening(s.session_id);
    } catch (e) { setError((e as Error).message); }
  };

  const processNow = async () => {
    if (!state) return;
    try { setState(await api<LabState>(`/sessions/${state.session_id}/process`, { note: noteRef.current })); }
    catch (e) { setError((e as Error).message); }
  };

  const finish = async () => {
    if (!state) return;
    stopListening();
    setFinishing(true);
    try { setState(await api<LabState>(`/sessions/${state.session_id}/end`, { note: noteRef.current })); }
    catch (e) { setError((e as Error).message); }
    finally { setFinishing(false); }
  };

  const reset = () => { stopListening(); setState(null); setInterim(''); };

  // What the notepad receives: everything heard (auto-write on) or only what's missing (quiet hints).
  const minutes: CallMinutes | null = useMemo(() => state ? {
    session_id: state.session_id,
    transcript: state.transcript.map(l => ({ speaker: l.speaker, start_ms: l.at_ms, text: l.text, english: l.text, language: 'en' })),
    minutes: {},
    missing: (autoWrite ? state.facts : state.missed).map(toFinding),
    identifiers_removed: state.identifiers_removed,
    engine: { speech: engine, analysis: state.ai.online ? `${state.ai.provider} · ${state.ai.model}` : 'rules' },
  } : null, [state, autoWrite, engine]);

  const ai = state?.ai ?? status?.ai;
  const lastTurn = state?.turns[state.turns.length - 1];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="CHIBI Test Lab"
        subtitle="Talk as if you were in a consultation. CHIBI listens, processes what you say in batches with memory, fills the note, and summarises at the end."
      />

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Pill tone={ai?.online ? 'success' : 'warning'} dot
          label={ai ? (ai.online ? `AI: ${ai.provider} · ${ai.model}` : `AI offline (${ai.provider || 'none'}) · rules engine`) : 'Checking AI…'} />
        <Pill tone={status?.speech_server ? 'success' : 'neutral'} dot label={status?.speech_server ? 'Whisper server online' : 'Whisper server offline'} />
        {ai?.destination === 'third_party' && <Pill tone="teal" icon="shieldCheck" label="Third-party AI: masked text only (SETU-Shield)" />}
        <span className="flex-1" />
        {!state && (
          <>
            <Segmented label="Speech engine" value={engine} onChange={setEngine}
              options={[{ id: 'browser', label: 'Browser speech' }, ...(status?.speech_server ? [{ id: 'whisper' as const, label: 'Whisper server' }] : [])]} />
            {engine === 'browser' && (
              <SelectInput aria-label="Language" value={lang} onChange={e => setLang(e.target.value)} className="w-44">
                {LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </SelectInput>
            )}
            <Button variant="primary" icon="mic" onClick={() => void begin()}>Start test consultation</Button>
          </>
        )}
        {state && !state.final && (
          <>
            {engine === 'browser' && (
              <Segmented label="Who is speaking" value={speaker} onChange={setSpeaker}
                options={[{ id: 'patient', label: 'I am the patient' }, { id: 'doctor', label: 'I am the doctor' }]} />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoWrite} onChange={e => setAutoWrite(e.target.checked)} /> Auto-write notes
            </label>
            {listening
              ? <Button variant="secondary" icon="micOff" onClick={stopListening}>Pause</Button>
              : <Button variant="secondary" icon="mic" onClick={() => void startListening(state.session_id)}>Resume</Button>}
            <Button variant="secondary" onClick={() => void processNow()} disabled={state.busy}>Process now</Button>
            <Button variant="primary" icon="check" onClick={() => void finish()} disabled={finishing}>{finishing ? 'Summarising…' : 'Finish & summarise'}</Button>
          </>
        )}
        {state?.final && <Button variant="primary" icon="add" onClick={reset}>New test</Button>}
      </Card>

      {error && <Card className="border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</Card>}

      {!state && (
        <Card className="p-6 text-sm leading-relaxed text-ink-muted">
          <p className="mb-2 font-semibold text-ink">How it works</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Press <b>Start test consultation</b> and allow the microphone. Speak naturally about symptoms, history, allergies, medicines.</li>
            <li>Every {status ? '3 lines or 12 seconds' : 'few lines'}, CHIBI sends one batch to the AI with its memory of everything before, through SETU-Shield (names and numbers masked).</li>
            <li>The note on the right fills in under the right headings. Turn off <b>Auto-write</b> to see the quiet mode: grey hints on empty lines, Tab to accept.</li>
            <li><b>Finish & summarise</b> gives the consultation summary and the structured note (prescription, vitals, follow-up) a real visit would save.</li>
          </ol>
          {!SpeechRecognitionCtor && <p className="mt-3 text-warning">Browser speech needs Chrome or Edge.</p>}
        </Card>
      )}

      {state && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className={cx('h-2.5 w-2.5 rounded-full', listening ? 'animate-pulse bg-danger' : 'bg-ink-tint')} />
                <h3 className="text-sm font-bold">{listening ? 'Listening' : 'Paused'}</h3>
                <span className="text-xs text-ink-muted">
                  {state.transcript.length} line(s) · {state.pending_lines} waiting for the next batch{state.busy ? ' · processing…' : ''}
                </span>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto text-sm" ref={el => { if (el) el.scrollTop = el.scrollHeight; }}>
                {state.transcript.length === 0 && !interim && <p className="text-ink-muted">Start talking…</p>}
                {state.transcript.map((l, i) => (
                  <p key={i}><span className={cx('mr-1 text-xs font-bold', l.speaker === 'doctor' ? 'text-primary' : 'text-success')}>
                    {l.speaker === 'doctor' ? 'Doctor' : 'Patient'}</span>{l.text}</p>
                ))}
                {interim && <p className="italic text-ink-muted">{interim}…</p>}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-bold"><Icon name="aiAssist" size={16} /> CHIBI's memory</h3>
              <p className="mb-2 text-xs text-ink-muted">The running summary sent with every batch, so each request stays small but knows what came before.</p>
              <p className="whitespace-pre-wrap text-sm">{state.memory || '(empty until the first batch)'}</p>
            </Card>

            {state.alerts.length > 0 && (
              <Card className="border border-danger/30 p-4">
                <h3 className="mb-2 text-sm font-bold text-danger">Danger signs</h3>
                {state.alerts.map(a => <p key={a.id} className="text-sm"><b>{a.title}.</b> {a.detail}</p>)}
              </Card>
            )}

            {state.suggestions.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-bold">Kept ready (not popped up)</h3>
                <ul className="space-y-1 text-sm">
                  {state.suggestions.map(s => (
                    <li key={s.id}><span className="mr-2 rounded bg-ink-tint px-1.5 py-0.5 text-[11px] font-bold">{s.kind}</span>{s.text}</li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="p-4">
              <h3 className="mb-2 text-sm font-bold">Batches</h3>
              {state.turns.length === 0 && <p className="text-sm text-ink-muted">A batch runs after {state.batch.min_lines} lines or {state.batch.max_wait_s} seconds.</p>}
              <ul className="space-y-1 text-xs text-ink-muted">
                {[...state.turns].reverse().map((t, i) => (
                  <li key={i}>
                    {new Date(t.at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ·
                    {' '}{t.lines} line(s) · {t.engine} · {t.ms} ms · +{t.facts} note line(s){t.suggestions ? ` · +${t.suggestions} suggestion(s)` : ''}
                  </li>
                ))}
              </ul>
              {lastTurn && Object.keys(state.identifiers_removed).length > 0 && (
                <p className="mt-2 text-xs text-ink-muted">Masked before AI: {Object.entries(state.identifiers_removed).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ')}</p>
              )}
            </Card>

            {state.final && <FinalCard final={state.final} structured={state.structured} />}
          </div>

          <div className="min-w-0">
            <ClinicalNotepad
              key={state.encounter_id}
              encounterId={state.encounter_id}
              patientName="Test Patient"
              callMinutes={minutes}
              autoApplyCall={autoWrite}
              onTextChange={t => { noteRef.current = t; }}
              docked
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FinalCard({ final, structured }: { final: LabFinal; structured?: Structured }) {
  const list = (title: string, items?: string[]) => items && items.length > 0 && (
    <div><h4 className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</h4>
      <ul className="list-disc pl-5 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
  );
  return (
    <Card className="p-4">
      <h3 className="mb-2 flex items-center gap-2 text-base font-bold"><Icon name="clinicalNotes" size={18} /> Consultation summary
        <span className="text-xs font-normal text-ink-muted">({final.engine === 'ai' ? 'AI' : 'rules engine'})</span></h3>
      <p className="text-sm">{final.summary}</p>
      {list('Key points', final.key_points)}
      {list('For the doctor to consider', final.considerations)}
      {list('Follow-up', final.follow_up)}
      {list('Said but missing from the note', final.gaps)}
      {structured && (
        <>
          <h3 className="mt-5 text-base font-bold">What the visit would save (from your note)</h3>
          <p className="mb-2 text-xs text-ink-muted">Parsed from the note's headings, so nothing is typed twice. The patient app shows this after the visit.</p>
          {structured.prescription.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-ink-muted"><tr><th>Medicine</th><th>Dose</th><th>How often</th><th>For</th><th>When</th></tr></thead>
              <tbody>{structured.prescription.map((m, i) => (
                <tr key={i} className="border-t border-hairline"><td className="py-1 font-semibold">{m.form ? `${m.form} ` : ''}{m.name}</td><td>{m.strength ?? '–'}</td>
                  <td>{m.frequency ?? '–'}</td><td>{m.duration ?? '–'}</td><td>{m.timing ?? '–'}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="text-sm text-ink-muted">No prescription lines under “Rx:” (e.g. “Tab Paracetamol 650 mg TDS x 5 days after food”).</p>}
          {Object.keys(structured.vitals).length > 0 && (
            <p className="mt-2 text-sm"><b>Vitals:</b> {Object.entries(structured.vitals).map(([k, v]) => `${k.toUpperCase()} ${v.value} ${v.unit}`).join(' · ')}</p>
          )}
          {structured.diagnosis.length > 0 && <p className="text-sm"><b>Diagnosis:</b> {structured.diagnosis.join('; ')}</p>}
          {structured.allergies.length > 0 && <p className="text-sm"><b>Allergies:</b> {structured.allergies.join('; ')}</p>}
          {structured.follow_up.text && <p className="text-sm"><b>Follow-up:</b> {structured.follow_up.text}{structured.follow_up.in_days ? ` (in ${structured.follow_up.in_days} days)` : ''}</p>}
        </>
      )}
    </Card>
  );
}
