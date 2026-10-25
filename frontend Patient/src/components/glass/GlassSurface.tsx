import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, glassHighlight } from '../../theme/tokens';
import { SurfaceContext } from '../ui/SurfaceContext';
import { depth } from '../ui/Neu';
import { useBlurTarget } from './BlurTarget';

/**
 * Liquid-glass materials (design_system_tokens.md § 6).
 * `fill` sits on top of the blur; `solid` is used where blur is unavailable (Android < 12,
 * glass not over the blur target). Fills were checked so ink text stays ≥ 4.5:1 over the
 * ambient blobs (see contrastPairs.ts).
 */
export const GLASS = {
  card: { intensity: 90, fill: colors.glass, solid: colors.card },
  toolbar: { intensity: 95, fill: colors.glassToolbar, solid: colors.base },
  tabBar: { intensity: 95, fill: colors.glassTabBar, solid: colors.base },
  sheet: { intensity: 100, fill: colors.glassSheet, solid: colors.card },
  night: { intensity: 80, fill: colors.glassNight, solid: colors.night },
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
 * Blur + translucent fill + 1px specular edge (bright top-left, faint bottom-right) + an
 * inner top highlight. Children render above the material. Pass borderRadius in `style`;
 * the surface clips (BlurView ignores borderRadius on native).
 * A true gradient border would need a mask (MaskedView); per-side edge colours give the
 * same top-left → bottom-right falloff without a new native dependency.
 */
export const GlassSurface: React.FC<GlassSurfaceProps> = ({ material = 'card', blurContent = false, style, children, ...rest }) => {
  const target = useBlurTarget();
  const m = GLASS[material];
  const isNight = material === 'night';
  const tint = isNight ? 'dark' : 'light';

  let blur: React.ReactNode = null;
  if (Platform.OS === 'ios' || Platform.OS === 'web') {
    blur = <BlurView intensity={m.intensity} tint={tint} style={[StyleSheet.absoluteFill, depth.layer]} />;
  } else if (androidCanBlur && blurContent && target) {
    blur = (
      <BlurView
        intensity={m.intensity}
        tint={tint}
        blurTarget={target}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={[StyleSheet.absoluteFill, depth.layer]}
      />
    );
  }

  return (
    <SurfaceContext.Provider value={isNight ? 'opaque' : 'glass'}>
      <View style={[depth.stack, styles.base, isNight ? styles.edgeNight : styles.edge, style]} {...rest}>
        {blur}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, depth.layer, { backgroundColor: blur ? m.fill : m.solid }]} />
        {!isNight && (
          <LinearGradient pointerEvents="none" colors={glassHighlight} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.highlight, depth.layer]} />
        )}
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
    borderTopColor: colors.specularHi,
    borderLeftColor: colors.specularHi,
    borderBottomColor: colors.specularLo,
    borderRightColor: colors.specularLo,
  },
  edgeNight: {
    borderColor: colors.glassNightBorder,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
  },
});
