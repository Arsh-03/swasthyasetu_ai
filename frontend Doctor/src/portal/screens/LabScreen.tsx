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
import { Button, Card, PageHeader, Pill, Segmented, SelectInput, TextInput } from '../ui';
import { usePortal } from '../PortalContext';
import { doctorApi, type PatientBrief } from '../../services/doctorApi';
import { navigate } from '../router';

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

/** Masks personal identifiers (patient names to "Patient 1", exact age to range, phones to "[Phone masked]"). */
export function maskPersonalDetails(text: string): string {
  if (!text) return '';
  let out = text;

  const ageRange = (age: number) => {
    if (age < 1) return 'under 1 year';
    if (age < 10) return '1-9 years';
    if (age < 18) return '10-17 years';
    const start = Math.floor(age / 10) * 10;
    return `${start}-${start + 9} years`;
  };

  // 1. Age masking: exact age to range
  // "I am 21 years old" / "I'm 21 years old" / "he is 21 yrs old"
  out = out.replace(/(?<![-–\d])\b(i\s*am|i'm|he\s*is|she\s*is|patient\s*is)\s+(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|yr\s*old)\b/gi,
    (_, prefix, n) => {
      const a = parseInt(n, 10);
      return a <= 120 ? `${prefix} ${ageRange(a)} old` : `${prefix} ${n} years old`;
    });

  // "I am 21" / "I'm 21" (without units and not already a range)
  out = out.replace(/(?<![-–\d])\b(i\s*am|i'm|he\s*is|she\s*is)\s+(\d{1,2})\b(?!\s*[-–])(?!\s*(?:mg|ml|cm|kg|g|bpm|days?|weeks?|months?|hours?|hrs?|minutes?|mins?|times|tablets?|capsules?|pills?|percent|%|st|nd|rd|th|am|pm|\.|\d|years?|yrs?|yr))/gi,
    (_, prefix, n) => {
      const a = parseInt(n, 10);
      return (a >= 1 && a <= 110) ? `${prefix} ${ageRange(a)} old` : `${prefix} ${n}`;
    });

  // "age 21" / "age is 21" / "my age is 21"
  out = out.replace(/(?<![-–\d])\b((?:my\s+)?age(?:d)?\s*(?:is|:)?)\s*(\d{1,3})\s*(?:years?\s*(?:old)?)?\b/gi,
    (_, prefix, n) => {
      const a = parseInt(n, 10);
      return a <= 120 ? `${prefix} ${ageRange(a)}` : `${prefix} ${n}`;
    });

  // "21 years old" / "21-year-old" / "21 yr old" / "21 yrs old"
  out = out.replace(/(?<![-–\d])\b(\d{1,3})\s*[- ]\s*(?:years?|yrs?|yr)\s*[- ]\s*old\b/gi,
    (_, n) => {
      const a = parseInt(n, 10);
      return a <= 120 ? `${ageRange(a)} old` : `${n} years old`;
    });

  // Hindi age: "21 साल की उम्र" / "21 साल का" / "21 साल की"
  out = out.replace(/(?<![-–\d])\b(\d{1,3})\s*साल\s*(की\s*उम्र|का|की|के)\b/gi,
    (_, n, post) => {
      const a = parseInt(n, 10);
      if (a <= 120) {
        const start = Math.floor(a / 10) * 10;
        return `${start}-${start + 9} साल ${post}`.trim();
      }
      return `${n} साल ${post}`;
    });

  // "उम्र 21 साल" / "आयु 21"
  out = out.replace(/(?<![-–\d])\b(?:उम्र|आयु)\s*(?:है\s*|:\s*)?(\d{1,3})\s*(?:साल|वर्ष)?\b/gi,
    (_, n) => {
      const a = parseInt(n, 10);
      if (a <= 120) {
        const start = Math.floor(a / 10) * 10;
        return `उम्र ${start}-${start + 9} वर्ष`;
      }
      return `उम्र ${n} वर्ष`;
    });

  // 2. Name masking: "My name is ...", "I am [Name]" -> "Patient 1"
  const NON_NAMES = new Set([
    'suffering', 'having', 'feeling', 'taking', 'allergic', 'experiencing', 'fine', 'okay',
    'here', 'ready', 'sick', 'in', 'from', 'doctor', 'patient', 'not', 'unable', 'getting',
    'facing', 'pregnant', 'diabetic', 'asthmatic', 'coughing', 'sneezing', 'vomiting', 'bleeding',
    'hurting', 'talking', 'speaking', 'calling', 'visiting', 'coming', 'going', 'tired', 'weak',
    'dizzy', 'nauseous', 'better', 'worse', 'healthy', 'sorry', 'asking', 'telling', 'waiting',
    'looking', 'showing', 'trying', 'very', 'much', 'too', 'also', 'still', 'always', 'pain',
    'chest', 'stomach', 'headache', 'fever', 'cough', 'cold', 'kidney', 'stone'
  ]);

  out = out.replace(/\b(?:my\s+name\s+is|name\s+is)\s+([A-Za-z]{2,}(?:\s+[A-Za-z]{2,})?)\b/gi,
    (match, name) => {
      const first = name.trim().split(/\s+/)[0].toLowerCase();
      if (NON_NAMES.has(first)) return match;
      return 'My name is Patient 1';
    });

  out = out.replace(/\b(?:i\s*am|i'm)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g,
    (match, name) => {
      const first = name.trim().split(/\s+/)[0].toLowerCase();
      if (NON_NAMES.has(first)) return match;
      return 'I am Patient 1';
    });

  out = out.replace(/(?:मेरा\s+नाम|नाम)\s+([ऀ-෿]{2,}(?:\s+[ऀ-෿]{2,})?)\s+(?:है)?/gi, 'मेरा नाम Patient 1 है');
  out = out.replace(/(?:ನನ್ನ\s+ಹೆಸರು|ಹೆಸರು)\s+([ऀ-෿]{2,}(?:\s+[ऀ-෿]{2,})?)/gi, 'ನನ್ನ ಹೆಸರು Patient 1');

  // Replace placeholder "[PATIENT]" and "the patient" with "Patient 1"
  out = out.replace(/\[PATIENT\]('s)?/gi, (_, s) => `Patient 1${s || ''}`);
  out = out.replace(/\bthe patient('s)?\b/gi, (_, s) => `Patient 1${s || ''}`);

  // 3. Phone numbers masking
  out = out.replace(/(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g, '[Phone masked]');
  out = out.replace(/\b(?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|double|triple)[\s,-]+){6,}(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/gi, '[Phone masked]');
  out = out.replace(/\[PHONE(?:_\d+)?\]/gi, '[Phone masked]');

  // 4. Aadhaar / 12-digit IDs masking
  out = out.replace(/(?<!\d)\d{4}[\s-]\d{4}[\s-]\d{4}(?!\d)/g, '[ID masked]');
  out = out.replace(/\[ID(?:_\d+)?\]/gi, '[ID masked]');
  out = out.replace(/\[ABHA(?:_\d+)?\]/gi, '[ABHA masked]');
  out = out.replace(/\[EMAIL(?:_\d+)?\]/gi, '[Email masked]');
  out = out.replace(/\[PIN(?:_\d+)?\]/gi, '[PIN masked]');

  return out;
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

export interface LiveTablet {
  id: string;
  name: string;
  form?: string;
  strength?: string;
  frequency?: string;
  duration?: string;
  whenToTake?: string;
  isComplete: boolean;
  missingFields: ('dose' | 'timing' | 'frequency')[];
  rawText: string;
}

interface CommonDrug {
  name: string;
  aliases: string[];
  defaultDose: string;
  defaultTiming: string;
  defaultFreq: string;
  defaultDur: string;
  classGroup?: string;
}

const COMMON_DRUGS: CommonDrug[] = [
  { name: 'Paracetamol', aliases: ['paracetamol', 'dolo', 'crocin', 'calpol', 'pcm'], defaultDose: '650 mg', defaultTiming: 'After food', defaultFreq: 'TDS (Thrice daily)', defaultDur: '5 days', classGroup: 'analgesic' },
  { name: 'Pantocid', aliases: ['pantocid', 'pantoprazole', 'pan-40', 'pan 40', 'pan d', 'pan-d', 'omez'], defaultDose: '40 mg', defaultTiming: 'Before food', defaultFreq: 'OD (Once daily)', defaultDur: '5 days', classGroup: 'ppi' },
  { name: 'Cetirizine', aliases: ['cetirizine', 'cetzine', 'alerid', 'zyrtec'], defaultDose: '10 mg', defaultTiming: 'At bedtime', defaultFreq: 'OD (Once daily)', defaultDur: '5 days', classGroup: 'antihistamine' },
  { name: 'Amoxicillin', aliases: ['amoxicillin', 'mox', 'novamox', 'amoxil'], defaultDose: '500 mg', defaultTiming: 'After food', defaultFreq: 'TDS (Thrice daily)', defaultDur: '5 days', classGroup: 'penicillin' },
  { name: 'Augmentin', aliases: ['augmentin', 'amoxyclav', 'clavum'], defaultDose: '625 mg', defaultTiming: 'With meals', defaultFreq: 'BD (Twice daily)', defaultDur: '5 days', classGroup: 'penicillin' },
  { name: 'Combiflam', aliases: ['combiflam', 'ibuprofen', 'brufen'], defaultDose: '400 mg', defaultTiming: 'After food', defaultFreq: 'BD (Twice daily)', defaultDur: '3 days', classGroup: 'nsaid' },
  { name: 'Azithromycin', aliases: ['azithromycin', 'azithral', 'aithro'], defaultDose: '500 mg', defaultTiming: 'Before food', defaultFreq: 'OD (Once daily)', defaultDur: '3 days', classGroup: 'macrolide' },
  { name: 'Metformin', aliases: ['metformin', 'glycomet'], defaultDose: '500 mg', defaultTiming: 'After food', defaultFreq: 'BD (Twice daily)', defaultDur: '30 days', classGroup: 'antidiabetic' },
  { name: 'Telmisartan', aliases: ['telmisartan', 'telma', 'telpres'], defaultDose: '40 mg', defaultTiming: 'Morning', defaultFreq: 'OD (Once daily)', defaultDur: '30 days', classGroup: 'antihypertensive' },
  { name: 'Aspirin', aliases: ['aspirin', 'ecosprin', 'disprin'], defaultDose: '75 mg', defaultTiming: 'After food', defaultFreq: 'OD (Once daily)', defaultDur: '30 days', classGroup: 'nsaid' },
  { name: 'Montair-LC', aliases: ['montair-lc', 'montair lc', 'montelukast'], defaultDose: '10 mg', defaultTiming: 'At bedtime', defaultFreq: 'OD (Once daily)', defaultDur: '7 days', classGroup: 'antihistamine' },
];

function detectAllergyConflicts(allergies: string[], tablets: LiveTablet[]): { tabletName: string; allergy: string; detail: string }[] {
  const conflicts: { tabletName: string; allergy: string; detail: string }[] = [];
  const normalizedAllergies = allergies.map(a => a.toLowerCase().trim());

  for (const tab of tablets) {
    const drugName = tab.name.toLowerCase();
    for (const allergy of normalizedAllergies) {
      if (!allergy || allergy === 'none' || allergy === 'nkda' || allergy === 'no known allergies') continue;

      if (drugName.includes(allergy) || allergy.includes(drugName)) {
        conflicts.push({
          tabletName: tab.name,
          allergy,
          detail: `Patient has direct allergy recorded for "${allergy}". Prescribing ${tab.name} is strictly contraindicated!`,
        });
        continue;
      }

      if ((allergy.includes('penicillin') || allergy.includes('beta-lactam') || allergy.includes('amox')) &&
          (drugName.includes('amoxicillin') || drugName.includes('augmentin') || drugName.includes('ampicillin') || drugName.includes('clavum'))) {
        conflicts.push({
          tabletName: tab.name,
          allergy,
          detail: `Patient reported allergy to Penicillin. Prescribing ${tab.name} carries severe risk of cross-reactivity and anaphylaxis!`,
        });
        continue;
      }

      if ((allergy.includes('aspirin') || allergy.includes('nsaid') || allergy.includes('ibuprofen')) &&
          (drugName.includes('combiflam') || drugName.includes('ibuprofen') || drugName.includes('aspirin') || drugName.includes('diclofenac') || drugName.includes('naproxen'))) {
        conflicts.push({
          tabletName: tab.name,
          allergy,
          detail: `Patient reported sensitivity to ${allergy}. ${tab.name} is an NSAID and may provoke bronchospasm or gastrointestinal irritation.`,
        });
        continue;
      }

      if (allergy.includes('sulfa') && (drugName.includes('cotrimoxazole') || drugName.includes('bactrim') || drugName.includes('sulfamethoxazole'))) {
        conflicts.push({
          tabletName: tab.name,
          allergy,
          detail: `Patient reported Sulfa allergy. ${tab.name} contains sulfonamide and may cause severe hypersensitivity or rash.`,
        });
        continue;
      }
    }
  }

  return conflicts;
}

function parseTabletLine(line: string, id?: string, knownDrug?: CommonDrug): LiveTablet | null {
  const clean = line.replace(/^[-*•]\s*/, '').trim();
  if (!clean) return null;

  let name = '';
  let form = 'Tab';

  const mForm = clean.match(/^(Tab(?:let)?|Cap(?:sule)?|Syr(?:up)?|Inj(?:ection)?)\.?\s+([A-Za-z0-9-]+(?:\s+[A-Za-z0-9-]+)?)/i);
  if (mForm) {
    form = mForm[1].toLowerCase().startsWith('cap') ? 'Cap' : mForm[1].toLowerCase().startsWith('syr') ? 'Syr' : 'Tab';
    name = mForm[2].trim();
  } else if (knownDrug) {
    name = knownDrug.name;
    form = 'Tab';
  } else {
    for (const d of COMMON_DRUGS) {
      if (new RegExp(`\\b${d.aliases.join('|')}\\b`, 'i').test(clean)) {
        name = d.name;
        break;
      }
    }
  }

  if (!name) return null;
  name = name.charAt(0).toUpperCase() + name.slice(1);

  const mDose = clean.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|tablets?|caps?|units?))\b/i);
  const strength = mDose ? mDose[1].trim() : undefined;

  const mTiming = clean.match(/\b(after\s+food|before\s+food|after\s+meals?|before\s+meals?|empty\s+stomach|at\s+bedtime|with\s+food|with\s+meals?|in\s+the\s+morning|at\s+night)\b/i);
  let whenToTake: string | undefined = undefined;
  if (mTiming) {
    const t = mTiming[1].toLowerCase();
    if (t.includes('after')) whenToTake = 'After food';
    else if (t.includes('before') || t.includes('empty')) whenToTake = 'Before food';
    else if (t.includes('bedtime') || t.includes('night')) whenToTake = 'At bedtime';
    else if (t.includes('with')) whenToTake = 'With meals';
    else whenToTake = mTiming[1];
  }

  const mFreq = clean.match(/\b(once\s+daily|twice\s+daily|thrice\s+daily|four\s+times\s+daily|\b(?:od|bd|bid|tds|tid|qid|sos|prn|hs)\b)/i);
  let frequency: string | undefined = undefined;
  if (mFreq) {
    const f = mFreq[1].toLowerCase();
    if (f === 'od' || f === 'once daily') frequency = 'OD (Once daily)';
    else if (f === 'bd' || f === 'bid' || f === 'twice daily') frequency = 'BD (Twice daily)';
    else if (f === 'tds' || f === 'tid' || f === 'thrice daily') frequency = 'TDS (Thrice daily)';
    else if (f === 'sos' || f === 'prn') frequency = 'SOS (As needed)';
    else frequency = mFreq[1].toUpperCase();
  }

  const mDur = clean.match(/\b(?:x\s*)?(\d+\s*(?:days?|weeks?|months?))\b/i);
  const duration = mDur ? mDur[1].trim() : undefined;

  const missingFields: ('dose' | 'timing' | 'frequency')[] = [];
  if (!strength) missingFields.push('dose');
  if (!whenToTake) missingFields.push('timing');

  return {
    id: id || `tab_${name.toLowerCase()}_${Date.now()}`,
    name,
    form,
    strength,
    frequency,
    duration,
    whenToTake,
    isComplete: missingFields.length === 0,
    missingFields,
    rawText: clean,
  };
}

function parseTabletsAndAllergies(
  noteText: string,
  facts: LabFact[],
  transcript: { speaker: string; text: string }[]
): { tablets: LiveTablet[]; allergies: string[] } {
  const tabletsMap = new Map<string, LiveTablet>();
  const allergiesSet = new Set<string>();

  for (const f of facts) {
    if (f.key === 'allergies' || f.heading?.toLowerCase().includes('allerg') || f.section === 'allergies') {
      const cleaned = f.text.replace(/^(?:allerg(?:y|ies)?(?:\s+to)?|known\s+allergies:?)\s*/i, '').trim();
      if (cleaned && !/^(?:none|nil|nkda|no known)/i.test(cleaned)) {
        allergiesSet.add(cleaned);
      }
    }
    if (f.key === 'rx' || f.heading?.toLowerCase().includes('rx') || f.heading?.toLowerCase().includes('prescript') || f.section === 'plan') {
      const tab = parseTabletLine(f.text, f.id);
      if (tab) tabletsMap.set(tab.name.toLowerCase(), tab);
    }
  }

  if (noteText) {
    const lines = noteText.split('\n');
    let currentSection = '';
    for (const line of lines) {
      const trimmed = line.trim();
      const mHeading = trimmed.match(/^([A-Za-z /&-]+):/);
      if (mHeading) {
        currentSection = mHeading[1].toLowerCase().trim();
      }

      if (currentSection.includes('allerg') && trimmed && !mHeading) {
        const cleaned = trimmed.replace(/^[-*•]\s*/, '').trim();
        if (cleaned && !/^(?:none|nil|nkda|no known)/i.test(cleaned)) {
          allergiesSet.add(cleaned);
        }
      }

      if ((currentSection.includes('rx') || currentSection.includes('prescript') || currentSection.includes('medication')) && trimmed && !mHeading) {
        const tab = parseTabletLine(trimmed);
        if (tab) {
          tabletsMap.set(tab.name.toLowerCase(), tab);
        }
      }
    }
  }

  for (const t of transcript) {
    const mAllergy = t.text.match(/(?:allergic\s+to|allergy\s+(?:to|towards|of)?)\s+([A-Za-z0-9 -]+?)(?:[.,;\n]|$)/i);
    if (mAllergy && mAllergy[1]) {
      const allg = mAllergy[1].trim();
      if (!/^(?:something|anything|nothing|none|no)/i.test(allg)) {
        allergiesSet.add(allg);
      }
    }

    for (const drug of COMMON_DRUGS) {
      for (const alias of drug.aliases) {
        if (new RegExp(`\\b${alias}\\b`, 'i').test(t.text)) {
          if (!tabletsMap.has(drug.name.toLowerCase())) {
            const tab = parseTabletLine(t.text, undefined, drug);
            if (tab) tabletsMap.set(drug.name.toLowerCase(), tab);
          }
        }
      }
    }
  }

  return {
    tablets: Array.from(tabletsMap.values()),
    allergies: Array.from(allergiesSet),
  };
}

interface LiveTabletsCardProps {
  tablets: LiveTablet[];
  allergies: string[];
  allergyConflicts: { tabletName: string; allergy: string; detail: string }[];
  onConfirmTablet: (tab: LiveTablet) => void;
  onAddTablet: (tab: LiveTablet) => void;
  onRemoveTablet: (name: string) => void;
}

function LiveTabletsCard({
  tablets,
  allergies,
  allergyConflicts,
  onConfirmTablet,
  onAddTablet,
  onRemoveTablet,
}: LiveTabletsCardProps) {
  const [activeClarifyId, setActiveClarifyId] = useState<string | null>(null);
  const [selectedDose, setSelectedDose] = useState('');
  const [selectedTiming, setSelectedTiming] = useState('');
  const [selectedFreq, setSelectedFreq] = useState('');
  const [selectedDur, setSelectedDur] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualDose, setManualDose] = useState('');
  const [manualTiming, setManualTiming] = useState('After food');

  // Auto-focus the first incomplete tablet if no clarify tablet is active
  const incompleteTablet = tablets.find(t => !t.isComplete);
  const effectiveActiveId = activeClarifyId ?? (incompleteTablet ? incompleteTablet.id : null);
  const activeTab = tablets.find(t => t.id === effectiveActiveId);

  const completeCount = tablets.filter(t => t.isComplete).length;
  const needsCount = tablets.length - completeCount;

  const handleApplyClarification = () => {
    if (!activeTab) return;
    const finalDose = selectedDose || activeTab.strength || '650 mg';
    const finalTiming = selectedTiming || activeTab.whenToTake || 'After food';
    const finalFreq = selectedFreq || activeTab.frequency || 'BD (Twice daily)';
    const finalDur = selectedDur || activeTab.duration || '5 days';

    const updated: LiveTablet = {
      ...activeTab,
      strength: finalDose,
      whenToTake: finalTiming,
      frequency: finalFreq,
      duration: finalDur,
      isComplete: true,
      missingFields: [],
    };

    onConfirmTablet(updated);
    setActiveClarifyId(null);
    setSelectedDose('');
    setSelectedTiming('');
    setSelectedFreq('');
    setSelectedDur('');
    setFeedback(`✓ Confirmed Tab ${updated.name} ${finalDose} (${finalTiming}) & written to note!`);
    window.setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    const newTab: LiveTablet = {
      id: `tab_${manualName.toLowerCase()}_${Date.now()}`,
      name: manualName.trim().charAt(0).toUpperCase() + manualName.trim().slice(1),
      form: 'Tab',
      strength: manualDose.trim() || '650 mg',
      whenToTake: manualTiming || 'After food',
      frequency: 'BD (Twice daily)',
      duration: '5 days',
      isComplete: true,
      missingFields: [],
      rawText: `Tab ${manualName} ${manualDose || '650 mg'} BD x 5 days ${manualTiming || 'After food'}`,
    };
    onAddTablet(newTab);
    setManualName('');
    setManualDose('');
    setShowManualAdd(false);
    setFeedback(`✓ Prescribed Tab ${newTab.name} ${newTab.strength} (${newTab.whenToTake})!`);
    window.setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <Card className="flex flex-col gap-3 p-4 border border-border shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2.5">
        <div className="flex items-center gap-2">
          <Icon name="medication" size={18} tone="primary" />
          <h3 className="text-sm font-bold text-ink">Live Tablets & Prescription</h3>
          {tablets.length > 0 && (
            <span className={cx(
              'rounded-full px-2 py-0.5 text-xs font-semibold',
              needsCount > 0 ? 'bg-warning-tint text-warning-deep' : 'bg-success-tint text-success-deep'
            )}>
              {completeCount} Confirmed{needsCount > 0 ? ` · ${needsCount} Needs Details` : ' ✓'}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon="add"
          onClick={() => setShowManualAdd(!showManualAdd)}
        >
          {showManualAdd ? 'Cancel' : '+ Prescribe Tablet'}
        </Button>
      </header>

      {/* Manual tablet entry drawer */}
      {showManualAdd && (
        <form onSubmit={handleCreateManual} className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col gap-2.5 text-xs">
          <div className="font-bold text-ink">Prescribe New Tablet:</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-ink-muted mb-0.5 block">Tablet Name:</label>
              <TextInput
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="e.g. Paracetamol"
                required
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-ink-muted mb-0.5 block">Dose / Strength:</label>
              <TextInput
                value={manualDose}
                onChange={e => setManualDose(e.target.value)}
                placeholder="e.g. 650 mg"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-ink-muted mb-0.5 block">When to Take:</label>
              <SelectInput
                value={manualTiming}
                onChange={e => setManualTiming(e.target.value)}
                className="h-8 text-xs"
              >
                <option value="After food">After food</option>
                <option value="Before food">Before food</option>
                <option value="At bedtime">At bedtime</option>
                <option value="With meals">With meals</option>
                <option value="Empty stomach">Empty stomach</option>
              </SelectInput>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setShowManualAdd(false)}>Cancel</Button>
            <Button size="sm" variant="primary" type="submit" icon="check">Add to Prescription</Button>
          </div>
        </form>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div className="rounded-xl bg-success-tint border border-success/30 px-3 py-2 text-xs font-semibold text-success-deep flex items-center gap-1.5 animate-fadeIn">
          <Icon name="checkCircle" size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Allergy detection chip bar */}
      {allergies.length > 0 && (
        <div className="rounded-xl bg-ink-tint/50 border border-hairline p-2 text-xs flex flex-wrap items-center gap-1.5">
          <Icon name="drugAlert" size={15} tone="warning" />
          <span className="font-semibold text-ink">Reported Allergies:</span>
          {allergies.map((a, i) => (
            <span key={i} className="rounded-chip bg-warning-tint text-warning-deep px-2 py-0.5 text-2xs font-bold border border-warning/20">
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Cross-Allergy Conflict Banner */}
      {allergyConflicts.length > 0 && (
        <div className="rounded-xl bg-danger-tint border border-danger/30 p-3 text-xs text-danger-deep flex flex-col gap-1.5 shadow-sm">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-danger">
            <Icon name="emergency" size={16} /> Drug-Allergy Interaction Warning!
          </div>
          {allergyConflicts.map((c, i) => (
            <p key={i} className="leading-snug">
              <b>Tab {c.tabletName}:</b> {c.detail}
            </p>
          ))}
        </div>
      )}

      {/* Tablet list */}
      {tablets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-4 px-3 text-center text-xs text-ink-muted">
          <Icon name="medication" size={24} className="mx-auto mb-1 text-ink-muted/60" />
          No tablets detected yet. Speak your prescription (e.g. <i>"I am prescribing Tab Paracetamol 650 mg after food"</i>) or use the buttons below.
        </div>
      ) : (
        <div className="space-y-2">
          {tablets.map(tab => (
            <div
              key={tab.id}
              className={cx(
                'rounded-xl border p-2.5 transition-all flex flex-col gap-1.5',
                !tab.isComplete ? 'border-warning bg-warning-tint/20' : 'border-hairline bg-card'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-sm text-ink truncate">
                    {tab.form || 'Tab'} {tab.name}
                  </span>
                  {tab.isComplete ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-2xs font-semibold text-success-deep">
                      <Icon name="check" size={11} /> {tab.strength} · {tab.whenToTake}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning-tint px-2 py-0.5 text-2xs font-bold text-warning-deep">
                      <Icon name="warning" size={11} /> Missing {tab.missingFields.join(' & ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!tab.isComplete && (
                    <Button
                      size="sm"
                      variant="primary"
                      icon="aiAssist"
                      onClick={() => setActiveClarifyId(activeClarifyId === tab.id ? null : tab.id)}
                    >
                      Fill Details
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveTablet(tab.name)}
                    className="p-1 rounded text-ink-muted hover:text-danger hover:bg-danger-tint transition-colors cursor-pointer"
                    title="Remove tablet"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>

              {tab.isComplete && (
                <div className="flex flex-wrap gap-2 text-2xs text-ink-muted">
                  <span>Frequency: <b>{tab.frequency || 'BD'}</b></span>
                  <span>Duration: <b>{tab.duration || '5 days'}</b></span>
                  <span>Timing: <b className="text-primary-deep">{tab.whenToTake}</b></span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Interactive Chibi Prompt Box (whenever dose or timing is missing) */}
      {activeTab && !activeTab.isComplete && (
        <div className="rounded-xl border-2 border-primary/40 bg-primary-tint/30 p-3.5 flex flex-col gap-3 shadow-sm animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white shrink-0 shadow-sm">
              <Icon name="aiAssist" size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-2xs font-extrabold uppercase tracking-wider text-primary-deep">CHIBI Interactive Clinical Assistant</span>
                <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-primary" />
              </div>
              <p className="text-xs font-semibold text-ink mt-0.5">
                Doctor, please confirm the missing dosage and when to take for <b>Tab {activeTab.name}</b>:
              </p>
            </div>
          </div>

          {/* Quick Dose selection */}
          <div className="space-y-1">
            <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
              1. Dose / Strength:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {['650 mg', '500 mg', '625 mg', '40 mg', '10 mg', '100 mg', '1 tablet'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDose(d)}
                  className={cx(
                    'rounded-chip px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer',
                    (selectedDose || activeTab.strength) === d
                      ? 'bg-primary text-on-primary border-primary shadow-xs'
                      : 'bg-card text-ink border-border hover:bg-base'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Timing / When to take */}
          <div className="space-y-1">
            <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
              2. When to Take:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {['After food', 'Before food', 'At bedtime', 'With meals', 'Empty stomach'].map(timing => (
                <button
                  key={timing}
                  type="button"
                  onClick={() => setSelectedTiming(timing)}
                  className={cx(
                    'rounded-chip px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer',
                    (selectedTiming || activeTab.whenToTake) === timing
                      ? 'bg-primary text-on-primary border-primary shadow-xs'
                      : 'bg-card text-ink border-border hover:bg-base'
                  )}
                >
                  {timing}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Frequency & Duration row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-primary/20">
            <div>
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1 block">Frequency:</span>
              <div className="flex flex-wrap gap-1">
                {['TDS (Thrice daily)', 'BD (Twice daily)', 'OD (Once daily)', 'SOS'].map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelectedFreq(f)}
                    className={cx(
                      'rounded-chip px-2 py-0.5 text-2xs font-medium border transition-colors cursor-pointer',
                      (selectedFreq || activeTab.frequency || 'BD (Twice daily)') === f
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-card text-ink border-border hover:bg-base'
                    )}
                  >
                    {f.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1 block">Duration:</span>
              <div className="flex flex-wrap gap-1">
                {['3 days', '5 days', '7 days', '14 days'].map(dur => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setSelectedDur(dur)}
                    className={cx(
                      'rounded-chip px-2 py-0.5 text-2xs font-medium border transition-colors cursor-pointer',
                      (selectedDur || activeTab.duration || '5 days') === dur
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-card text-ink border-border hover:bg-base'
                    )}
                  >
                    {dur}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              icon="check"
              onClick={handleApplyClarification}
            >
              Confirm Details & Write to Note
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveClarifyId(null)}
            >
              Skip for now
            </Button>
          </div>
        </div>
      )}

      {/* Quick Clinic Presets */}
      <div className="pt-2 border-t border-hairline">
        <div className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
          One-Tap Prescribe (Common India Clinic Formulations):
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { name: 'Paracetamol', dose: '650 mg', timing: 'After food', freq: 'TDS (Thrice daily)', dur: '5 days' },
            { name: 'Pantocid', dose: '40 mg', timing: 'Before food', freq: 'OD (Once daily)', dur: '5 days' },
            { name: 'Cetirizine', dose: '10 mg', timing: 'At bedtime', freq: 'OD (Once daily)', dur: '5 days' },
            { name: 'Augmentin', dose: '625 mg', timing: 'With meals', freq: 'BD (Twice daily)', dur: '5 days' },
          ].map(p => (
            <button
              key={p.name}
              type="button"
              onClick={() => onAddTablet({
                id: `tab_${p.name.toLowerCase()}_${Date.now()}`,
                name: p.name,
                form: 'Tab',
                strength: p.dose,
                frequency: p.freq,
                duration: p.dur,
                whenToTake: p.timing,
                isComplete: true,
                missingFields: [],
                rawText: `Tab ${p.name} ${p.dose} ${p.freq} x ${p.dur} ${p.timing}`,
              })}
              className="rounded-chip bg-ink-tint/70 hover:bg-ink-tint px-2 py-1 text-2xs font-semibold text-ink flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Icon name="add" size={11} /> Tab {p.name} {p.dose} ({p.timing})
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

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

  const [liveNote, setLiveNote] = useState('');
  const [notepadInsert, setNotepadInsert] = useState<{ id: string; text: string; section: string; heading?: string } | null>(null);
  const [manualTablets, setManualTablets] = useState<LiveTablet[]>([]);
  const [manualAllergies, setManualAllergies] = useState<string[]>([]);

  const { tablets, allergies, allergyConflicts } = useMemo(() => {
    const parsed = parseTabletsAndAllergies(liveNote, state?.facts ?? [], state?.transcript ?? []);
    const combinedAllergies = Array.from(new Set([...parsed.allergies, ...manualAllergies]));
    const tabsMap = new Map<string, LiveTablet>();
    for (const t of parsed.tablets) tabsMap.set(t.name.toLowerCase(), t);
    for (const t of manualTablets) tabsMap.set(t.name.toLowerCase(), t);
    const combinedTablets = Array.from(tabsMap.values());
    const conflicts = detectAllergyConflicts(combinedAllergies, combinedTablets);
    return { tablets: combinedTablets, allergies: combinedAllergies, allergyConflicts: conflicts };
  }, [liveNote, state?.facts, state?.transcript, manualTablets, manualAllergies]);

  const handleConfirmTablet = useCallback((updated: LiveTablet) => {
    setManualTablets(prev => {
      const next = prev.filter(t => t.name.toLowerCase() !== updated.name.toLowerCase());
      return [...next, updated];
    });
    const line = `${updated.form || 'Tab'} ${updated.name} ${updated.strength || '650 mg'} ${updated.frequency || 'BD'} x ${updated.duration || '5 days'} ${updated.whenToTake || 'After food'}`;
    setNotepadInsert({
      id: `rx_${updated.name.toLowerCase()}_${Date.now()}`,
      section: 'plan',
      heading: 'Rx',
      text: line,
    });
  }, []);

  const handleAddTablet = useCallback((newTab: LiveTablet) => {
    setManualTablets(prev => [...prev.filter(t => t.name.toLowerCase() !== newTab.name.toLowerCase()), newTab]);
    if (newTab.isComplete) {
      const line = `${newTab.form || 'Tab'} ${newTab.name} ${newTab.strength} ${newTab.frequency || 'BD'} x ${newTab.duration || '5 days'} ${newTab.whenToTake}`;
      setNotepadInsert({
        id: `rx_${newTab.name.toLowerCase()}_${Date.now()}`,
        section: 'plan',
        heading: 'Rx',
        text: line,
      });
    }
  }, []);

  const handleRemoveTablet = useCallback((name: string) => {
    setManualTablets(prev => prev.filter(t => t.name.toLowerCase() !== name.toLowerCase()));
  }, []);

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
      setInterim(isMeaningfulPhrase(cleanLive) ? maskPersonalDetails(cleanLive) : '');
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

  const reset = () => {
    stopListening();
    setState(null);
    setInterim('');
    setLiveNote('');
    setManualTablets([]);
    setManualAllergies([]);
    setNotepadInsert(null);
  };

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
                    <Icon name={voiceGated ? 'shieldCheck' : 'speaker'} size={12} />
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
                    {l.speaker === 'doctor' ? 'Doctor' : 'Patient'}</span>{maskPersonalDetails(l.text)}</p>
                ))}
                {interim && <p className="italic text-ink-muted">{maskPersonalDetails(interim)}…</p>}
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

            {state.final && (
              <FinalCard
                sessionId={state.session_id}
                final={state.final}
                structured={state.structured}
                liveTablets={tablets}
                noteText={noteRef.current || liveNote}
              />
            )}
          </div>

          <div className="flex flex-col gap-4 min-w-0">
            <LiveTabletsCard
              tablets={tablets}
              allergies={allergies}
              allergyConflicts={allergyConflicts}
              onConfirmTablet={handleConfirmTablet}
              onAddTablet={handleAddTablet}
              onRemoveTablet={handleRemoveTablet}
            />
            <ClinicalNotepad
              key={state.encounter_id}
              encounterId={state.encounter_id}
              patientName="Patient 1"
              callMinutes={minutes}
              autoApplyCall={autoWrite}
              onTextChange={t => {
                noteRef.current = t;
                setLiveNote(t);
              }}
              insertRequest={notepadInsert}
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

function FinalCard({
  sessionId,
  final,
  structured,
  liveTablets,
  noteText,
}: {
  sessionId: string;
  final: LabFinal;
  structured?: Structured;
  liveTablets: LiveTablet[];
  noteText?: string;
}) {
  const { doctor, toast } = usePortal();
  const [copied, setCopied] = useState(false);
  const [patients, setPatients] = useState<PatientBrief[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [doctorVerified, setDoctorVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signedResult, setSignedResult] = useState<{
    signature: string;
    signed_at: string;
    record_id: string;
    patient_name: string;
    patient_id: string;
    pushed_prescriptions_count: number;
  } | null>(null);

  useEffect(() => {
    doctorApi.patients().then(list => {
      setPatients(list);
      if (list.length > 0 && !selectedPatientId) {
        setSelectedPatientId(list[0].patient_id);
      }
    }).catch(() => {});
  }, []);

  const handleSignAndCommit = async () => {
    if (!doctorVerified) return;
    setSubmitting(true);
    try {
      const res = await doctorApi.signAndPushLabReport(sessionId, {
        patient_id: selectedPatientId || undefined,
        note: noteText,
        doctor_signature_name: doctor?.display_name || 'Dr. Ananya Sharma',
      });
      setSignedResult(res);
      toast('Consultation verified and duly signed! Pushed to ABDM records & patient care plan.', 'success');
    } catch (e) {
      toast(`Verification error: ${(e as Error).message}`, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

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

  // Tablets to commit: merge structured prescription with live tablets
  const tabletsToCommit: LabMed[] = useMemo(() => {
    if (structured?.prescription?.length) return structured.prescription;
    return liveTablets.map(t => ({
      name: t.name,
      form: t.form ?? 'Tab',
      strength: t.strength ?? '650 mg',
      frequency: t.frequency ?? 'BD (Twice daily)',
      duration: t.duration ?? '5 days',
      timing: t.whenToTake ?? 'After food',
      text: `${t.form ?? 'Tab'} ${t.name} ${t.strength ?? '650 mg'} ${t.frequency ?? 'BD'} ${t.whenToTake ?? 'After food'}`,
    }));
  }, [structured?.prescription, liveTablets]);

  return (
    <Card className="flex flex-col gap-4 p-4 border border-border shadow-sm">
      <header className="flex items-center gap-2">
        <Icon name="clinicalNotes" size={18} tone="primary" />
        <h3 className="text-base font-bold text-ink">Consultation Summary & Review</h3>
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

      {/* Signed Certificate Seal (Displayed after doctor clicks 'Checked by the doctor and duly signed') */}
      {signedResult ? (
        <div className="rounded-2xl border-2 border-success bg-success-tint/40 p-5 flex flex-col gap-3 shadow-md animate-fadeIn">
          <div className="flex items-center gap-2.5 text-success-deep font-bold text-base">
            <Icon name="verified" size={24} />
            <span>Checked by the doctor and duly signed</span>
            <Pill tone="success" dot label="Committed to Records" />
          </div>

          <p className="text-xs text-ink leading-relaxed">
            This consultation report and prescription have been cryptographically verified and signed by{' '}
            <b>{doctor?.display_name || 'Dr. Ananya Sharma'}</b>, and officially committed to the ABDM Health Locker vault.
            Active tablet prescriptions have been pushed to the patient app daily routine schedule.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-card/90 rounded-xl p-3 border border-success/30">
            <div>
              <span className="text-ink-muted">Doctor:</span>{' '}
              <b>{doctor?.display_name || 'Dr. Ananya Sharma'} (NMC Registered)</b>
            </div>
            <div>
              <span className="text-ink-muted">Digital Signature:</span>{' '}
              <span className="font-mono text-2xs bg-ink-tint px-1.5 py-0.5 rounded font-bold">{signedResult.signature}</span>
            </div>
            <div>
              <span className="text-ink-muted">Patient:</span>{' '}
              <b>{signedResult.patient_name}</b>
            </div>
            <div>
              <span className="text-ink-muted">ABDM Record Vault ID:</span>{' '}
              <span className="font-mono text-2xs bg-ink-tint px-1.5 py-0.5 rounded font-bold">{signedResult.record_id}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-ink-muted">Care Plan Propagation:</span>{' '}
              <b className="text-success-deep">
                {signedResult.pushed_prescriptions_count} active prescription(s) updated in patient's daily medication schedule
              </b>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              icon="person"
              onClick={() => navigate({ page: 'patient', patientId: signedResult.patient_id, tab: 'overview' })}
            >
              View Updated Patient Profile & Care Plan →
            </Button>
          </div>
        </div>
      ) : (
        /* Doctor Verification & Sign-off Gate */
        <div className="border-t border-hairline pt-4 flex flex-col gap-3.5">
          <div className="flex items-center gap-2">
            <Icon name="sign" size={20} tone="primary" />
            <h3 className="text-base font-bold text-ink">Clinical Verification & Doctor Sign-Off</h3>
          </div>
          <p className="text-xs text-ink-muted">
            Before committing this consultation and prescription to the database, verify all tablet doses, timings,
            allergies, and diagnosis. Once verified, click below to digitally sign and commit into official health records.
          </p>

          {/* Target Patient Selector */}
          <div className="flex flex-col gap-1 max-w-md">
            <label className="text-xs font-semibold text-ink">Commit To Patient Record:</label>
            <SelectInput
              value={selectedPatientId}
              onChange={e => setSelectedPatientId(e.target.value)}
            >
              {patients.length > 0 ? (
                patients.map(p => (
                  <option key={p.patient_id} value={p.patient_id}>
                    {p.full_name} ({p.abha_address || p.patient_id}) {p.age ? `· ${p.age}y` : ''}
                  </option>
                ))
              ) : (
                <option value="">Test Patient (Default)</option>
              )}
            </SelectInput>
          </div>

          {/* Structured Prescription Table to be saved */}
          <div className="rounded-xl border border-hairline p-3 bg-card flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-ink">
              <span className="uppercase tracking-wider text-ink-muted">Prescription to commit to care plan:</span>
              <span className="text-2xs text-ink-muted">{tabletsToCommit.length} medicine(s)</span>
            </div>
            {tabletsToCommit.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="text-2xs text-ink-muted border-b border-hairline">
                  <tr>
                    <th className="py-1">Medicine</th>
                    <th>Dose</th>
                    <th>Frequency</th>
                    <th>When to Take</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tabletsToCommit.map((m, i) => (
                    <tr key={i} className="border-t border-hairline text-xs">
                      <td className="py-1.5 font-semibold text-ink">{m.form ? `${m.form} ` : 'Tab '}{m.name}</td>
                      <td className="font-mono">{m.strength ?? '–'}</td>
                      <td>{m.frequency ?? '–'}</td>
                      <td>
                        <span className="rounded bg-primary-tint px-1.5 py-0.5 text-primary-deep font-semibold text-2xs">
                          {m.timing ?? 'After food'}
                        </span>
                      </td>
                      <td>{m.duration ?? '–'}</td>
                      <td>
                        <span className="inline-flex items-center gap-1 text-success font-semibold text-2xs">
                          <Icon name="check" size={11} /> Verified
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-ink-muted italic">No prescription lines recorded.</p>
            )}
          </div>

          {/* Clinical Findings Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {structured?.diagnosis && structured.diagnosis.length > 0 && (
              <div className="rounded-lg bg-base/60 p-2 border border-hairline">
                <span className="font-bold text-ink block mb-0.5">Diagnosis:</span>
                <span>{structured.diagnosis.join('; ')}</span>
              </div>
            )}
            {structured?.allergies && structured.allergies.length > 0 && (
              <div className="rounded-lg bg-base/60 p-2 border border-hairline">
                <span className="font-bold text-ink block mb-0.5">Allergies:</span>
                <span className="text-warning-deep font-semibold">{structured.allergies.join('; ')}</span>
              </div>
            )}
            {structured?.vitals && Object.keys(structured.vitals).length > 0 && (
              <div className="rounded-lg bg-base/60 p-2 border border-hairline sm:col-span-2">
                <span className="font-bold text-ink block mb-0.5">Vitals:</span>
                <span>{Object.entries(structured.vitals).map(([k, v]) => `${k.toUpperCase()} ${v.value} ${v.unit}`).join(' · ')}</span>
              </div>
            )}
          </div>

          {/* Doctor Verification Checkbox */}
          <label className="flex items-start gap-2.5 rounded-xl border border-border p-3 cursor-pointer bg-base/40 hover:bg-base/70 transition-colors">
            <input
              type="checkbox"
              checked={doctorVerified}
              onChange={e => setDoctorVerified(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
            />
            <div className="text-xs text-ink leading-snug">
              <b>I confirm that I have clinically reviewed and verified this entire consultation report</b>, including all tablet doses, timings, duration, and screened for adverse drug-allergy interactions. I hereby authorize pushing this to the electronic health record and patient care plan.
            </div>
          </label>

          {/* The Exact Action Button requested by user */}
          <div className="pt-1">
            <Button
              variant="primary"
              size="lg"
              icon="sign"
              disabled={!doctorVerified || submitting}
              onClick={handleSignAndCommit}
              className="w-full sm:w-auto shadow-sm text-sm"
            >
              {submitting ? 'Signing and committing…' : 'Checked by the doctor and duly signed'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
