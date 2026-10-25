import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadAsync } from 'expo-font';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES, type SupportedLanguage } from '../utils/translations';
import { FONT_SETS } from './fonts';

type LoadState = Record<SupportedLanguage, boolean>;

const FontsContext = createContext<LoadState>({ en: false, kn: false, hi: false });

/** Whether a language's fonts are ready; AppText falls back to the system font until they are. */
export const useFontsLoaded = () => useContext(FontsContext);

/**
 * Loads the active language's fonts first (rendering waits for them, or for a
 * failure, which falls back to system fonts), then the other languages in the background.
 */
export const FontsProvider: React.FC<{ children: React.ReactNode; fallback: React.ReactNode }> = ({ children, fallback }) => {
  const { lang, hydrated } = useLanguage();
  const [loaded, setLoaded] = useState<LoadState>({ en: false, kn: false, hi: false });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const load = (l: SupportedLanguage) =>
      loadAsync(FONT_SETS[l])
        .then(() => {
          if (!cancelled) setLoaded((prev) => ({ ...prev, [l]: true }));
        })
        .catch(() => {
          // Keep system fonts for this script
        });

    load(lang).finally(() => {
      if (cancelled) return;
      setReady(true);
      LANGUAGES.filter((l) => l !== lang).forEach(load);
    });
    return () => {
      cancelled = true;
    };
    // Only the first hydrated language decides load order; later switches use the background loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return <FontsContext.Provider value={loaded}>{ready ? children : fallback}</FontsContext.Provider>;
};
