"""
Speech-to-text for consultation calls. Audio is processed in memory and never written to disk.

Providers (SCRIBE_ASR_PROVIDER):
  "auto"  Your own server (below) when it answers its health check, else the demo script. The choice is
          made once per call when AI is switched on, so a call never mixes real speech with demo lines.
  "stub"  A scripted demo consultation (Hindi / Kannada / English with English translations).
          No model needed: lets the whole minutes pipeline run on a laptop.
  "http"  Your own speech-to-text server exposing the common /v1/audio/transcriptions API
          (e.g. faster-whisper / speaches, whisper.cpp server, vLLM). Self-hosted only.
  ""      Off: recording can't be enabled.

Each speaker records their own microphone, so every chunk already belongs to one speaker:
no voice-based speaker separation is needed.
"""
import itertools
import re
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional

import httpx

from app.config import ai_headers, settings


@dataclass
class Segment:
    speaker: str                # "doctor" | "patient"
    start_ms: int
    end_ms: int
    text: str                   # as spoken (may be Hindi, Kannada, English or mixed)
    english: str                # English version used for analysis
    language: str = "en"

    def to_dict(self) -> Dict:
        return asdict(self)


class ASRError(Exception):
    pass


# Whisper subtitle / prompt hallucinations on noise/silence
_HALLUCINATION_PATTERNS = re.compile(
    r"(?i)\b(?:"
    r"thank\s+you\s+(?:for\s+watching|very\s+much\s+for\s+watching)|"
    r"thanks\s+for\s+watching|"
    r"please\s+subscribe|like\s+and\s+subscribe|don't\s+forget\s+to\s+subscribe|"
    r"subtitles\s+by|subtitled\s+by|amara\.org|translated\s+by|captions\s+by|"
    r"all\s+rights\s+reserved|see\s+you\s+(?:next\s+time|in\s+the\s+next\s+video)|"
    r"bye\s+bye|thank\s+you,\s+bye|goodbye|stay\s+tuned|"
    r"watching\s+this\s+video|for\s+more\s+videos|"
    r"thank\s+you\s+so\s+much\s+for\s+watching|"
    r"can\s+you\s+hear\s+me|am\s+i\s+audible|"
    r"mic\s+check|sound\s+check|audio\s+check|"
    r"testing\s+1\s+2|one\s+two\s+three|1\s+2\s+3|"
    r"hello\s+hello|"
    r"(?:shibhi|shibi|shaaba|shaba|chibi|chiba|शीबी|शाबा|शीवी|शवा)(?:\s+(?:shibhi|shibi|shaaba|shaba|chibi|chiba|शीबी|शाबा|शीवी|शवा))*|"
    r"o+h+(?:\s+o+h+)*|a+h+(?:\s+a+h+)*"
    r")\b"
)

# Common audio marker tags emitted by transcription engines
_AUDIO_TAGS = re.compile(
    r"(?i)^[\[\(\*](?:music|applause|laughter|coughing|throat\s+clearing|clears\s+throat|"
    r"sigh|cheering|silence|snort|groan|screaming|bell|gasp|whispering|inaudible)[\]\)\*]$"
)

# Scripts foreign to Indian consultations (Hangul, Japanese Kana, Cyrillic, Thai, Arabic, Urdu, Telugu, etc.)
# When Whisper hears background static/ambient noise without clear speech, it frequently
# defaults to foreign tokens (Urdu, Telugu, Korean, etc.).
_FOREIGN_HALLUCINATIONS = re.compile(
    r"[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF"  # Arabic, Urdu, Persian
    r"\u0C00-\u0C7F"                                            # Telugu
    r"\u0B80-\u0BFF"                                            # Tamil
    r"\u0980-\u09FF"                                            # Bengali
    r"\u0D00-\u0D7F"                                            # Malayalam
    r"\u0A80-\u0AFF"                                            # Gujarati
    r"\u0A00-\u0A7F"                                            # Gurmukhi
    r"\u0B00-\u0B7F"                                            # Odia
    r"\u4E00-\u9FFF"                                            # CJK Chinese
    r"\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F"                  # Hangul (Korean syllables & jamo)
    r"\u3040-\u30FF"                                            # Japanese Hiragana & Katakana
    r"\u0400-\u04FF"                                            # Cyrillic
    r"\u0E00-\u0E7F]"                                           # Thai
)

