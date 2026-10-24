import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brandGradient, colors, shadows } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface BrandMarkProps {
  size?: number;
  icon?: IconName;
}

/** `rounded-xl bg-gradient-to-br from-[#007AFF] to-[#5856D6] ring-1 ring-white/30` brand tile. */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 36, icon = 'health-and-safety' }) => (
  <LinearGradient
    colors={brandGradient}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={[styles.mark, shadows.sm, { width: size, height: size, borderRadius: size * 0.33 }]}
  >
    <Icon name={icon} size={Math.round(size * 0.55)} color={colors.onTint} />
  </LinearGradient>
);

/** Monogram avatar: `rounded-full bg-gradient-to-tr from-[#007AFF] to-[#5856D6]`. */
export const Avatar: React.FC<{ initials: string; size?: number }> = ({ initials, size = 28 }) => (
  <LinearGradient
    colors={brandGradient}
    start={{ x: 0, y: 1 }}
    end={{ x: 1, y: 0 }}
    style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]}
  >
    <AppText variant="caption" weight={600} color="onTint" lang="en" compact style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }}>
      {initials}
    </AppText>
  </LinearGradient>
);

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});
