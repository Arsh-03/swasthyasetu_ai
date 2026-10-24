import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing, tones, type Tone } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';

/** `bg-white rounded-2xl p-4 shadow-apple-sm border border-black/5`: the Doctor's default card. */
export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }> = ({
  children,
  style,
  padded = true,
}) => <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;

/** `bg-[#F2F2F7] rounded-2xl p-3.5 border border-black/5`: inset panel inside a card. */
export const Well: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <View style={[styles.well, style]}>{children}</View>
);

/** Hairline row divider; `inset` aligns it with the text column of a ListRow. */
export const Divider: React.FC<{ inset?: number }> = ({ inset = 0 }) => (
  <View style={[styles.divider, { marginLeft: inset }]} />
);

/** `w-11 h-11 rounded-2xl bg-[tone]/10 ring-1 ring-[tone]/20`: tinted icon tile. */
export const IconTile: React.FC<{ icon: IconName; tone?: Tone; size?: number }> = ({ icon, tone = 'blue', size = 44 }) => {
  const c = tones[tone];
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.36, backgroundColor: c.bg, borderColor: c.ring },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.54)} color={c.fg} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.sm,
  },
  padded: {
    padding: spacing.lg,
  },
  well: {
    backgroundColor: colors.gray6,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
