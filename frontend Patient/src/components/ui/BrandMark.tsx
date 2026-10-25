import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brandGradient, colors, shadows, tints } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface BrandMarkProps {
  size?: number;
  icon?: IconName;
  /** Dev hook (style guide). Not announced to screen readers. */
  onLongPress?: () => void;
}

/** Brand tile: primary → ink gradient with a soft white ring. */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 36, icon = 'brand', onLongPress }) => {
  const mark = (
    <LinearGradient
      colors={brandGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.mark, shadows.sm, { width: size, height: size, borderRadius: size * 0.33 }]}
    >
      <Icon name={icon} size={Math.round(size * 0.56)} color={colors.onPrimary} active />
    </LinearGradient>
  );
  if (!onLongPress) return mark;
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={600} accessible={false}>
      {mark}
    </Pressable>
  );
};

/** Monogram avatar on the brand gradient. */
export const Avatar: React.FC<{ initials: string; size?: number }> = ({ initials, size = 28 }) => (
  <LinearGradient
    colors={brandGradient}
    start={{ x: 0, y: 1 }}
    end={{ x: 1, y: 0 }}
    style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]}
  >
    <AppText
      variant="caption"
      weight={600}
      color="onPrimary"
      lang="en"
      compact
      style={{ fontSize: Math.round(size * 0.4), lineHeight: Math.round(size * 0.5) }}
    >
      {initials}
    </AppText>
  </LinearGradient>
);

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tints.whiteStrong,
  },
});
