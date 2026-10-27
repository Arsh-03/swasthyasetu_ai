import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { useDoubleTapHint } from '../i18n/SpeechContext';
import { GlassSheet } from '../components/glass';
import { AppText } from '../components/ui/AppText';
import { EmbossedIcon } from '../components/ui/IconDisc';
import { PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { useScripts } from './scripts';
import { speakFor, stopSpeech, useSpeechSelector, gestureActive } from './store';

const HINT_ID = 'first-run-hint';

/**
 * One-time hint on first launch: "Double tap anything to hear it", shown with a speaker icon
 * and read aloud. Remembered on the device; the Settings toggle on Home turns the feature off.
 */
export const DoubleTapHint: React.FC = () => {
  const { visible, dismiss } = useDoubleTapHint();
  const scripts = useScripts();
  const active = useSpeechSelector(gestureActive);
  const show = visible && active;

  useEffect(() => {
    if (!show) return;
    // Brief transition grace period (120ms) for modal mount before reading out
    const timer = setTimeout(() => speakFor(HINT_ID, scripts.hint.spoken), 120);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const close = () => {
    stopSpeech();
    dismiss();
  };

  return (
    <GlassSheet visible={show} onClose={close} closeOnBackdrop placement="center">
      <View style={styles.body}>
        <EmbossedIcon icon="listen" size={52} color={colors.primary} />
        <AppText variant="title2" weight={700} align="center" accessibilityRole="header" speech={scripts.hint.spoken}>
          {scripts.hint.title}
        </AppText>
        <AppText variant="body" color="inkMuted" align="center" speech={scripts.hint.spoken}>
          {scripts.hint.body}
        </AppText>
        <View style={styles.buttons}>
          <SecondaryButton label={scripts.hint.replay} icon="listen" onPress={() => speakFor(HINT_ID, scripts.hint.spoken)} />
          <PrimaryButton label={scripts.hint.gotIt} onPress={close} />
        </View>
      </View>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
