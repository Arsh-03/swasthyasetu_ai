import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../../theme/tokens';
import { SurfaceContext } from '../ui/SurfaceContext';
import { useBlurTarget } from './BlurTarget';

/**
 * Subtle glass surface (design_system_tokens.md).
 * Top bar, docked tab bar, and sheets only: light blur, fill ~0.8, hairline border.
 * Specular and inner highlight effects have been removed.
 */
export const GLASS = {
  card: { intensity: 40, fill: colors.glass, solid: colors.card },
  toolbar: { intensity: 50, fill: colors.glassToolbar, solid: colors.card },
  tabBar: { intensity: 50, fill: colors.glassTabBar, solid: colors.card },
  sheet: { intensity: 60, fill: colors.glassSheet, solid: colors.card },
  night: { intensity: 60, fill: colors.glassNight, solid: colors.night },
} as const;

export type GlassMaterial = keyof typeof GLASS;

const androidCanBlur = Platform.OS === 'android' && Number(Platform.Version) >= 31;

interface GlassSurfaceProps extends ViewProps {
  material?: GlassMaterial;
  /** Blur the app content behind this surface. */
  blurContent?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  material = 'card',
  blurContent = false,
  style,
  children,
  ...rest
}) => {
  const target = useBlurTarget();
  const m = GLASS[material];
  const isNight = material === 'night';
  const tint = isNight ? 'dark' : 'light';

  let blur: React.ReactNode = null;
  if (Platform.OS === 'ios' || Platform.OS === 'web') {
    blur = <BlurView intensity={m.intensity} tint={tint} style={StyleSheet.absoluteFill} />;
  } else if (androidCanBlur && blurContent && target) {
    blur = (
      <BlurView
        intensity={m.intensity}
        tint={tint}
        blurTarget={target}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
    );
  }

  return (
    <SurfaceContext.Provider value={isNight ? 'opaque' : 'glass'}>
      <View style={[styles.base, isNight ? styles.edgeNight : styles.edge, style]} {...rest}>
        {blur}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: blur ? m.fill : m.solid }]} />
        {children}
      </View>
    </SurfaceContext.Provider>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    backgroundColor: colors.transparent,
    borderWidth: 1,
  },
  edge: {
    borderColor: colors.cardBorder,
  },
  edgeNight: {
    borderColor: colors.glassNightBorder,
  },
});
