import React from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, tones, typography, type Tone } from '../../theme/tokens';
import { scriptFontSize, scriptLineHeight, splitScriptRuns } from '../../theme/scripts';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { IconDisc } from './IconDisc';
import { NeuPanel, NeuPressable } from './Neu';

interface MetricCardProps {
  /** Uppercase eyebrow (e.g. "Next Appointment"). */
  label: string;
  /** Big number / value. */
  value: string;
  caption?: string;
  icon: IconName;
  tone?: Tone;
  /** `row` = text left, disc right; `stacked` = disc on top for 2-up grids. */
  layout?: 'row' | 'stacked';
  /** Use a headline-size value instead of the 32pt serif metric (for word values). */
  compact?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
  /**
   * Quick-action grids (stacked + tappable only): the card grows to its row's tallest sibling,
   * the disc stays at the top and the label gets a fixed two-line area, so values line up.
   */
  equalHeight?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Same cap AppText uses for Dynamic Type / Android font scale
const MAX_FONT_SCALE = 1.6;

/**
 * Glanceable metric. Read-only = soft raised panel with an INSET disc (informational).
 * Tappable (quick action) = soft raised panel that presses to inset, with a RAISED disc.
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  caption,
  icon,
  tone = 'primary',
  layout = 'row',
  compact = false,
  onPress,
  accessibilityHint,
  equalHeight = false,
  style,
}) => {
  const { lang } = useLanguage();
  const { fontScale } = useWindowDimensions();
  const stacked = layout === 'stacked';
  const fixedLabel = equalHeight && stacked && !!onPress;
  // Two lines of the eyebrow at the label's tallest script, as AppText sets it (compact)
  const labelLine = Math.max(
    ...splitScriptRuns(label, lang).map((r) => scriptLineHeight(scriptFontSize(typography.eyebrow.fontSize, r.script, 'eyebrow'), r.script, true)),
  );
  const labelBox = fixedLabel ? { minHeight: Math.ceil(labelLine * 2 * Math.min(Math.max(fontScale, 1), MAX_FONT_SCALE)) } : null;
  const disc = <IconDisc icon={icon} tone={tone} size={46} variant={onPress ? 'raised' : 'inset'} shape="square" />;
  const content = (
    <>
      {stacked && disc}
      <View style={styles.textCol}>
        <AppText variant="eyebrow" color="inkMuted" numberOfLines={2} compact style={labelBox}>
          {label}
        </AppText>
        <AppText variant={compact ? 'headline' : 'metric'} numberOfLines={2} style={styles.value}>
          {value}
        </AppText>
        {caption ? (
          <View style={styles.captionRow}>
            <AppText variant="caption" weight={500} color={tones[tone].text} numberOfLines={2} style={styles.caption}>
              {caption}
            </AppText>
            {onPress && <Icon name="chevronRight" size={14} color={colors[tones[tone].text]} />}
          </View>
        ) : null}
      </View>
      {!stacked && disc}
    </>
  );

  const layoutStyle = stacked ? styles.stacked : styles.row;
  if (!onPress) {
    return <NeuPanel style={[layoutStyle, style]}>{content}</NeuPanel>;
  }
  return (
    <NeuPressable
      onPress={onPress}
      strength="soft"
      radius={radii.lg}
      accessibilityLabel={[label, value, caption].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      fillHeight={fixedLabel}
      containerStyle={style}
      style={[styles.pad, layoutStyle]}
    >
      {content}
    </NeuPressable>
  );
};

const styles = StyleSheet.create({
  pad: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stacked: {
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
  },
  value: {
    marginTop: 2,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  caption: {
    flexShrink: 1,
  },
});
