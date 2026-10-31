// CHIBI Test Lab: try the consultation AI with just your voice (no video call).
// You speak -> text (the browser's speech recognition, or your Whisper server) -> every few lines CHIBI's agent
// processes a batch with its running memory -> the notepad fills in, suggestions wait quietly -> Finish gives the
// consultation summary and the structured note exactly as a real visit would save it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClinicalNotepad } from '../../components/ClinicalNotepad';
import { Icon, type IconName } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { authFetch } from '../../services/backend';
import { ChunkRecorder } from '../../services/call/audioRecorder';
import type { CallFinding, CallMinutes } from '../../services/call/callTypes';
import { Button, Card, PageHeader, Pill, Segmented, SelectInput } from '../ui';

interface LabFact { id: string; key: string; heading: string; section: string; text: string; source: string; why?: string | null; replaces?: string[] }
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
  ai: { provider: string; model: string; online: boolean; destination: string; detail: string; rate_limited_for_s?: number; downloading_model?: boolean };
  batch: { min_lines: number; max_wait_s: number };
  final?: LabFinal | null; structured?: Structured;
}
interface LabStatus { ai: LabState['ai'] & { enabled: boolean }; speech_server: boolean }

// Chrome / Edge speech recognition (not in the TS DOM types).
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence?: number } }> }) => void) | null;
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

