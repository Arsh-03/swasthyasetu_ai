import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, neu, tints, touch } from '../../theme/tokens';
import { usePressScale } from '../../hooks/usePressScale';
import { haptic } from '../../utils/haptics';
import { Icon, type IconName } from './Icon';
import { NeuPressable } from './Neu';

export type IconButtonTone = 'neutral' | 'danger' | 'night' | 'nightOff';

interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only buttons must be named for screen readers. */
  accessibilityLabel: string;
  onPress: () => void;
  /**
   * neutral / danger = RAISED neumorphic disc (header buttons, close, mic).
   * night / nightOff = translucent disc for the dark call screen (neumorphic light
   * shadows do not read on `night`).
   */
  tone?: IconButtonTone;
  /** Visual diameter; the hit area is padded out to at least 48. */
  size?: number;
  iconSize?: number;
  haptics?: boolean;
  /** Latched state (mic on, recording): stays inset with a duotone primary glyph. */
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
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
  size = 36,
  iconSize,
  haptics = false,
  selected,
  style,
}) => {
  const press = usePressScale(0.94);
  const slop = Math.max(0, (touch.min - size) / 2);
  const glyph = iconSize ?? Math.round(size * 0.5);

  if (tone === 'neutral' || tone === 'danger') {
    return (
      <NeuPressable
        onPress={onPress}
        selected={selected}
        radius={size / 2}
        compact={size < 48}
        haptics={haptics ? 'tap' : 'none'}
        hitSlop={slop}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={selected === undefined ? undefined : { selected }}
        containerStyle={style}
        style={[styles.base, { width: size, height: size }]}
      >
        {(down) => (
          <Icon
            name={icon}
            size={glyph}
            color={down ? (tone === 'danger' ? colors.dangerDeep : colors.primary) : tone === 'danger' ? colors.inkMuted : colors.ink}
            active={down}
            surface={down ? neu.inset.strong.fill[0] : neu.raised.strong.fill[1]}
          />
        )}
      </NeuPressable>
    );
  }

  const look = NIGHT[tone];
  return (
    <Animated.View style={[press.style, style]}>
      <Pressable
        onPress={() => {
          if (haptics) haptic.tap();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        hitSlop={slop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={selected === undefined ? undefined : { selected }}
        style={({ pressed }) => [
          styles.base,
          styles.night,
          { width: size, height: size, borderRadius: size / 2, borderColor: look.border, backgroundColor: pressed ? look.pressedBg : look.bg },
        ]}
      >
        <Icon name={icon} size={glyph} color={colors.onNight} active={selected} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  night: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
