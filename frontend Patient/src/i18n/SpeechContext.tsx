import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useLanguage } from './LanguageContext';
import { speak, stopSpeaking } from '../utils/speech';
import { formatSpokenText } from '../utils/speechTranslation';
import { haptic } from '../utils/haptics';

interface SpeechContextValue {
  speakingId: string | null;
  isSpeaking: boolean;
  speakElement: (id: string, textOrFn: string | (() => string)) => void;
  stopSpeech: () => void;
}

const SpeechContext = createContext<SpeechContextValue | null>(null);

export const SpeechProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang } = useLanguage();
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const stopSpeech = useCallback(() => {
    stopSpeaking();
    setSpeakingId(null);
    setIsSpeaking(false);
  }, []);

  // Stop speech if patient switches active screen language
  useEffect(() => {
    stopSpeech();
  }, [lang, stopSpeech]);

  const speakElement = useCallback(
    (id: string, textOrFn: string | (() => string)) => {
      // If already speaking this element, tap to stop
      if (speakingId === id) {
        stopSpeech();
        haptic.tap();
        return;
      }

      haptic.tap();
      stopSpeaking();

      const raw = typeof textOrFn === 'function' ? textOrFn() : textOrFn;
      if (!raw || !raw.trim()) return;

      const formatted = formatSpokenText(raw, lang);
      setSpeakingId(id);
      setIsSpeaking(true);

      const started = speak(formatted, lang, () => {
        setSpeakingId(null);
        setIsSpeaking(false);
      });

      if (!started) {
        setSpeakingId(null);
        setIsSpeaking(false);
      }
    },
    [lang, speakingId, stopSpeech]
  );

  const value = useMemo(
    () => ({
      speakingId,
      isSpeaking,
      speakElement,
      stopSpeech,
    }),
    [speakingId, isSpeaking, speakElement, stopSpeech]
  );

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
};

export const useSpeech = (): SpeechContextValue => {
  const ctx = useContext(SpeechContext);
  if (!ctx) {
    return {
      speakingId: null,
      isSpeaking: false,
      speakElement: () => {},
      stopSpeech: () => {},
    };
  }
  return ctx;
};
