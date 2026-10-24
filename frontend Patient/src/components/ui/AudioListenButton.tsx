import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing, touch } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import { haptic } from '../../utils/haptics';
import { speak, stopSpeaking } from '../../utils/speech';
import { AppText } from './AppText';
import { Icon } from './Icon';

interface AudioListenButtonProps {
  /** Text to read aloud; a function is evaluated on press so it reflects current data. */
  text: string | (() => string);
  /** `pill` = inline badge, `card` = full-width player with title / subtitle. */
  variant?: 'pill' | 'card';
  label?: string;
  title?: string;
  playingTitle?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * High-contrast audio badge (accessibility rule): bg #ECFDF5, text/icon #047857,
 * at least 48×48. Required on cards with consent or diagnostic information.
 */
export const AudioListenButton: React.FC<AudioListenButtonProps> = ({
  text,
  variant = 'pill',
  label,
  title,
  playingTitle,
  subtitle,
  style,
}) => {
  const { lang, t } = useLanguage();
  const [playing, setPlaying] = useState(false);

  // Stop reading when the button unmounts (screen change, sheet closed)
  useEffect(() => () => stopSpeaking(), []);

  const toggle = () => {
    haptic.tap();
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    const started = speak(typeof text === 'function' ? text() : text, lang, () => setPlaying(false));
    setPlaying(started);
  };

  const a11yLabel = playing ? t('stop') : label ?? title ?? t('listen');

  if (variant === 'pill') {
    return (
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ selected: playing }}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed, style]}
      >
        <Icon name={playing ? 'stop' : 'volume-up'} size={20} color={colors.audioText} />
        <AppText variant="footnote" weight={600} color="audioText" compact numberOfLines={1}>
          {playing ? t('stop') : label ?? t('listen')}
        </AppText>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: playing }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      <View style={styles.playCircle}>
        <Icon name={playing ? 'pause' : 'play-arrow'} size={26} color={colors.onTint} />
      </View>
      <View style={styles.cardText}>
        <AppText variant="callout" color="audioText">
          {playing ? playingTitle ?? title : title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="audioText" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[12, 20, 16, 24].map((h, i) => (
          <View key={i} style={[styles.waveBar, { height: h }, playing && styles.waveBarActive]} />
        ))}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: touch.min,
    minWidth: touch.min,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.audioBg,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.15)',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.audioBg,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.15)',
    ...shadows.sm,
  },
  playCircle: {
    width: touch.min,
    height: touch.min,
    borderRadius: touch.min / 2,
    backgroundColor: colors.audioText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
  },
  subtitle: {
    opacity: 0.8,
  },
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(4, 120, 87, 0.25)',
  },
  waveBarActive: {
    backgroundColor: colors.audioText,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
