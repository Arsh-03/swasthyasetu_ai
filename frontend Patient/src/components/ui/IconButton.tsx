import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, tints, touch } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import { Icon, type IconName } from './Icon';

const LOOKS = {
  // bg-[#E5E5EA]/70 ring-1 ring-black/5 (close / logout buttons)
  neutral: { bg: tints.gray, pressedBg: colors.gray5, icon: colors.label, border: colors.hairline },
  plain: { bg: 'transparent', pressedBg: tints.gray, icon: colors.secondary, border: 'transparent' },
  danger: { bg: tints.gray, pressedBg: tints.red, icon: colors.tertiary, border: colors.hairline },
  // Dark glass controls on the video call
  dark: { bg: 'rgba(255, 255, 255, 0.14)', pressedBg: 'rgba(255, 255, 255, 0.24)', icon: colors.onTint, border: 'rgba(255, 255, 255, 0.12)' },
  darkOff: { bg: 'rgba(255, 59, 48, 0.28)', pressedBg: 'rgba(255, 59, 48, 0.4)', icon: colors.onTint, border: 'rgba(255, 59, 48, 0.3)' },
  blue: { bg: colors.blue, pressedBg: colors.blueHover, icon: colors.onTint, border: 'transparent' },
  red: { bg: colors.red, pressedBg: '#E0352B', icon: colors.onTint, border: 'transparent' },
  green: { bg: colors.green, pressedBg: '#2FB350', icon: colors.onTint, border: 'transparent' },
} as const;

interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only buttons must be named for screen readers. */
  accessibilityLabel: string;
  onPress: () => void;
  tone?: keyof typeof LOOKS;
  /** Visual diameter; the hit area is padded out to at least 48. */
  size?: number;
  iconSize?: number;
  haptics?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  accessibilityLabel,
  onPress,
  tone = 'neutral',
  size = 32,
  iconSize,
  haptics = false,
  selected,
  style,
}) => {
  const look = LOOKS[tone];
  const slop = Math.max(0, (touch.min - size) / 2);
  return (
    <Pressable
      onPress={() => {
        if (haptics) haptic.tap();
        onPress();
      }}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2, borderColor: look.border },
        { backgroundColor: pressed ? look.pressedBg : look.bg },
        pressed && styles.pressed,
        style,
      ]}
    >
      {({ pressed }) => (
        <Icon
          name={icon}
          size={iconSize ?? Math.round(size * 0.5)}
          color={tone === 'danger' && pressed ? colors.red : look.icon}
        />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
});
