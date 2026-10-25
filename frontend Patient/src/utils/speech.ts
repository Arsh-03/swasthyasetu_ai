import type { SupportedLanguage } from './translations';

const VOICE_LANG: Record<SupportedLanguage, string> = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' };

const synth = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

/** Read text aloud with the browser's speech engine (web only). Returns false when unavailable. */
export const speak = (text: string, lang: SupportedLanguage, onEnd?: () => void): boolean => {
  const s = synth();
  if (!s) return false;
  s.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = VOICE_LANG[lang];
  utterance.rate = 0.85;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  s.speak(utterance);
  return true;
};

export const stopSpeaking = () => synth()?.cancel();