// Irrelevant conversational fluff, greetings, mic checks, call logistics
const IRRELEVANT_PATTERNS = [
  // Greetings & salutations
  /^(?:hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|namaste|namaskara|pranam)\s*(?:doctor|patient|sir|ma'?am)?$/i,
  // Fluff addressed to doctor / patient
  /^(?:yes|yeah|yep|no|nope|ok|okay|sure|alright|right|thanks|thank\s+you|please|sorry)\s+(?:doctor|patient|sir|ma'?am)$/i,
  // Standalone fluff & acknowledgments
  /^(?:ok|okay|k|yeah|yes|yep|nope|no|alright|right|sure|fine|cool|got\s+it|i\s+see|i\s+understand|understood|i\s+know|you\s+know|i\s+think\s+so|maybe|probably|well|so\s+yeah|nothing|nothing\s+else|that'?s\s+(?:all|it)|no\s+problem|never\s+mind)$/i,
  // Call logistics & audio/mic tests
  /^(?:can\s+you\s+hear\s+me(?:\s+now)?|can\s+you\s+see\s+me|am\s+i\s+audible(?:\s+to\s+you)?|are\s+you\s+audible|i\s+can\s+hear\s+you(?:\s+clearly)?|i\s+can'?t\s+hear\s+you|voice\s+is\s+(?:breaking|cracking|low|not\s+clear)|screen\s+is\s+visible|network\s+(?:issue|problem)|call\s+disconnected|is\s+it\s+working|testing(?:\s+1\s+2\s+3)?|mic\s+check|sound\s+check|check\s+check|one\s+two\s+three|1\s+2\s+3|hello\s+hello|reconnect)$/i,
  // Conversational pauses & interruptions
  /^(?:wait\s+(?:a\s+minute|a\s+second|one\s+second|one\s+minute)|one\s+(?:second|minute)|just\s+a\s+(?:minute|second)|hold\s+on|give\s+me\s+a\s+moment|let\s+me\s+(?:see|check)|are\s+you\s+there)$/i,
  // Conversational questions / closings with no medical content
  /^(?:how\s+are\s+you(?:\s+doing)?|i\s+am\s+fine|what\s+did\s+you\s+say|what\s+happened|pardon(?:\s+me)?|repeat(?:\s+that)?|excuse\s+me|thank\s+you(?:\s+very\s+much)?|thanks(?:\s+a\s+lot)?|welcome|you'?re\s+welcome|bye|goodbye|see\s+you|take\s+care|have\s+a\s+(?:good|nice)\s+day)$/i,
  // Hindi / Hinglish fluff
  /^(?:theek\s+hai(?:\s+doctor)?|haan(?:\s+doctor)?|haanji(?:\s+doctor)?|nahi(?:\s+doctor)?|acha(?:\s+theek\s+hai)?|kuch\s+nahi|bas|samajh\s+gaya|samajh\s+gayi|kya\s+hua|kya\s+bola|ek\s+minute|ruko|suno|bolo|awaaz\s+aa\s+rahi\s+hai|awaaz\s+nahi\s+aa\s+rahi|dhanyawad|shukriya|namaste\s+doctor)$/i,
  // Kannada fluff
  /^(?:sari(?:\s+doctor)?|houdu(?:\s+doctor)?|illa(?:\s+doctor)?|beda|namaskara\s+doctor)$/i,
  // Room / background chatter
  /^(?:where\s+are\s+you(?:\s+going)?|who\s+is\s+that|what\s+are\s+you\s+doing|come\s+here|go\s+there|close\s+the\s+door|open\s+the\s+door|turn\s+(?:on|off)\s+the\s+(?:fan|light)|bring\s+water|food\s+is\s+ready|phone\s+is\s+ringing|shut\s+up|stop\s+it)$/i,
  // Acoustic hesitation noises, clicks, babble (e.g. "ooh", "aahhh", "shibhi shibi", "shaaba shaaba")
  /^(?:shibhi|shibi|shaaba|shaba|chibi|chiba|ooh+|aah+|ohh+|ahh+|शीबी|शाबा)(?:\s+(?:shibhi|shibi|shaaba|shaba|chibi|chiba|ooh+|aah+|ohh+|ahh+|शीबी|शाबा))*$/i,
];

// Clinical keywords (English + Hindi/Kannada transliterations)
const CLINICAL_KEYWORDS_RE = new RegExp(
  '\\b(?:' +
  'fever|feverish|chills?|shivering|headache|pain|hurts?|aches?|sore|cough|cold|sneez\\w*|phlegm|sputum|mucus|congestion|runny|' +
  'throat|vomit\\w*|nausea|loose|motion|diarrh\\w*|constipat\\w*|stomach|abdom\\w*|cramp\\w*|gas|acidity|burning|chest|heart|' +
  'palpitat\\w*|breath\\w*|dyspnea|wheez\\w*|asthma|dizzy|dizziness|vertigo|faint\\w*|weak\\w*|fatigue|tired|lethargy|rash\\w*|' +
  'itch\\w*|allerg\\w*|swell\\w*|edema|inflam\\w*|redness|bleed\\w*|blood|cut|wound|injury|bruise|fracture|sprain|infect\\w*|' +
  'viral|bacterial|typhoid|malaria|dengue|jaundice|covid|flu|diabet\\w*|sugar|hypertens\\w*|bp|pressure|cholesterol|thyroid|' +
  'arthrit\\w*|joint|knee|back|spine|neck|shoulder|leg|arm|foot|hand|skin|eye|ear|nose|mouth|tooth|teeth|tongue|stiff\\w*|' +
  'numb\\w*|tingl\\w*|seiz\\w*|stroke|lump|ulcer|stone|calculus|appetite|sleep|insomnia|sweat\\w*|weight|urin\\w*|stool|pus|' +
  'bukhar|jwar|sar\\s+dard|sir\\s+dard|dard|khansi|sardi|zukaam|gala|gale|ulti|dast|pet|chhati|saans|chakkar|kamzori|thakan|' +
  'sujan|khujli|jalan|khoon|ghav|chot|pathri|gathiya|peeliya|bhookh|neend|peshab|thand|kaapna|pasina|dava|dawa|goli|' +
  'tablet\\w*|capsule\\w*|syrup\\w*|drops?|ointment\\w*|cream|spray\\w*|inhaler\\w*|inject\\w*|vaccin\\w*|dose|dosage|mg|ml|' +
  'paracetamol|dolo|crocin|calpol|combiflam|ibuprofen|aspirin|pantocid|pan\\-d|omez|rabeprazole|antacid|azithromycin|amoxicillin|' +
  'augmentin|ciprofloxacin|levofloxacin|antibiotic\\w*|cetirizine|allegra|montair|ascoril|benadryl|metformin|glimepiride|insulin|' +
  'telmisartan|amlodipine|atenolol|atorvastatin|rosuvastatin|thyronorm|eltroxin|vitamin\\w*|calcium|iron|ors|saline|nebuliz\\w*|bandage|' +
  'prescrib\\w*|prescription|diagnos\\w*|treatment|temperature|temp|degrees?|fahrenheit|celsius|pulse|spo2|saturation|fasting|' +
  'hba1c|xray|x\\-ray|scan|ultrasound|ecg|ekg|cbc|blood\\s+test|urine\\s+test|report\\w*|follow\\s+up|review|doctor|patient|' +
  'take\\s+this|after\\s+food|before\\s+food|empty\\s+stomach|twice|thrice|daily|days?|weeks?|months?|years?' +
  ')\\b',
  'i'
);

// Single stop words that Chrome's speech recognizer frequently hallucinates on breaths, sighs or HVAC rumble
const SPURIOUS_PARTICLES = new Set([
  'a', 'an', 'the', 'and', 'or', 'so', 'but', 'to', 'at', 'it', 'is', 'in', 'on', 'of', 'by', 'if',
  'my', 'me', 'he', 'we', 'us', 'be', 'do', 'as', 'that', 'this', 'there', 'just', 'then', 'now'
]);

// Medical abbreviations that ARE valid even if short (2-4 chars)
const VALID_MEDICAL_ABBR = new Set(['bp', 'hr', 'tb', 'mg', 'iv', 'im', 'ecg', 'dm', 'htn', 'cxr', 'prn', 'bid', 'tid', 'qid', 'od', 'spo2']);

// Audio bracket/parentheses tags like [cough], (coughing), [snicker]
const AUDIO_TAGS_RE = /^[\[(](?:cough|coughing|snicker|sigh|music|applause|laughter|noise|throat clearing|background noise)[\])]$/i;

// Scripts outside English (Latin), Hindi (Devanagari), and Kannada.
// Whisper frequently hallucinates Arabic/Urdu, Telugu, Persian, Cyrillic, or CJK on ambient static noise.
const FOREIGN_SCRIPTS_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u0C00-\u0C7F\u0B80-\u0BFF\u0980-\u09FF\u0D00-\u0D7F\u0A80-\u0AFF\u0A00-\u0A7F\u0B00-\u0B7F\u4E00-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\u3040-\u30FF\u0400-\u04FF\u0E00-\u0E7F]/;

// Stutter repetition loops: e.g. "aaaaa", "ha ha ha ha"
const REPEATED_CHARS_RE = /(.)\1{3,}/;
const REPEATED_WORDS_RE = /\b(\w{1,8})\b(?:\s+\1\b){2,}/i;

// In-phrase filler removal (e.g. "umm I have had fever you know since Monday")
const IN_PHRASE_FILLERS_RE = /\b(?:u+h+m*|u+m+|h+m+|e+r+m*|a+h+|o+h+|you know|kind of|sort of|basically|actually|like,|shibhi|shibi|shaaba|shaba|chibi|chiba|शीबी|शाबा)\b[,.]?\s*/gi;

// UI reading artifacts (users reading the on-screen buttons aloud while testing)
const UI_META_RE = /\b(?:it'?s\s+)?(?:whisper\s+server\s+online|auto-?write\s+notes?|chibi\s+test\s+lab|start\s+test\s+consultation|finish\s+(?:and|&)\s+summarise|clinical\s+notepad)\b[,.]?\s*/gi;

/** Strips fillers, noise tags, stutter duplicates, UI reading artifacts, and normalizes punctuation. */
function cleanSpokenPhrase(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();
  // Strip audio bracket tags
  s = s.replace(/^[\[(][^\])]*[\])]\s*/, '').replace(/\s*[\[(][^\])]*[\])]$/, '');
  // Strip UI meta speech if user reads screen labels aloud
  s = s.replace(UI_META_RE, ' ');
  // Remove conversational filler sounds while preserving clinical sentences
  s = s.replace(IN_PHRASE_FILLERS_RE, ' ');
  // Collapse repeated consecutive identical words (e.g. "I I have" -> "I have")
  s = s.replace(/\b(\w+)\s+\1\b/gi, '$1');
  // Collapse extra spaces and clean punctuation
  s = s.replace(/\s+/g, ' ').replace(/\s+([,.?!])/g, '$1').trim();
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}

/** Strict clinical gate: determines whether an utterance has genuine medical value or is acoustic noise/nonsense. */
function isMeaningfulPhrase(text: string): boolean {
  if (!text) return false;
  const s = text.trim();
  if (s.length < 2) return false;

  // 1. Must contain letters or numbers
  if (!/[\p{L}\p{N}]/u.test(s)) return false;

  // 2. Reject foreign script hallucinations (Arabic, Urdu, Telugu, Tamil, Cyrillic, Thai, etc.)
  if (FOREIGN_SCRIPTS_RE.test(s)) return false;

  // 3. Reject acoustic tags like [cough]
  if (AUDIO_TAGS_RE.test(s)) return false;

  // 4. Reject acoustic stutter / repetition loops
  if (REPEATED_CHARS_RE.test(s) || REPEATED_WORDS_RE.test(s)) return false;

  const normalized = s.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();

  // 5. Reject explicit irrelevant conversational fluff, mic tests, greetings, room chatter
  for (const pattern of IRRELEVANT_PATTERNS) {
    if (pattern.test(normalized)) return false;
  }

  // 6. Medical abbreviation bypass
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 1 && VALID_MEDICAL_ABBR.has(words[0])) {
    return true;
  }

  // 7. MANDATORY CLINICAL GATE: If the utterance contains NO clinical keywords (symptoms, drugs, vitals, durations),
  // it is noise / nonsense / irrelevant muttering. CANCEL IT OUT!
  if (!CLINICAL_KEYWORDS_RE.test(s)) {
    return false;
  }

  // 8. If all words are stop words, reject
  if (words.every(w => SPURIOUS_PARTICLES.has(w))) {
    return false;
  }

  return true;
}

