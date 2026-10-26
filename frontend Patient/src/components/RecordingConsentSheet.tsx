import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { GlassSheet } from './glass';
import { AppText, CriticalButton, SegmentedControl, SheetHeader } from './ui';
import { CONSENT_TEXT } from '../services/call/consentText';
import type { CallLanguage } from '../services/call/callTypes';

interface RecordingConsentSheetProps {
  visible: boolean;
  doctorName: string;
  /** Starts in the app's language; the patient can switch. */
  language: CallLanguage;
  onRespond: (accepted: boolean) => void;
}

const LANGUAGE_OPTIONS: { value: CallLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'kn', label: 'ಕನ್ನಡ' },
];

/**
 * Asked during a call when the doctor switches on "Quick AI minutes". Explains exactly what is recorded,
 * how, why, that personal details are removed before AI (anonymous), and that the patient can say no or stop.
 * Non-dismissible: the patient must choose.
 */
export const RecordingConsentSheet: React.FC<RecordingConsentSheetProps> = ({ visible, doctorName, language, onRespond }) => {
  const [lang, setLang] = useState<CallLanguage>(language);
  const copy = CONSENT_TEXT[lang];

  return (
    <GlassSheet visible={visible}>
      <SheetHeader icon="shieldCheck" title={copy.heading} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <SegmentedControl options={LANGUAGE_OPTIONS} value={lang} onChange={setLang} accessibilityLabel="Language" />
        <AppText variant="headline" color="ink">
          {copy.title(doctorName)}
        </AppText>
        <View style={styles.points}>
          {copy.points.map((p) => (
            <AppText key={p.label} variant="footnote" color="inkMuted">
              <AppText variant="footnote" weight={700} color="ink">
                {p.label}:{' '}
              </AppText>
              {p.text}
            </AppText>
          ))}
        </View>
        <View style={styles.actions}>
          <CriticalButton tone="danger" label={copy.deny} icon="close" onPress={() => onRespond(false)} fullWidth={false} style={styles.deny} />
          <CriticalButton tone="success" label={copy.allow} icon="mic" onPress={() => onRespond(true)} fullWidth={false} style={styles.allow} />
        </View>
      </ScrollView>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexShrink: 1,
  },
  body: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  points: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  deny: {
    flex: 1,
  },
  allow: {
    flex: 1.5,
  },
});
