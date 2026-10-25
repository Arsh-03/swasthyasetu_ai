import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../../theme/tokens';

/**
 * Ambient background: large, soft organic blobs (ice, primarySoft, sand) behind every
 * screen, so the glass has something to refract. Radial gradients fading to transparent
 * give the "blurred blob" look without a blur filter (cheap on Android), no raster, no
 * animation. Peak opacities match the worst case checked in contrastPairs.ts:
 * ice 0.70, primarySoft 0.16, sand 0.70 (primarySoft is capped so inkMuted canvas text stays ≥ 4.5:1).
 */
export const AMBIENT_PEAK = { ice: 0.7, primarySoft: 0.16, sand: 0.7 } as const;

const BLOB = 'M100 12c34 0 70 18 76 52s-14 66-46 78-72 8-96-12S6 82 18 54 66 12 100 12z';

const SHAPES = [
  { color: colors.ice, peak: AMBIENT_PEAK.ice, transform: 'translate(190 -60) scale(1.6 1.5) rotate(12 100 80)' },
  { color: colors.primarySoft, peak: AMBIENT_PEAK.primarySoft, transform: 'translate(-90 280) scale(1.7 1.8) rotate(-18 100 80)' },
  { color: colors.sand, peak: AMBIENT_PEAK.sand, transform: 'translate(170 560) scale(1.8 1.6) rotate(24 100 80)' },
  { color: colors.ice, peak: 0.5, transform: 'translate(-60 700) scale(1.2 1.1) rotate(-8 100 80)' },
] as const;

export const AmbientBackground: React.FC = () => {
  const id = useId().replace(/:/g, '');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice">
        <Defs>
          {SHAPES.map((s, i) => (
            <RadialGradient key={i} id={`${id}-g${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={s.color} stopOpacity={s.peak} />
              <Stop offset="0.6" stopColor={s.color} stopOpacity={s.peak * 0.55} />
              <Stop offset="1" stopColor={s.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {SHAPES.map((s, i) => (
          <Path key={i} d={BLOB} transform={s.transform} fill={`url(#${id}-g${i})`} />
        ))}
      </Svg>
    </View>
  );
};
