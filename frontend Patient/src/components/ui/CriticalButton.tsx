import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, critical, neu, radii, spacing } from '../../theme/tokens';
import { timing } from '../../theme/motion';
import { usePressScale } from '../../hooks/usePressScale';
import { haptic } from '../../utils/haptics';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { depth } from './Neu';

export type CriticalTone = keyof Pick<typeof critical, 'primary' | 'success' | 'danger'>;

interface CriticalButtonProps {
  /** primary = Join call · success = Approve consent · danger = Decline / SOS / End call. */
  tone: CriticalTone;
  label: string;
  icon: IconName;
  onPress: () => void;
  sublabel?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Full width by default; `false` sizes to content (call controls). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const MIN_HEIGHT = 56;
const RADIUS = radii.xl - 8;
const isAndroid = Platform.OS === 'android';

/**
 * Principle 3, "Consent is sacred": critical actions are soft and tactile but always the
 * highest-contrast element on screen. Raised neumorphic shape with a SOLID deep fill
 * (white label ≥ 4.5:1), highlight sheen, coloured glow; pressed = inset + darker fill +
 * heavy haptic; disabled = flat, low-contrast, no shadow.
 */
export const CriticalButton: React.FC<CriticalButtonProps> = ({
  tone,
  label,
  icon,
  onPress,
  sublabel,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  accessibilityHint,
}) => {
  const press = usePressScale(0.98);
  const down = useSharedValue(0);
  const inactive = disabled || loading;
  const c = critical[tone];

  useEffect(() => {
    if (inactive) down.set(0);
  }, [inactive, down]);

  const raisedStyle = useAnimatedStyle(() => ({ opacity: 1 - down.get() }));
  const insetStyle = useAnimatedStyle(() => ({ opacity: down.get() }));

  const glowShadow: ViewStyle = isAndroid
    ? { shadowColor: c.fill, elevation: 8 }
    : { shadowColor: c.fill, shadowOffset: { width: 6, height: 8 }, shadowOpacity: 0.45, shadowRadius: 12 };
  const lightShadow: ViewStyle = isAndroid
    ? {}
    : { shadowColor: neu.raised.strong.light.color, shadowOffset: { width: -6, height: -6 }, shadowOpacity: 0.9, shadowRadius: 7 };

  return (
    <Animated.View style={[press.style, fullWidth && styles.fullWidth, style]}>
      <Pressable
        onPress={() => {
          haptic.heavy();
          onPress();
        }}
        onPressIn={() => {
          press.onPressIn();
          down.set(withTiming(1, timing.press));
        }}
        onPressOut={() => {
          press.onPressOut();
          down.set(withTiming(0, timing.press));
        }}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: loading }}
        style={[depth.stack, styles.pressable]}
      >
        {({ pressed }) => (
          <>
            {inactive ? (
              <View style={[StyleSheet.absoluteFill, depth.layer, styles.shape, { backgroundColor: critical.disabledFill }]} />
            ) : (
              <>
                {/* Raised: coloured glow (dark side) + white light shadow + sheen */}
                <Animated.View style={[StyleSheet.absoluteFill, depth.layer, raisedStyle]} pointerEvents="none">
                  <View style={[StyleSheet.absoluteFill, styles.shape, { backgroundColor: c.fill }, glowShadow]}>
                    <View style={[StyleSheet.absoluteFill, styles.shape, { backgroundColor: c.fill }, lightShadow]}>
                      <View style={[StyleSheet.absoluteFill, styles.shape, styles.clip, styles.edge, { backgroundColor: c.fill }]}>
                        <LinearGradient colors={critical.sheen} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
                      </View>
                    </View>
                  </View>
                </Animated.View>
                {/* Inset: darker fill + inner shadow toward the top-left */}
                <Animated.View style={[StyleSheet.absoluteFill, depth.layer, insetStyle]} pointerEvents="none">
                  <View style={[StyleSheet.absoluteFill, styles.shape, styles.clip, { backgroundColor: c.pressed }]}>
                    <LinearGradient colors={critical.insetDark} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.stripTop} />
                    <LinearGradient colors={critical.insetDark} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.stripLeft} />
                  </View>
                </Animated.View>
              </>
            )}
            <View style={styles.content}>
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Icon name={icon} size={24} color={inactive ? colors.ink : colors.onPrimary} active={!pressed} />
                  <View style={styles.text}>
                    <AppText variant="callout" weight={700} color={inactive ? 'ink' : 'onPrimary'} numberOfLines={2} compact>
                      {label}
                    </AppText>
                    {sublabel ? (
                      <AppText variant="footnote" weight={500} color={inactive ? 'ink' : 'onPrimary'} numberOfLines={2} compact>
                        {sublabel}
                      </AppText>
                    ) : null}
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressable: {
    minHeight: MIN_HEIGHT,
    borderRadius: RADIUS,
    justifyContent: 'center',
  },
  shape: {
    borderRadius: RADIUS,
  },
  clip: {
    overflow: 'hidden',
  },
  edge: {
    borderWidth: 1,
    borderTopColor: critical.edgeLight,
    borderLeftColor: critical.edgeLight,
    borderBottomColor: colors.transparent,
    borderRightColor: colors.transparent,
  },
  stripTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 12 },
  stripLeft: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 12 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  text: {
    flexShrink: 1,
    alignItems: 'center',
  },
});
