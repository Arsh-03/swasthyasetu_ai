import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, neu, radii, spacing, tones, touch, type Tone } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { NeuPressable } from './Neu';

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: IconName;
  /** Small status dot instead of an icon. */
  dot?: boolean;
  size?: 'sm' | 'md';
  /**
   * Opaque base under the tint. Required when the badge sits directly on the ambient
   * background: the translucent tint over a blob drops text below 4.5:1.
   */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Status pill (informational → soft inset): tone tint fill, debossed two-tone edge,
 * deep text (≥ 4.5:1) and a duotone icon. Gold is reserved for "verified".
 */
export const Badge: React.FC<BadgeProps> = ({ label, tone = 'primary', icon, dot = false, size = 'sm', solid = false, style }) => {
  const c = tones[tone];
  const isSm = size === 'sm';
  const pill = (
    <View style={[styles.badge, isSm ? styles.badgeSm : styles.badgeMd, { backgroundColor: c.bg }, !solid && style]}>
      {dot && <View style={[styles.dot, { backgroundColor: c.icon }]} />}
      {icon && <Icon name={icon} size={isSm ? 14 : 16} color={c.icon} active />}
      <AppText variant={isSm ? 'caption' : 'footnote'} weight={600} color={c.text} compact numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
  return solid ? <View style={[styles.solidBase, style]}>{pill}</View> : pill;
};

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

/** Selectable chip: raised control; selected = latched inset + primary label + check (never colour alone). */
export const Chip: React.FC<ChipProps> = ({ label, selected, onPress, icon, style }) => (
  <NeuPressable
    onPress={onPress}
    selected={selected}
    radius={radii.md}
    compact
    haptics="selection"
    accessibilityRole="checkbox"
    accessibilityState={{ checked: selected }}
    accessibilityLabel={label}
    containerStyle={style}
    style={styles.chip}
  >
    {(down) => (
      <>
        {icon && <Icon name={icon} size={20} color={down ? colors.primary : colors.inkMuted} active={down} />}
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
    borderTopColor: neu.inset.soft.edgeDark,
    borderLeftColor: neu.inset.soft.edgeDark,
    borderBottomColor: neu.inset.soft.edgeLight,
    borderRightColor: neu.inset.soft.edgeLight,
  },
  badgeSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  solidBase: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.base,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: touch.compact,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