# UI reading artifacts (users reading the on-screen buttons aloud while testing)
UI_META_RE = re.compile(
    r"\b(?:it'?s\s+)?(?:whisper\s+server\s+online|auto-?write\s+notes?|chibi\s+test\s+lab|"
    r"start\s+test\s+consultation|finish\s+(?:and|&)\s+summarise|clinical\s+notepad)\b[,.]?\s*",
    re.I
)

# Repetitive hallucination loop: 4+ identical characters or 3+ repeated word loops
_REPEATED_CHARS = re.compile(r"(.)\1{3,}")
_REPEATED_WORDS = re.compile(r"(?i)\b(\w{1,8})\b(?:\s+\1\b){2,}")
_FILLERS_ANY = re.compile(r"(?i)(?<![\wऀ-෿])(?:u+h+m*|u+m+|h+m+|e+r+m*|a+h+|a{2,}|e{2,}|m{2,}|o{2,}|shibhi|shibi|shaaba|shaba|chibi|chiba|ಅಂ+|ಅಮ್|ಹ್ಮ್|अं+|अम्|हम्म)(?![\wऀ-෿])[,.]?\s*")
_STANDALONE_FILLERS = {
    "uh", "um", "ah", "mm", "hmm", "er", "oh", "eh", "huh", "umm", "uhh", "yeah", "ok", "okay",
    "yep", "nope", "alright", "right", "sure", "fine", "cool", "hello", "hi", "hey", "namaste",
    "bye", "goodbye", "thanks", "thank you", "welcome", "please", "sorry", "test", "testing",
    "ooh", "oooh", "aah", "aaah", "aahhh", "ahh", "ohh", "shibi", "shibhi", "shaaba", "shaba",
    "chibi", "chiba", "shibhi shibi", "shaaba shaaba", "शीबी शाबा", "लिखाओ शीवी शवा"
}

_STOP_WORDS = {
    "a", "an", "the", "and", "or", "so", "but", "to", "at", "it", "is", "in", "on", "of", "by", "if",
    "my", "me", "he", "we", "us", "be", "do", "as", "that", "this", "there", "just", "then", "now"
}

_VALID_SHORT_MEDICAL = {"bp", "hr", "tb", "mg", "iv", "im", "ecg", "dm", "htn", "cxr", "spo2"}


def clean_spoken_phrase(raw: str) -> str:
    """Strips audio bracket tags, UI meta-speech, fillers, and stutter duplicates."""
    if not raw:
        return ""
    s = raw.strip()
    s = re.sub(r"^[\[(][^\])]*[\])]\s*", "", s)
    s = re.sub(r"\s*[\[(][^\])]*[\])]$", "", s)
    s = UI_META_RE.sub(" ", s)
    s = _FILLERS_ANY.sub(" ", s)
    s = re.sub(r"\b(\w+)\s+\1\b", r"\1", s, flags=re.I)
    s = re.sub(r"\s+", " ", s).strip()
    if s:
        s = s[0].upper() + s[1:]
    return s


def is_noise_or_hallucination(text: str) -> bool:
    """Identify background noise, silence hallucinations, or non-clinical ASR artifacts."""
    if not text:
        return True
    s = text.strip()
    if not s or len(s) < 2:
        return True

    # Pure punctuation or symbols (e.g. "...", "???", "- - -", "♪♪♪")
    if not re.search(r"[\w\u0900-\u097F\u0C80-\u0CFF]", s):
        return True

    # Audio tags like [Music] or (coughing)
    if _AUDIO_TAGS.match(s) or "♪" in s or "♫" in s:
        return True

    # Known foreign script hallucinations on background static (e.g. Urdu, Telugu, Korean Hangul)
    if _FOREIGN_HALLUCINATIONS.search(s):
        return True

    # Video subtitle hallucinations from Whisper's YouTube training data
    if _HALLUCINATION_PATTERNS.search(s):
        return True

    # Long repetition loops: "띠띠띠띠", "ha ha ha ha", "la la la"
    if _REPEATED_CHARS.search(s):
        return True
    if _REPEATED_WORDS.search(s):
        return True

    return False


