import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, elevation, tints, touch } from '../../theme/tokens';
import { usePressScale } from '../../hooks/usePressScale';
import { haptic } from '../../utils/haptics';
import { Icon, type IconName } from './Icon';
import { Speakable, type SpeechSource } from '../../speech/Speakable';

export type IconButtonTone = 'neutral' | 'danger' | 'night' | 'nightOff';

interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only buttons must be named for screen readers. */
  accessibilityLabel: string;
  onPress: () => void;
  tone?: IconButtonTone;
  /** Visual diameter; the hit area is padded out to at least 48. */
  size?: number;
  iconSize?: number;
  haptics?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Spoken on double tap (default: the accessibility label). */
  speech?: SpeechSource;
}

const NIGHT = {
  night: { bg: tints.white, pressedBg: tints.whiteStrong, border: colors.glassNightBorder },
  nightOff: { bg: tints.dangerOnNight, pressedBg: colors.dangerPressed, border: tints.dangerRing },
} as const;

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  accessibilityLabel,
  onPress,
  tone = 'neutral',
  size = 38,
  iconSize,
  haptics = false,
  selected = false,
  style,
  speech,
}) => {
  const press = usePressScale(0.95);
  const slop = Math.max(0, (touch.min - size) / 2);
  const glyph = iconSize ?? Math.round(size * 0.52);

  if (tone === 'neutral' || tone === 'danger') {
    const isDanger = tone === 'danger';
    return (
      <Animated.View style={[press.style, style]}>
        <Speakable
          atomic
          speech={speech}
          onPress={() => {
            if (haptics) haptic.tap();
            onPress();
          }}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          hitSlop={slop}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ selected }}
          style={({ pressed }) => [
            styles.base,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: pressed
                ? isDanger
                  ? tints.danger
                  : tints.primary
                : selected
                ? colors.ice
                : colors.card,
              borderColor: selected ? colors.primary : colors.cardBorder,
            },
            elevation.e1,
          ]}
        >
          {({ pressed }) => (
            <Icon
              name={icon}
              size={glyph}
              color={
                isDanger
                  ? colors.dangerDeep
                  : selected || pressed
                  ? colors.primary
                  : colors.ink
              }
              active={selected || pressed}
            />
          )}
        </Speakable>
      </Animated.View>
    );
  }

  const look = NIGHT[tone];
  return (
    <Animated.View style={[press.style, style]}>
      <Speakable
          atomic
          speech={speech}
        onPress={() => {
          if (haptics) haptic.tap();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        hitSlop={slop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          styles.base,
          styles.night,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: look.border,
            backgroundColor: pressed ? look.pressedBg : look.bg,
          },
        ]}
      >
        <Icon name={icon} size={glyph} color={colors.onNight} active={selected} />
      </Speakable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  night: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
