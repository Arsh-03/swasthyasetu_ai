import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGES, t as translate, type SupportedLanguage, type TranslationKey } from '../utils/translations';

const STORAGE_KEY = 'swasthyasetu.language';
const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

interface LanguageContextValue {
  lang: SupportedLanguage;
  /** True once the saved choice has been read from storage (or found missing). */
  hydrated: boolean;
  setLang: (lang: SupportedLanguage) => void;
  /** Language cycle order: en → kn → hi → en. */
  cycleLang: () => void;
  /** Applies the profile's preferred language only if the user explicitly chose one. */
  applyProfileLanguage: (lang: SupportedLanguage) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const isLanguage = (v: unknown): v is SupportedLanguage =>
  typeof v === 'string' && (LANGUAGES as string[]).includes(v);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (isLanguage(saved)) {
          setLangState(saved);
        }
      })
      .catch(() => {
        // Storage unavailable (private browsing etc.): keep the default
      })
      .finally(() => setHydrated(true));
  }, []);

  const setLang = useCallback((next: SupportedLanguage) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const cycleLang = useCallback(() => {
    setLang(lang === 'en' ? 'kn' : lang === 'kn' ? 'hi' : 'en');
  }, [lang, setLang]);

  const applyProfileLanguage = useCallback(
    (_profileLang: SupportedLanguage) => {
      // Default remains English on first load; only use saved language if explicitly chosen by user
    },
    []
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      hydrated,
      setLang,
      cycleLang,
      applyProfileLanguage,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, hydrated, setLang, cycleLang, applyProfileLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
};