IRRELEVANT_PATTERNS = [
    # Greetings & salutations
    re.compile(r"^(?:hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|namaste|namaskara|pranam)\s*(?:doctor|patient|sir|ma'?am)?$", re.I),
    # Fluff addressed to doctor / patient
    re.compile(r"^(?:yes|yeah|yep|no|nope|ok|okay|sure|alright|right|thanks|thank\s+you|please|sorry)\s+(?:doctor|patient|sir|ma'?am)$", re.I),
    # Standalone fluff & acknowledgments
    re.compile(r"^(?:ok|okay|k|yeah|yes|yep|nope|no|alright|right|sure|fine|cool|got\s+it|i\s+see|i\s+understand|understood|i\s+know|you\s+know|i\s+think\s+so|maybe|probably|well|so\s+yeah|nothing|nothing\s+else|that'?s\s+(?:all|it)|no\s+problem|never\s+mind)$", re.I),
    # Call logistics & audio/mic tests
    re.compile(r"^(?:can\s+you\s+hear\s+me(?:\s+now)?|can\s+you\s+see\s+me|am\s+i\s+audible(?:\s+to\s+you)?|are\s+you\s+audible|i\s+can\s+hear\s+you(?:\s+clearly)?|i\s+can'?t\s+hear\s+you|voice\s+is\s+(?:breaking|cracking|low|not\s+clear)|screen\s+is\s+visible|network\s+(?:issue|problem)|call\s+disconnected|is\s+it\s+working|testing(?:\s+1\s+2\s+3)?|mic\s+check|sound\s+check|check\s+check|one\s+two\s+three|1\s+2\s+3|hello\s+hello|reconnect)$", re.I),
    # Conversational pauses & interruptions
    re.compile(r"^(?:wait\s+(?:a\s+minute|a\s+second|one\s+second|one\s+minute)|one\s+(?:second|minute)|just\s+a\s+(?:minute|second)|hold\s+on|give\s+me\s+a\s+moment|let\s+me\s+(?:see|check)|are\s+you\s+there)$", re.I),
    # Conversational questions / closings with no medical content
    re.compile(r"^(?:how\s+are\s+you(?:\s+doing)?|i\s+am\s+fine|what\s+did\s+you\s+say|what\s+happened|pardon(?:\s+me)?|repeat(?:\s+that)?|excuse\s+me|thank\s+you(?:\s+very\s+much)?|thanks(?:\s+a\s+lot)?|welcome|you'?re\s+welcome|bye|goodbye|see\s+you|take\s+care|have\s+a\s+(?:good|nice)\s+day)$", re.I),
    # Hindi / Hinglish fluff
    re.compile(r"^(?:theek\s+hai(?:\s+doctor)?|haan(?:\s+doctor)?|haanji(?:\s+doctor)?|nahi(?:\s+doctor)?|acha(?:\s+theek\s+hai)?|kuch\s+nahi|bas|samajh\s+gaya|samajh\s+gayi|kya\s+hua|kya\s+bola|ek\s+minute|ruko|suno|bolo|awaaz\s+aa\s+rahi\s+hai|awaaz\s+nahi\s+aa\s+rahi|dhanyawad|shukriya|namaste\s+doctor)$", re.I),
    # Kannada fluff
    re.compile(r"^(?:sari(?:\s+doctor)?|houdu(?:\s+doctor)?|illa(?:\s+doctor)?|beda|namaskara\s+doctor)$", re.I),
    # Room / background chatter
    re.compile(r"^(?:where\s+are\s+you(?:\s+going)?|who\s+is\s+that|what\s+are\s+you\s+doing|come\s+here|go\s+there|close\s+the\s+door|open\s+the\s+door|turn\s+(?:on|off)\s+the\s+(?:fan|light)|bring\s+water|food\s+is\s+ready|phone\s+is\s+ringing|shut\s+up|stop\s+it)$", re.I),
]

