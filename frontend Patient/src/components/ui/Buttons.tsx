import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, glow, radii, shadows, spacing, tints, touch } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** `md` = 48pt main action, `sm` = 36pt inline action (hit area still ≥ 48). */
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

interface Look {
  bg: string;
  pressedBg: string;
  fg: keyof typeof colors;
  border?: string;
  shadow?: ViewStyle;
}

const ButtonBase: React.FC<ButtonProps & { look: Look; haptics?: boolean }> = ({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  size = 'md',
  style,
  accessibilityLabel,
  accessibilityHint,
  look,
  haptics = false,
}) => {
  const inactive = disabled || loading;
  const isSm = size === 'sm';
  return (
    <Pressable
      onPress={() => {
        if (haptics) haptic.tap();
        onPress();
      }}
      disabled={inactive}
      hitSlop={isSm ? (touch.min - 36) / 2 : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        isSm ? styles.sm : styles.md,
        { backgroundColor: pressed ? look.pressedBg : look.bg },
        look.border ? { borderWidth: 1, borderColor: look.border } : null,
        look.shadow,
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[look.fg]} />
      ) : (
        <>
          {icon && <Icon name={icon} size={isSm ? 16 : 20} color={colors[look.fg]} />}
          <AppText
            variant={isSm ? 'footnote' : 'callout'}
            weight={600}
            color={look.fg}
            numberOfLines={2}
            align="center"
            compact
            style={styles.label}
          >
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
};

/** bg-[#007AFF] hover:bg-[#0062CC] … shadow-apple-sm */
export const PrimaryButton: React.FC<ButtonProps> = (props) => (
  <ButtonBase
    {...props}
    haptics
    look={{ bg: colors.blue, pressedBg: colors.blueHover, fg: 'onTint', shadow: props.size === 'sm' ? undefined : glow(colors.blue) }}
  />
);

const SECONDARY_LOOKS: Record<'neutral' | 'blue' | 'green', Look> = {
  // bg-[#F2F2F7] border-black/5 (Doctor's demo button)
  neutral: { bg: colors.gray6, pressedBg: colors.gray5, fg: 'label', border: colors.hairline },
  // bg-[#007AFF]/10 (View Scan)
  blue: { bg: tints.blue, pressedBg: tints.blueRing, fg: 'blue' },
  // bg-[#34C759]/15 (Call)
  green: { bg: tints.greenStrong, pressedBg: tints.greenRing, fg: 'greenDeep' },
};

export const SecondaryButton: React.FC<ButtonProps & { tone?: keyof typeof SECONDARY_LOOKS; elevated?: boolean }> = ({
  tone = 'neutral',
  elevated = false,
  ...props
}) => {
  const look = SECONDARY_LOOKS[tone];
  return (
    <ButtonBase
      {...props}
      look={elevated ? { ...look, bg: colors.card, shadow: shadows.sm } : look}
    />
  );
};

/** `filled` for SOS / hang-up, `tinted` (bg-[#FF3B30]/10) for revoke / decline. */
export const DestructiveButton: React.FC<ButtonProps & { variant?: 'filled' | 'tinted' }> = ({
  variant = 'tinted',
  ...props
}) => (
  <ButtonBase
    {...props}
    haptics={variant === 'filled'}
    look={
      variant === 'filled'
        ? { bg: colors.red, pressedBg: '#E0352B', fg: 'onTint', shadow: glow(colors.red) }
        : { bg: tints.red, pressedBg: tints.redRing, fg: 'red' }
    }
  />
);

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
  },
  md: {
    minHeight: touch.min,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  sm: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  label: {
    flexShrink: 1,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
