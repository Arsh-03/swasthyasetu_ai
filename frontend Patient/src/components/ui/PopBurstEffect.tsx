import React, { useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { triggerBirthdayPopper } from '../../utils/confetti';

interface ConfettiParticle {
  angle: number;
  distance: number;
  color: string;
  width: number;
  height: number;
  borderRadius: number;
  rotDeg: number;
}

/**
 * 12 vibrant birthday party popper confetti pieces:
 * streamers, fluttering rectangular ribbons, and festive stars.
 */
const PARTICLES: ConfettiParticle[] = [
  // Upward party popper cone burst
  { angle: -Math.PI / 2, distance: 54, color: '#EF4444', width: 8, height: 13, borderRadius: 2, rotDeg: 45 },
  { angle: -Math.PI * 0.65, distance: 50, color: '#F59E0B', width: 7, height: 7, borderRadius: 3.5, rotDeg: 30 },
  { angle: -Math.PI * 0.35, distance: 52, color: '#10B981', width: 8, height: 14, borderRadius: 2, rotDeg: 60 },
  { angle: -Math.PI * 0.82, distance: 46, color: '#06B6D4', width: 7, height: 12, borderRadius: 2, rotDeg: 15 },
  { angle: -Math.PI * 0.18, distance: 48, color: '#EC4899', width: 8, height: 8, borderRadius: 4, rotDeg: 90 },
  { angle: -Math.PI, distance: 40, color: '#8B5CF6', width: 9, height: 13, borderRadius: 2, rotDeg: 75 },
  { angle: 0, distance: 40, color: '#FBBF24', width: 7, height: 14, borderRadius: 2, rotDeg: 25 },
  // Surrounding radial scatter
  { angle: Math.PI * 0.2, distance: 36, color: '#3B82F6', width: 7, height: 7, borderRadius: 3.5, rotDeg: 110 },
  { angle: Math.PI * 0.8, distance: 38, color: '#10B981', width: 8, height: 11, borderRadius: 2, rotDeg: 40 },
  { angle: Math.PI * 0.38, distance: 34, color: '#EF4444', width: 8, height: 8, borderRadius: 4, rotDeg: 80 },
  { angle: Math.PI * 0.62, distance: 35, color: '#F59E0B', width: 7, height: 12, borderRadius: 2, rotDeg: 55 },
  { angle: Math.PI / 2, distance: 32, color: '#EC4899', width: 8, height: 12, borderRadius: 2, rotDeg: 70 },
];

interface PopBurstEffectProps {
  active: boolean;
  onComplete?: () => void;
  triggerScreenConfetti?: boolean;
}

/**
 * Birthday Popper Confetti Explosion:
 * 1. Fires full-screen multi-color confetti cannons (streamers & confetti rain).
 * 2. Launches localized tumbling ribbons and particles with 3D rotation.
 */
export const PopBurstEffect: React.FC<PopBurstEffectProps> = ({
  active,
  onComplete,
  triggerScreenConfetti = true,
}) => {
  const [anim] = React.useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) {
      anim.setValue(0);
      return;
    }

    if (triggerScreenConfetti) {
      triggerBirthdayPopper();
    }

    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && onComplete) {
        onComplete();
      }
    });
  }, [active, anim, onComplete, triggerScreenConfetti]);

  if (!active) return null;

  const opacity = anim.interpolate({
    inputRange: [0, 0.15, 0.75, 1],
    outputRange: [0, 1, 0.9, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.center}>
        {PARTICLES.map((p, index) => {
          const translateX = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.cos(p.angle) * p.distance],
          });
          const translateY = anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, Math.sin(p.angle) * p.distance * 1.2, Math.sin(p.angle) * p.distance + 8],
          });
          const scale = anim.interpolate({
            inputRange: [0, 0.25, 0.8, 1],
            outputRange: [0.1, 1.35, 1.0, 0.2],
          });
          const rotate = anim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${p.rotDeg * 4}deg`],
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.particle,
                {
                  width: p.width,
                  height: p.height,
                  borderRadius: p.borderRadius,
                  backgroundColor: p.color,
                  opacity,
                  transform: [{ translateX }, { translateY }, { scale }, { rotate }],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

export const BirthdayPopperEffect = PopBurstEffect;

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
  },
});
