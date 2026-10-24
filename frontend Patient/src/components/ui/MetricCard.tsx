import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing, tones, type Tone } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import { AppText } from './AppText';
import { IconTile } from './Card';
import { Icon, type IconName } from './Icon';

interface MetricCardProps {
  /** Uppercase eyebrow (e.g. "Next Appointment"). */
  label: string;
  /** Big number / value. */
  value: string;
  caption?: string;
  icon: IconName;
  tone?: Tone;
  /** `row` = Doctor queue metric (text left, tile right); `stacked` = tile on top for 2-up grids. */
  layout?: 'row' | 'stacked';
  /** Use a headline-size value instead of the 30pt metric number (for word values). */
  compact?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Mobile version of the Doctor queue's glanceable metric cards. */
export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  caption,
  icon,
  tone = 'blue',
  layout = 'row',
  compact = false,
  onPress,
  accessibilityHint,
  style,
}) => {
  const stacked = layout === 'stacked';
  const content = (
    <>
      {stacked && <IconTile icon={icon} tone={tone} />}
      <View style={styles.textCol}>
        <AppText variant="eyebrow" color="tertiary" numberOfLines={2} compact>
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
            {onPress && <Icon name="chevron-right" size={14} color={colors[tones[tone].text]} />}
          </View>
        ) : null}
      </View>
      {!stacked && <IconTile icon={icon} tone={tone} />}
    </>
  );

  if (!onPress) {
    return <View style={[styles.card, stacked ? styles.stacked : styles.row, style]}>{content}</View>;
  }
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={[label, value, caption].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.card, stacked ? styles.stacked : styles.row, pressed && styles.pressed, style]}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    ...shadows.sm,
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
  pressed: {
    backgroundColor: colors.cardMuted,
    transform: [{ scale: 0.98 }],
  },
});
