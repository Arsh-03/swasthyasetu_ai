import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { triggerBirthdayPopper } from '../../utils/confetti';
import { playBirthdayPopperSound } from '../../utils/soundEffects';

interface ParticleDef {
  originXFrac: number; // 0 = left, 1 = right
  targetXFrac: number;
  apexYFrac: number;   // height fraction at apex (0.1 to 0.4)
  color: string;
  width: number;
  height: number;
  borderRadius: number;
  rotDeg: number;
}

const COLORS = [
  '#EF4444', // Crimson
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Royal Blue
  '#8B5CF6', // Purple
  '#EC4899', // Hot Pink
  '#FBBF24', // Gold
];

// 40 deterministic full-screen confetti streamers and ribbons
const PARTICLES: ParticleDef[] = Array.from({ length: 40 }).map((_, i) => {
  const isLeft = i % 2 === 0;
  const isCenter = i >= 32;

  let originXFrac = isLeft ? 0.05 : 0.95;
  let targetXFrac = isLeft ? 0.3 + (i % 5) * 0.12 : 0.15 + (i % 5) * 0.12;
  let apexYFrac = 0.12 + (i % 6) * 0.04;

  if (isCenter) {
    originXFrac = 0.3 + (i % 4) * 0.15;
    targetXFrac = 0.2 + (i % 5) * 0.15;
    apexYFrac = 0.05 + (i % 3) * 0.05;
  }

  const shapeType = i % 3;
  const width = shapeType === 0 ? 10 : shapeType === 1 ? 8 : 12;
  const height = shapeType === 0 ? 20 : shapeType === 1 ? 8 : 16;
  const borderRadius = shapeType === 1 ? 4 : 2;

  return {
    originXFrac,
    targetXFrac,
    apexYFrac,
    color: COLORS[i % COLORS.length],
    width,
    height,
    borderRadius,
    rotDeg: 180 + (i * 47) % 360,
  };
});

interface FullScreenBirthdayPopperProps {
  active: boolean;
  onComplete?: () => void;
  message?: string;
  subMessage?: string;
}

/**
 * Full-Screen Birthday Party Popper Explosion:
 * - Covers 100% of the mobile viewport.
 * - Fires dual birthday confetti cannons from bottom-left and bottom-right corners.
 * - Confetti ribbons and streamers shoot up to the screen top and flutter all the way down.
 * - Bounces a festive celebration card in the center with guaranteed audio and haptics.
 */
export const FullScreenBirthdayPopper: React.FC<FullScreenBirthdayPopperProps> = ({
  active,
  onComplete,
  message = '🎉 Medicine Taken! 🥳',
  subMessage = 'Great job keeping on schedule!',
}) => {
  const [anim] = useState(() => new Animated.Value(0));
  const [badgeScale] = useState(() => new Animated.Value(0));
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  useEffect(() => {
    if (!active) {
      anim.setValue(0);
      badgeScale.setValue(0);
      return;
    }

    // 1. Play sound effect & trigger haptics
    playBirthdayPopperSound();

    // 2. Trigger web dual-cannon confetti if canvas is available
    triggerBirthdayPopper(0.5, 0.7);

    // 3. Reset and run full-screen animation sequence
    anim.setValue(0);
    badgeScale.setValue(0);

    // Badge spring bounce in
    Animated.sequence([
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 4,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.delay(1800),
      Animated.timing(badgeScale, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    // Confetti flight and gravity flutter
    Animated.timing(anim, {
      toValue: 1,
      duration: 2500,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && onComplete) {
        onComplete();
      }
    });
  }, [active, anim, badgeScale, onComplete]);

  if (!active) return null;

  const confettiOpacity = anim.interpolate({
    inputRange: [0, 0.1, 0.75, 1],
    outputRange: [0, 1, 0.95, 0],
  });

  return (
    <View
      style={[
        styles.fullScreenOverlay,
        {
          width: screenWidth,
          height: screenHeight,
        },
      ]}
      pointerEvents="none"
    >
      {/* 40 Full-Screen Confetti Streamers and Ribbons */}
      {PARTICLES.map((p, idx) => {
        const startX = p.originXFrac * screenWidth;
        const targetX = p.targetXFrac * screenWidth;
        const startY = screenHeight - 40;
        const apexY = p.apexYFrac * screenHeight;
        const endY = screenHeight + 60;

        // Path: Cannon shot up to apex (0 -> 0.35), then gentle float down with gravity (0.35 -> 1)
        const translateX = anim.interpolate({
          inputRange: [0, 0.35, 0.65, 1],
          outputRange: [
            startX,
            targetX,
            targetX + ((idx % 2 === 0 ? 1 : -1) * 24),
            targetX + ((idx % 2 === 0 ? -1 : 1) * 36),
          ],
        });

        const translateY = anim.interpolate({
          inputRange: [0, 0.32, 1],
          outputRange: [startY, apexY, endY],
        });

        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.rotDeg * 4}deg`],
        });

        const scale = anim.interpolate({
          inputRange: [0, 0.2, 0.8, 1],
          outputRange: [0.3, 1.25, 1.0, 0.4],
        });

        return (
          <Animated.View
            key={idx}
            style={[
              styles.confettiPiece,
              {
                width: p.width,
                height: p.height,
                borderRadius: p.borderRadius,
                backgroundColor: p.color,
                opacity: confettiOpacity,
                transform: [{ translateX }, { translateY }, { rotate }, { scale }],
              },
            ]}
          />
        );
      })}

      {/* Floating Center Celebration Modal / Toast */}
      <View style={styles.centerWrap}>
        <Animated.View
          style={[
            styles.celebrationModal,
            {
              transform: [{ scale: badgeScale }],
              opacity: badgeScale.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [0, 1, 1],
              }),
            },
          ]}
        >
          <View style={styles.iconCircle}>
            <Icon name="checkCircle" size={32} color={colors.successDeep} active />
          </View>
          <AppText variant="title2" weight={700} color="ink" align="center">
            {message}
          </AppText>
          <AppText variant="footnote" color="inkMuted" align="center">
            {subMessage}
          </AppText>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenOverlay: {
    position: (Platform.OS === 'web' ? ('fixed' as any) : 'absolute'),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    overflow: 'hidden',
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  centerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  celebrationModal: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: '#34D399',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
    maxWidth: 340,
    width: '100%',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