CLINICAL_KEYWORDS_RE = re.compile(
    r"\b(?:"
    r"fever|feverish|chills?|shivering|headache|pain|hurts?|aches?|sore|cough|cold|sneez\w*|phlegm|sputum|mucus|congestion|runny|"
    r"throat|vomit\w*|nausea|loose|motion|diarrh\w*|constipat\w*|stomach|abdom\w*|cramp\w*|gas|acidity|burning|chest|heart|"
    r"palpitat\w*|breath\w*|dyspnea|wheez\w*|asthma|dizzy|dizziness|vertigo|faint\w*|weak\w*|fatigue|tired|lethargy|rash\w*|"
    r"itch\w*|allerg\w*|swell\w*|edema|inflam\w*|redness|bleed\w*|blood|cut|wound|injury|bruise|fracture|sprain|infect\w*|"
    r"viral|bacterial|typhoid|malaria|dengue|jaundice|covid|flu|diabet\w*|sugar|hypertens\w*|bp|pressure|cholesterol|thyroid|"
    r"arthrit\w*|joint|knee|back|spine|neck|shoulder|leg|arm|foot|hand|skin|eye|ear|nose|mouth|tooth|teeth|tongue|stiff\w*|"
    r"numb\w*|tingl\w*|seiz\w*|stroke|lump|ulcer|stone|calculus|appetite|sleep|insomnia|sweat\w*|weight|urin\w*|stool|pus|"
    r"bukhar|jwar|sar\s+dard|sir\s+dard|dard|khansi|sardi|zukaam|gala|gale|ulti|dast|pet|chhati|saans|chakkar|kamzori|thakan|"
    r"sujan|khujli|jalan|khoon|ghav|chot|pathri|gathiya|peeliya|bhookh|neend|peshab|thand|kaapna|pasina|dava|dawa|goli|"
    r"tablet\w*|capsule\w*|syrup\w*|drops?|ointment\w*|cream|spray\w*|inhaler\w*|inject\w*|vaccin\w*|dose|dosage|mg|ml|"
    r"paracetamol|dolo|crocin|calpol|combiflam|ibuprofen|aspirin|pantocid|pan\-d|omez|rabeprazole|antacid|azithromycin|amoxicillin|"
    r"augmentin|ciprofloxacin|levofloxacin|antibiotic\w*|cetirizine|allegra|montair|ascoril|benadryl|metformin|glimepiride|insulin|"
    r"telmisartan|amlodipine|atenolol|atorvastatin|rosuvastatin|thyronorm|eltroxin|vitamin\w*|calcium|iron|ors|saline|nebuliz\w*|bandage|"
    r"prescrib\w*|prescription|diagnos\w*|treatment|temperature|temp|degrees?|fahrenheit|celsius|pulse|spo2|saturation|fasting|"
    r"hba1c|xray|x\-ray|scan|ultrasound|ecg|ekg|cbc|blood\s+test|urine\s+test|report\w*|follow\s+up|review|doctor|patient|"
    r"take\s+this|after\s+food|before\s+food|empty\s+stomach|twice|thrice|daily|days?|weeks?|months?|years?"
    r")\b",
    re.I
)


def is_meaningful_speech(text: str) -> bool:
    """Check if transcribed line has actual speech content beyond ambient noise or bare grunts."""
    return is_clinically_relevant(text)


def is_clinically_relevant(text: str) -> bool:
    """Check if speech has genuine clinical relevance.

    Noise cancellation & clinical gate: Non-clinical chatter, room hiss hallucinations,
    UI reading, and random garbled mutterings are REJECTED by default unless they contain
    verified clinical terminology (symptoms, medications, vitals, exam, duration).
    """
    if not text:
        return False
    s = text.strip()
    if len(s) < 2 or is_noise_or_hallucination(s):
        return False

    # Strip UI reading metadata first
    s = UI_META_RE.sub(" ", s).strip()
    if not s or len(s) < 2:
        return False

    normalized = re.sub(r"^[^\w\u0900-\u097F\u0C80-\u0CFF]+|[^\w\u0900-\u097F\u0C80-\u0CFF]+$", "", s.lower()).strip()
    for pat in IRRELEVANT_PATTERNS:
        if pat.search(normalized):
            return False

    words = [w for w in normalized.split() if w]
    # Standalone clinical abbreviations (e.g. "BP", "ECG", "mg")
    if len(words) == 1 and words[0] in _VALID_SHORT_MEDICAL:
        return True

    # MANDATORY CLINICAL GATE:
    # If the line contains NO clinical keywords (symptoms, drugs, vitals, durations, advice),
    # it is noise / nonsense / irrelevant muttering. Reject it!
    if not CLINICAL_KEYWORDS_RE.search(s):
        return False

    # If all words are stop words, reject
    if all(w in _STOP_WORDS for w in words):
        return False

    return True


