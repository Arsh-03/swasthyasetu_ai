import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, tints, touch } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import { haptic } from '../../utils/haptics';
import { NeuPressable } from './Neu';
import { speakFor, stopSpeech, useSpeechSelector } from '../../speech/store';
import { cleanForSpeech } from '../../speech/format';
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
  /** What a double tap on the button itself says (default: its label). */
  speech?: string | (() => string);
}

/**
 * Listen button: reads `text` with the same engine as double tap (pass the same script the
 * card uses, so both always say the same thing). High-contrast audio badge (accessibility rule, unchanged from V1): colors.audioBg /
 * colors.audioText, at least 48×48. Required on cards with consent or diagnostic information.
 */
export const AudioListenButton: React.FC<AudioListenButtonProps> = ({
  text,
  variant = 'pill',
  label,
  title,
  playingTitle,
  subtitle,
  style,
  speech,
}) => {
  const { lang, t } = useLanguage();
  // Same engine and state as double tap: one reading at a time, stops on screen change
  const id = useId();
  const playing = useSpeechSelector((s) => s.speakingId === id);

  const toggle = () => {
    haptic.tap();
    if (playing) {
      stopSpeech();
      return;
    }
    speakFor(id, cleanForSpeech(typeof text === 'function' ? text() : text, lang));
  };

  const a11yLabel = playing ? t('stop') : label ?? title ?? t('listen');

  if (variant === 'pill') {
    return (
      <NeuPressable
        onPress={toggle}
        atomic
        speech={speech}
        haptics="none"
        selected={playing}
        fill={colors.audioBg}
        radius={touch.min / 2}
        accessibilityLabel={a11yLabel}
        containerStyle={[styles.pillWrap, style]}
        style={styles.pill}
      >
        <Icon name={playing ? 'stop' : 'listen'} size={20} color={colors.audioText} active />
        <AppText variant="footnote" weight={600} color="audioText" compact numberOfLines={1}>
          {playing ? t('stop') : label ?? t('listen')}
        </AppText>
      </NeuPressable>
    );
  }

  return (
    <NeuPressable
      onPress={toggle}
      atomic
      speech={speech}
      haptics="none"
      selected={playing}
      fill={colors.audioBg}
      radius={radii.lg}
      accessibilityLabel={a11yLabel}
      containerStyle={style}
      style={styles.card}
    >
      <View style={styles.playCircle}>
        <Icon name={playing ? 'pause' : 'play'} size={26} color={colors.onPrimary} />
      </View>
      <View style={styles.cardText}>
        <AppText variant="callout" color="audioText">
          {playing ? playingTitle ?? title : title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="audioText">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[12, 20, 16, 24].map((h, i) => (
          <View key={i} style={[styles.waveBar, { height: h }, playing && styles.waveBarActive]} />
        ))}
      </View>
    </NeuPressable>
  );
};

const styles = StyleSheet.create({
  pillWrap: {
    alignSelf: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: touch.min,
    minWidth: touch.min,
    paddingHorizontal: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    padding: spacing.lg,
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
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: tints.audioWave,
  },
  waveBarActive: {
    backgroundColor: colors.audioText,
  },
});
