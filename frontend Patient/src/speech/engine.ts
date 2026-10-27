import * as ExpoSpeech from 'expo-speech';
import type { SupportedLanguage } from '../utils/translations';
import { normalizeForSpeech } from './format';

/**
 * The one text-to-speech engine for the patient app (double tap, Listen buttons, the first-run hint).
 *  - One utterance at a time: every speak() stops the previous one first.
 *  - Picks a voice for the app language (kn / hi / en, Indian locale preferred).
 *  - If the device has voices but none for that language, nothing is spoken and the caller
 *    gets 'no-voice' so the app can say so, instead of reading Kannada with an English voice.
 */

const LOCALE: Record<SupportedLanguage, string> = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' };

/** Slightly slower than normal for first-time and elderly listeners. */
export const SPEECH_RATE = 0.88;

export type SpeakResult = 'ok' | 'no-voice' | 'empty' | 'failed';

interface VoiceInfo {
  identifier: string;
  language: string;
}

let voices: VoiceInfo[] | null = null;
let voicesLoading: Promise<void> | null = null;

/** Load the device's voice list once (call early; on the web the list fills in asynchronously). */
export const preloadVoices = (): Promise<void> => {
  if (voices) return Promise.resolve();
  if (!voicesLoading) {
    voicesLoading = ExpoSpeech.getAvailableVoicesAsync()
      .then((list) => {
        voices = list.map((v) => ({ identifier: v.identifier, language: (v.language || '').replace('_', '-').toLowerCase() }));
      })
      .catch(() => {
        voices = [];
      })
      .finally(() => {
        voicesLoading = null;
      });
  }
  return voicesLoading;
};

/**
 * Voice to use for a language:
 *  - { voice } = a matching voice (Indian locale first, then any voice of that language)
 *  - {} = voice list unknown or empty (some Android engines report none): let the engine pick by locale
 *  - null = the device lists voices, but none for this language
 */
const pickVoice = (lang: SupportedLanguage): { voice?: string } | null => {
  if (!voices || voices.length === 0) return {};
  const locale = LOCALE[lang].toLowerCase();
  const exact = voices.find((v) => v.language === locale);
  if (exact) return { voice: exact.identifier };
  const sameLanguage = voices.find((v) => v.language.split('-')[0] === lang);
  if (sameLanguage) return { voice: sameLanguage.identifier };
  return null;
};

/** Is a voice for this language available? Unknown voice lists count as available. */
export const hasVoiceFor = (lang: SupportedLanguage) => pickVoice(lang) !== null;

// Each utterance gets a token; callbacks from an older (stopped) utterance are ignored.
let currentToken = 0;
let isSpeaking = false;

const webSynth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

export interface SpeakOptions {
  onDone?: () => void;
}

/** Speak `text` in the app language. Stops anything already speaking. */
export const speak = (text: string, lang: SupportedLanguage, { onDone }: SpeakOptions = {}): SpeakResult => {
  const clean = text?.replace(/\s+/g, ' ').trim();
  if (!clean) return 'empty';

  const normalized = normalizeForSpeech(clean, lang);
  if (!normalized) return 'empty';

  // Only tear down the audio session if something is actually speaking
  if (isSpeaking || webSynth()?.speaking) {
    stop();
  }

  const choice = pickVoice(lang);
  if (choice === null) return 'no-voice';

  const token = ++currentToken;
  isSpeaking = true;

  const finish = () => {
    isSpeaking = false;
    if (token !== currentToken) return;
    currentToken++;
    onDone?.();
  };

  try {
    ExpoSpeech.speak(normalized, {
      language: LOCALE[lang],
      rate: SPEECH_RATE,
      ...(choice.voice ? { voice: choice.voice } : null),
      onDone: finish,
      onStopped: finish,
      onError: finish,
    });
    return 'ok';
  } catch {
    // Last resort on the web: the browser's own synthesiser
    const synth = webSynth();
    if (!synth) {
      finish();
      return 'failed';
    }
    try {
      const u = new SpeechSynthesisUtterance(normalized);
      u.lang = LOCALE[lang];
      u.rate = SPEECH_RATE;
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
      return 'ok';
    } catch {
      finish();
      return 'failed';
    }
  }
};

/** Stop whatever is being spoken (no callbacks fire for the stopped utterance). */
export const stop = () => {
  currentToken++;
  const synth = webSynth();
  if (!isSpeaking && !synth?.speaking) return;
  isSpeaking = false;

  try {
    ExpoSpeech.stop();
  } catch {
    // not available
  }
  try {
    synth?.cancel();
  } catch {
    // not available
  }
};

// Warm up voice list and native TTS engine immediately on import
void preloadVoices();