# A realistic demo consultation (fever / URTI), with code-mixed patient speech and an identifier
# the de-identifier must remove. Each audio chunk from a speaker yields their next line.
DEMO_SCRIPT = {
    "doctor": [
        ("Namaste Ramesh ji, tell me what problem you are facing today?", None, "en"),
        ("Since when do you have the fever? Does it come with chills?", None, "en"),
        ("Are you allergic to any medicine?", None, "en"),
        ("Are you taking any medicines regularly?", None, "en"),
        ("Take paracetamol 650 if the fever is above 100, drink plenty of fluids, and come back after 3 days if you are not better.",
         None, "en"),
    ],
    "patient": [
        ("Doctor, mujhe teen din se bukhar hai, gale mein dard hai aur khansi bhi hai.",
         "Doctor, I have had fever for three days, a sore throat and also a cough.", "hi"),
        ("Raat ko bukhar zyada ho jaata hai, aur sar dard bhi hai.",
         "The fever gets worse at night, and I also have a headache.", "hi"),
        ("Haan doctor, penicillin se mujhe rashes aate hain.",
         "Yes doctor, I get rashes from penicillin.", "hi"),
        ("Sugar ki goli leta hoon, metformin, roz subah. Mere pitaji ko bhi sugar thi.",
         "I take a sugar tablet, metformin, every morning. My father also had sugar.", "hi"),
        ("ಮೈ ಕೈ ನೋವು ಕೂಡ ಇದೆ. ನನ್ನ ನಂಬರ್ 98450 12345.",
         "I also have body ache. My number is 98450 12345.", "kn"),
        # A danger sign, so the demo also shows the live assistant's safety alert.
        ("Aur kabhi kabhi seedhi chadhte waqt chest pain hota hai.",
         "And sometimes I get chest pain when I climb stairs.", "hi"),
    ],
}


class StubASR:
    name = "stub"

    def __init__(self):
        self._cursor: Dict[str, Dict[str, itertools.count]] = {}

    async def transcribe(self, session_id: str, speaker: str, audio: bytes, mime: str, offset_ms: int,
                         duration_ms: int) -> List[Segment]:
        counters = self._cursor.setdefault(session_id, {})
        n = next(counters.setdefault(speaker, itertools.count()))
        lines = DEMO_SCRIPT.get(speaker, [])
        if n >= len(lines):
            return []
        text, english, lang = lines[n]
        return [Segment(speaker, offset_ms, offset_ms + duration_ms, text, english or text, lang)]

    def forget(self, session_id: str) -> None:
        self._cursor.pop(session_id, None)

    async def health(self) -> bool:
        return True


