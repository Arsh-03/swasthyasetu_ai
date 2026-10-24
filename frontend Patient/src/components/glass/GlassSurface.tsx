import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../../theme/tokens';
import { useBlurTarget } from './BlurTarget';

/**
 * The four liquid-glass materials from the Doctor portal's index.html.
 * `fill` sits on top of the blur, `solid` is used where blur is unavailable.
 */
export const GLASS = {
  card: { intensity: 60, fill: colors.glass, solid: 'rgba(255, 255, 255, 0.96)', border: colors.glassBorder },
  toolbar: { intensity: 75, fill: colors.glassToolbar, solid: 'rgba(248, 248, 250, 0.97)', border: colors.separator },
  sheet: { intensity: 80, fill: colors.glassSheet, solid: '#FFFFFF', border: colors.glassSheetBorder },
  dark: { intensity: 70, fill: colors.glassDark, solid: 'rgba(28, 28, 30, 0.94)', border: colors.glassDarkBorder },
} as const;

export type GlassMaterial = keyof typeof GLASS;

// Android blur is only efficient (RenderNode) on API 31+; older devices get the solid fill.
const androidCanBlur = Platform.OS === 'android' && Number(Platform.Version) >= 31;

interface GlassSurfaceProps extends ViewProps {
  material?: GlassMaterial;
  /** Blur the app content behind this surface (toolbar / tab bar). Needs a BlurTargetProvider on Android. */
  blurContent?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Blur + translucent fill + hairline border. Children render above the material.
 * Rounded corners: pass borderRadius in style; the surface clips with overflow hidden
 * because BlurView ignores borderRadius on native.
 */
export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  material = 'card',
  blurContent = false,
  style,
  children,
  ...rest
}) => {
  const target = useBlurTarget();
  const m = GLASS[material];
  const tint = material === 'dark' ? 'dark' : 'light';

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
    <View style={[styles.base, { borderColor: m.border }, style]} {...rest}>
      {blur}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: blur ? m.fill : m.solid }]} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
