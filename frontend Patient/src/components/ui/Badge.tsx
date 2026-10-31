import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, domains, radii, spacing, tones, touch, type Domain, type Tone } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { NeuPressable } from './Neu';
import { Speakable, type SpeechSource } from '../../speech/Speakable';

interface BadgeProps {
  label: string;
  tone?: Tone;
  domain?: Domain;
  icon?: IconName;
  /** Small status dot instead of an icon. */
  dot?: boolean;
  size?: 'sm' | 'md';
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Spoken on double tap (default: the label, cleaned up). */
  speech?: SpeechSource;
}

/**
 * Status pill: tone or domain tint fill with deep text (≥ 4.5:1) and a duotone icon.
 */
export const Badge: React.FC<BadgeProps> = ({
  label,
  tone = 'primary',
  domain,
  icon,
  dot = false,
  size = 'sm',
  solid = false,
  style,
  speech,
}) => {
  const d = domain ? domains[domain] : null;
  const c = tones[tone];
  const bg = d ? d.tint : c.bg;
  const textColor = d ? d.deep : colors[c.text];
  const iconColor = d ? d.deep : c.icon;
  const borderColor = d ? d.ring : c.ring;

  const isSm = size === 'sm';
  const pill = (
    <Speakable
      atomic
      speech={speech}
      accessibilityLabel={label}
      style={[
        styles.badge,
        isSm ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: bg, borderColor },
        !solid && style,
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: iconColor }]} />}
      {icon && <Icon name={icon} size={isSm ? 13 : 15} color={iconColor} active />}
      <AppText
        variant={isSm ? 'caption' : 'footnote'}
        weight={600}
        color={textColor as any}
        compact
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Speakable>
  );
  return solid ? <View style={[styles.solidBase, style]}>{pill}</View> : pill;
};

/** Neutral alias for Status pill */
export const StatusChip = Badge;

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  speech?: string;
}

/** Selectable chip: white card pill; selected = tonal ice fill + primary label + check. */
export const Chip: React.FC<ChipProps> = ({ label, selected, onPress, icon, style, speech }) => (
  <NeuPressable
    onPress={onPress}
    atomic
    speech={speech}
    selected={selected}
    radius={radii.md}
    compact
    haptics="selection"
    accessibilityRole="checkbox"
    accessibilityState={{ checked: selected }}
    accessibilityLabel={label}
    containerStyle={style}
    style={[styles.chip, selected && styles.chipSelected]}
  >
    {(down) => (
      <>
        {icon && <Icon name={icon} size={18} color={selected ? colors.primary : colors.inkMuted} active={selected} />}
        <AppText variant="subhead" weight={selected ? 700 : 500} color={selected ? 'primary' : 'ink'} compact>
          {label}
        </AppText>
        {selected && <Icon name="check" size={16} color={colors.primary} />}
      </>
    )}
  </NeuPressable>
);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    gap: spacing.xs,
    borderWidth: 1,
  },
  badgeSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  solidBase: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: colors.ice,
    borderColor: colors.primary,
  },
});
