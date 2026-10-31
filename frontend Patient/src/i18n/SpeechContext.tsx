import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from './LanguageContext';
import { preloadVoices } from '../speech/engine';
import { getSpeechState, setSpeechState, speakFor, stopSpeech, useSpeechSelector } from '../speech/store';
import { colors, radii, spacing } from '../theme/tokens';
import { LANGUAGE_NAMES, t as translate } from '../utils/translations';
import { AppText } from '../components/ui/AppText';

const ENABLED_KEY = 'swasthyasetu.doubleTapSpeech';
const HINT_KEY = 'swasthyasetu.doubleTapHintSeen';

/**
 * Wires "double tap to hear" into the app: keeps the speech language in step with the app
 * language, remembers the Settings toggle, turns the gesture off while a screen reader runs
 * (its own double tap activates), and shows a short notice when a language has no voice.
 */
export const SpeechProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang } = useLanguage();

  useEffect(() => {
    // Don't keep reading in the old language
    stopSpeech();
    setSpeechState({ lang });
  }, [lang]);

  useEffect(() => {
    void preloadVoices();
    AsyncStorage.getItem(ENABLED_KEY)
      .then((v) => {
        if (v === 'off') setSpeechState({ enabled: false });
      })
      .catch(() => undefined);

    // TalkBack / VoiceOver use double tap to activate, so the gesture steps aside for them.
    // Web: react-native-web always answers "on" (it cannot tell), and browser screen readers
    // don't use double click, so the check is phones only.
    if (Platform.OS === 'web') return () => stopSpeech();
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => setSpeechState({ screenReader: !!on }))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on: boolean) => setSpeechState({ screenReader: !!on }));
    return () => {
      sub?.remove?.();
      stopSpeech();
    };
  }, []);

  return (
    <>
      {children}
      <SpeechNotice />
    </>
  );
};

/** "Kannada voice is not installed on this phone" — shown briefly when a language has no voice. */
const SpeechNotice: React.FC = () => {
  const notice = useSpeechSelector((s) => s.notice);
  if (!notice) return null;
  const text = translate(notice.lang, 'voiceMissing', { language: LANGUAGE_NAMES[notice.lang] });
  return (
    <View pointerEvents="none" style={styles.noticeWrap} accessibilityLiveRegion="polite">
      <View style={styles.notice}>
        <AppText variant="subhead" weight={600} color="onPrimary" align="center" speakable={false}>
          {text}
        </AppText>
      </View>
    </View>
  );
};

export interface SpeechControls {
  speakingId: string | null;
  isSpeaking: boolean;
  /** Read `text` for element `id` (same id again = stop). */
  speakElement: (id: string, textOrFn: string | (() => string)) => void;
  stopSpeech: () => void;
  /** Settings toggle for "double tap to hear". */
  enabled: boolean;
  setEnabled: (on: boolean) => void;
}

export const setDoubleTapEnabled = (on: boolean) => {
  if (!on) stopSpeech();
  setSpeechState({ enabled: on });
  AsyncStorage.setItem(ENABLED_KEY, on ? 'on' : 'off').catch(() => undefined);
};

export const useSpeech = (): SpeechControls => {
  const speakingId = useSpeechSelector((s) => s.speakingId);
  const enabled = useSpeechSelector((s) => s.enabled);
  const speakElement = useCallback((id: string, textOrFn: string | (() => string)) => {
    speakFor(id, typeof textOrFn === 'function' ? textOrFn() : textOrFn);
  }, []);
  return { speakingId, isSpeaking: speakingId !== null, speakElement, stopSpeech, enabled, setEnabled: setDoubleTapEnabled };
};

/** First-run hint state: shown once, remembered on the device. */
export const useDoubleTapHint = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(HINT_KEY)
      .then((v) => {
        if (v !== 'seen' && !getSpeechState().screenReader) setVisible(true);
      })
      .catch(() => undefined);
  }, []);
  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(HINT_KEY, 'seen').catch(() => undefined);
  }, []);
  return { visible, dismiss };
};

const styles = StyleSheet.create({
  noticeWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: 96,
    alignItems: 'center',
    zIndex: 200,
  },
  notice: {
    backgroundColor: colors.ink,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxWidth: 420,
  },
});
