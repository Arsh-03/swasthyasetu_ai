import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, shadows, spacing } from '../../theme/tokens';
import { GlassSurface, type GlassMaterial } from './GlassSurface';

interface GlassCardProps {
  children: React.ReactNode;
  material?: GlassMaterial;
  radius?: number;
  /** Inner padding; defaults to 16 like the Doctor's p-4 cards. */
  padding?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * `.liquid-glass` card. The shadow lives on an outer view because the
 * glass surface has to clip (overflow hidden), which would cut the shadow off on iOS.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  material = 'card',
  radius = radii.lg,
  padding = spacing.lg,
  style,
  contentStyle,
}) => (
  <View style={[shadows.glass, { borderRadius: radius }, style]}>
    <GlassSurface material={material} style={[styles.surface, { borderRadius: radius, padding }, contentStyle]}>
      {children}
    </GlassSurface>
  </View>
);

const styles = StyleSheet.create({
  surface: {
    borderWidth: 1,
  },
});