const toFinding = (f: LabFact): CallFinding => ({
  id: f.id, kind: f.key, section: f.section, heading: f.heading, text: f.text, severity: 'routine', source: f.source,
  speaker: 'conversation', at_ms: null, quote: '', quote_english: '', why: f.why ?? null, replaces: f.replaces ?? [],
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
  const [voiceGated, setVoiceGated] = useState(true);
  const noteRef = useRef<string | undefined>(undefined);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const chunkRef = useRef<{ rec: ChunkRecorder; stream: MediaStream } | null>(null);
  const noiseGateRef = useRef<{ ctx: AudioContext; stream: MediaStream; interval: number; lastVoiceTime: number } | null>(null);
  const wantListen = useRef(false);
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;
  const sessionRef = useRef<string | null>(null);
  sessionRef.current = state?.session_id ?? null;

  const updateSpeaker = useCallback((newSpeaker: 'patient' | 'doctor') => {
    setSpeaker(newSpeaker);
    speakerRef.current = newSpeaker;
    chunkRef.current?.rec.setSpeaker(newSpeaker);
  }, []);

  useEffect(() => {
    const load = (first: boolean) => api<LabStatus>('/status').then(st => {
      setStatus(st);
      if (first && st.speech_server) setEngine('whisper');      // your own Whisper server is the better default
    }).catch(e => { if (first) setError((e as Error).message); });
    void load(true);
    const id = window.setInterval(() => void load(false), 15000);  // e.g. Colab finished loading the model
    return () => window.clearInterval(id);
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
    if (noiseGateRef.current) {
      window.clearInterval(noiseGateRef.current.interval);
      noiseGateRef.current.stream.getTracks().forEach(t => t.stop());
      void noiseGateRef.current.ctx.close().catch(() => undefined);
      noiseGateRef.current = null;
    }
    setVoiceGated(true);
    setListening(false);
    setInterim('');
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  const startListening = async (sid: string, mode: 'browser' | 'whisper' = engine) => {
    setError(null);
    if (mode === 'whisper') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 16000,
          },
        });
        const rec = new ChunkRecorder(stream, sid, msg => setError(msg), speakerRef.current);
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

    // Hardware microphone noise gate: monitors real-time vocal band energy to reject ambient noise & breathing
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') void ctx.resume();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.2;
        src.connect(analyser);

        const freq = new Uint8Array(analyser.frequencyBinCount);
        const gateData = { ctx, stream, interval: 0, lastVoiceTime: Date.now() };
        gateData.interval = window.setInterval(() => {
          analyser.getByteFrequencyData(freq);
          let peak = 0;
          for (let i = 2; i < Math.min(22, freq.length); i++) {
            if (freq[i] > peak) peak = freq[i];
          }
          if (peak >= 80) {
            gateData.lastVoiceTime = Date.now();
            setVoiceGated(false);
          } else {
            setVoiceGated(true);
          }
        }, 100);
        noiseGateRef.current = gateData;
      }
    } catch {
      // If mic cannot be shared simultaneously with getUserMedia, proceed with speech recognition
    }

    const rec = new SpeechRecognitionCtor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          // Hardware Noise Gate: if no vocal energy occurred in the last 800ms, drop as room noise
          if (noiseGateRef.current && Date.now() - noiseGateRef.current.lastVoiceTime > 800) {
            continue;
          }
          const confidence = typeof r[0].confidence === 'number' ? r[0].confidence : 1.0;
          // Reject low-confidence recognitions caused by background rumble, throat clearing, or breathing
          if (confidence > 0 && confidence < 0.45) {
            continue;
          }
          const raw = r[0].transcript;
          const cleaned = cleanSpokenPhrase(raw);
          if (isMeaningfulPhrase(cleaned)) {
            void sendLine(cleaned);
          }
        } else {
          live += r[0].transcript;
        }
      }
      const cleanLive = cleanSpokenPhrase(live);
      setInterim(isMeaningfulPhrase(cleanLive) ? cleanLive : '');
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'network' && status?.speech_server) {
        // Chrome's recognizer needs Google's servers; use your Whisper server instead.
        wantListen.current = false;
        rec.stop();
        recRef.current = null;
        setEngine('whisper');
        void startListening(sid, 'whisper').then(() =>
          setError('Chrome speech could not reach Google, so the lab switched to your Whisper server.'));
        return;
      }
      setError(`Speech recognition: ${e.error}${e.error === 'network' ? ' (Chrome needs Google’s speech servers; start your Whisper server to use it instead)' : ''}`);
    };
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
          label={ai ? (ai.online && !ai.rate_limited_for_s ? `AI: ${ai.provider} · ${ai.model}${ai.detail ? ` · ${ai.detail}` : ''}`
            : `AI ${ai.rate_limited_for_s ? 'paused' : 'offline'} (${ai.provider || 'none'}) · rules engine${ai.detail ? ` · ${ai.detail}` : ''}`) : 'Checking AI…'} />
        <Pill tone={status?.speech_server ? 'success' : 'neutral'} dot label={status?.speech_server ? 'Whisper server online' : 'Whisper server offline'} />
        <Pill tone="teal" icon="shieldCheck" label="Noise & Voice Filter: Active" />
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
                <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                  speaker === 'doctor' ? 'bg-primary-tint text-primary-deep' : 'bg-success-tint text-success-deep')}>
                  <Icon name={speaker === 'doctor' ? 'doctor' : 'person'} size={12} />
                  Turn: {speaker === 'doctor' ? 'Doctor' : 'Patient'}
                </span>
                {listening && (
                  <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition-colors',
                    voiceGated ? 'bg-ink-tint text-ink-muted' : 'bg-success-tint text-success-deep')}>
                    <Icon name={voiceGated ? 'shieldCheck' : 'volumeUp'} size={12} />
                    {voiceGated ? 'Noise Gate: Suppressing noise' : 'Voice detected'}
                  </span>
                )}
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
              speakerControl={{
                speaker,
                onSpeakerChange: updateSpeaker,
                disabled: Boolean(state.final),
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FinalCard({ final, structured }: { final: LabFinal; structured?: Structured }) {
  const [copied, setCopied] = useState(false);
  const block = (title: string, items?: string[]) => items?.length ? `\n\n${title}:\n${items.map(x => `- ${x}`).join('\n')}` : '';
  const copy = () => {
    const text = final.summary + block('Key points', final.key_points) + block('To consider', final.considerations)
      + block('Follow-up', final.follow_up) + block('Missing from the note', final.gaps);
    void navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); });
  };
  const panel = (title: string, icon: IconName, tone: 'teal' | 'primary', items?: string[]) => items && items.length > 0 && (
    <section className="rounded-xl border border-hairline p-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
        <Icon name={icon} size={14} tone={tone} /> {title}
      </h4>
      <ul className="flex flex-col gap-1.5 text-sm leading-snug">
        {items.map((x, i) => (
          <li key={i} className="flex gap-2"><span className={cx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', tone === 'teal' ? 'bg-teal' : 'bg-primary')} />{x}</li>
        ))}
      </ul>
    </section>
  );
  return (
    <Card className="flex flex-col gap-4 p-4">
      <header className="flex items-center gap-2">
        <Icon name="clinicalNotes" size={18} tone="primary" />
        <h3 className="text-base font-bold">Consultation summary</h3>
        <Pill tone={final.engine === 'ai' ? 'primary' : 'neutral'} label={final.engine === 'ai' ? 'AI' : 'Rules engine'} />
        <span className="flex-1" />
        <Button size="sm" variant="ghost" icon={copied ? 'check' : 'checklist'} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
      </header>

      <p className="text-sm leading-relaxed">{final.summary}</p>

      {final.key_points && final.key_points.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Key points">
          {final.key_points.map((x, i) => (
            <span key={i} className="rounded-full bg-ink-tint px-2.5 py-1 text-xs font-semibold text-ink">{x}</span>
          ))}
        </div>
      )}

      {(final.considerations?.length || final.follow_up?.length) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {panel('To consider', 'aiAssist', 'teal', final.considerations)}
          {panel('Follow-up', 'upcoming', 'primary', final.follow_up)}
        </div>
      ) : null}

      {final.gaps && final.gaps.length > 0 && (
        <div className="flex gap-2 rounded-xl bg-warning-tint p-3 text-sm text-warning-deep">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <div><b>Missing from your note:</b> {final.gaps.join(' · ')}</div>
        </div>
      )}

      {structured && (
        <div className="border-t border-hairline pt-4">
          <h3 className="text-base font-bold">What the visit would save (from your note)</h3>
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
        </div>
      )}
    </Card>
  );
}
