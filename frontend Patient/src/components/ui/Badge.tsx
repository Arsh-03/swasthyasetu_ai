import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, tints, tones, touch, type Tone } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: IconName;
  /** Small status dot instead of an icon (queue urgency style). */
  dot?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

/** Rounded-full status pill: `px-2 py-0.5 rounded-full bg-[tone]/15 text-[tone] font-semibold`. */
export const Badge: React.FC<BadgeProps> = ({ label, tone = 'blue', icon, dot = false, size = 'sm', style }) => {
  const c = tones[tone];
  const isSm = size === 'sm';
  return (
    <View style={[styles.badge, isSm ? styles.badgeSm : styles.badgeMd, { backgroundColor: c.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: c.fg }]} />}
      {icon && <Icon name={icon} size={isSm ? 13 : 15} color={colors[c.text]} />}
      <AppText variant={isSm ? 'caption' : 'footnote'} weight={600} color={c.text} compact numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
};

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

/** Selectable chip (symptoms, filters). 44pt tall, blue tint + check when selected. */
export const Chip: React.FC<ChipProps> = ({ label, selected, onPress, icon, style }) => (
  <Pressable
    onPress={() => {
      haptic.selection();
      onPress();
    }}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: selected }}
    accessibilityLabel={label}
    style={({ pressed }) => [
      styles.chip,
      selected ? styles.chipSelected : styles.chipIdle,
      pressed && styles.chipPressed,
      style,
    ]}
  >
    {icon && <Icon name={icon} size={18} color={selected ? colors.blue : colors.secondary} />}
    <AppText variant="subhead" weight={selected ? 600 : 500} color={selected ? 'blue' : 'label'} compact>
      {label}
    </AppText>
    {selected && <Icon name="check" size={16} color={colors.blue} />}
  </Pressable>
);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    gap: spacing.xs,
  },
  badgeSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: touch.compact,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  chipIdle: {
    backgroundColor: colors.gray6,
    borderColor: colors.hairline,
  },
  chipSelected: {
    backgroundColor: tints.blue,
    borderColor: colors.blue,
  },
  chipPressed: {
    transform: [{ scale: 0.97 }],
  },
});