class HttpASR:
    """Self-hosted server with the common /v1/audio/transcriptions (+ /translations) API."""
    name = "http"

    def __init__(self, base_url: str, model: str, language: str, translate: bool, timeout_s: float):
        self._base = base_url.rstrip("/")
        self._model = model
        self._language = language
        self._translate = translate
        self._client = httpx.AsyncClient(timeout=timeout_s, headers=ai_headers())

    async def _post(self, path: str, audio: bytes, mime: str, extra: Dict[str, str]) -> Dict:
        files = {"file": (f"chunk.{'webm' if 'webm' in mime else 'ogg'}", audio, mime)}
        # temperature 0.0 forces deterministic decoding; condition_on_previous_text=False stops hallucination snowballing
        # clinical prompt biases Whisper model toward consultation vocabulary and eliminates YouTube subtitle hallucinations
        data = {
            "model": self._model,
            "response_format": "verbose_json",
            "temperature": "0.0",
            "condition_on_previous_text": "false",
            "prompt": "Doctor and patient consultation in India discussing medical symptoms, fever, pain, illness, medications, and advice.",
            **extra,
        }
        try:
            res = await self._client.post(f"{self._base}{path}", files=files, data=data)
            res.raise_for_status()
            return res.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ASRError(f"speech-to-text server error: {type(exc).__name__}") from exc

    async def transcribe(self, session_id: str, speaker: str, audio: bytes, mime: str, offset_ms: int,
                         duration_ms: int) -> List[Segment]:
        extra = {"language": self._language} if self._language else {}
        result = await self._post("/v1/audio/transcriptions", audio, mime, extra)

        # Inspect verbose_json segments for low confidence or silence/repetition
        segments_data = result.get("segments")
        if isinstance(segments_data, list) and segments_data:
            clean_parts = []
            for s in segments_data:
                no_speech = float(s.get("no_speech_prob", 0.0) or 0.0)
                avg_logprob = float(s.get("avg_logprob", 0.0) or 0.0)
                comp_ratio = float(s.get("compression_ratio", 0.0) or 0.0)
                t = (s.get("text") or "").strip()
                # Tightened thresholds for noise cancellation: reject quiet hiss/fan static
                if no_speech > 0.40 or avg_logprob < -0.80 or comp_ratio > 2.2:
                    continue
                t_clean = clean_spoken_phrase(t)
                if t_clean and not is_noise_or_hallucination(t_clean) and is_clinically_relevant(t_clean):
                    clean_parts.append(t_clean)
            text = clean_spoken_phrase(" ".join(clean_parts).strip())
        else:
            text = clean_spoken_phrase((result.get("text") or "").strip())

        if not text or is_noise_or_hallucination(text) or not is_clinically_relevant(text):
            return []

        language = (result.get("language") or self._language or "").lower()[:2] or "en"
        # Permitted consultation languages: English, Hindi, Kannada
        allowed_languages = {"en", "hi", "kn"}
        if self._language:
            allowed_languages.add(self._language[:2].lower())
        # If Whisper detects foreign languages from room static (e.g. ur, te, ar, cy, fa, ko, ja, zh, ru, th), drop it
        if language not in allowed_languages:
            return []

        english = text
        if self._translate and language != "en":
            tr = ((await self._post("/v1/audio/translations", audio, mime, {})).get("text") or text).strip()
            tr_clean = clean_spoken_phrase(tr)
            if tr_clean and not is_noise_or_hallucination(tr_clean) and is_clinically_relevant(tr_clean):
                english = tr_clean

        return [Segment(speaker, offset_ms, offset_ms + duration_ms, text, english, language)]

    def forget(self, session_id: str) -> None:
        return None

    async def health(self) -> bool:
        """Is the speech-to-text server reachable? (Any HTTP answer counts, except a tunnel's "offline" page.)"""
        try:
            res = await self._client.get(f"{self._base}/health", timeout=6.0)
        except httpx.HTTPError:
            return False
        return res.status_code < 500 and "ngrok-error-code" not in res.headers


class AutoASR:
    """Live speech-to-text (your Whisper server) when it is online; otherwise the demo conversation."""
    name = "auto"

    def __init__(self, live: Optional[HttpASR]):
        self._live = live
        self._demo = StubASR()
        self._mode: Dict[str, str] = {}

    async def choose(self, session_id: str) -> str:
        """'live' or 'demo' for this call (decided once, when AI is switched on)."""
        mode = "live" if self._live is not None and await self._live.health() else "demo"
        self._mode[session_id] = mode
        return mode

    def mode_of(self, session_id: str) -> str:
        return self._mode.get(session_id, "demo")

    async def transcribe(self, session_id: str, speaker: str, audio: bytes, mime: str, offset_ms: int,
                         duration_ms: int) -> List[Segment]:
        engine = self._live if self.mode_of(session_id) == "live" and self._live is not None else self._demo
        return await engine.transcribe(session_id, speaker, audio, mime, offset_ms, duration_ms)

    def forget(self, session_id: str) -> None:
        self._mode.pop(session_id, None)
        self._demo.forget(session_id)

    async def health(self) -> bool:
        return True  # demo mode is always available


def _build() -> Optional[object]:
    kind = settings.SCRIBE_ASR_PROVIDER
    if kind == "auto":
        live = None
        if settings.SCRIBE_ASR_URL:
            live = HttpASR(settings.SCRIBE_ASR_URL, settings.SCRIBE_ASR_MODEL, settings.SCRIBE_ASR_LANGUAGE,
                           settings.SCRIBE_ASR_TRANSLATE, settings.SCRIBE_ASR_TIMEOUT_S)
        return AutoASR(live)
    if kind == "stub":
        return StubASR()
    if kind == "http" and settings.SCRIBE_ASR_URL:
        return HttpASR(settings.SCRIBE_ASR_URL, settings.SCRIBE_ASR_MODEL, settings.SCRIBE_ASR_LANGUAGE,
                       settings.SCRIBE_ASR_TRANSLATE, settings.SCRIBE_ASR_TIMEOUT_S)
    return None


asr = _build()
# Always available: the scripted demo conversation (practice runs in the doctor portal).
demo_asr = StubASR()


def asr_info() -> Dict[str, object]:
    return {"enabled": asr is not None, "provider": getattr(asr, "name", None)}
