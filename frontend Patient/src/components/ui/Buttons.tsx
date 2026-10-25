import React from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, touch, type ColorRole } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { NeuPressable } from './Neu';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** `md` = 52pt main action, `sm` = 40pt inline action (hit area still ≥ 48). */
  size?: 'md' | 'sm';
  /** Outer layout (flex, margins). */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * Non-critical buttons: STRONG raised neumorphic controls that press to inset. The label
 * colour carries the role. Critical actions (SOS, consent, join / end call) use CriticalButton.
 */
const NeuButtonBase: React.FC<ButtonProps & { fg: ColorRole; weight?: 600 | 700 }> = ({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  size = 'md',
  style,
  accessibilityLabel,
  accessibilityHint,
  fg,
  weight = 600,
}) => {
  const isSm = size === 'sm';
  const inactive = disabled || loading;
  return (
    <NeuPressable
      onPress={onPress}
      disabled={inactive}
      radius={isSm ? radii.sm : radii.md}
      compact={isSm}
      hitSlop={isSm ? (touch.min - 40) / 2 : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading }}
      containerStyle={style}
      style={[styles.base, isSm ? styles.sm : styles.md]}
    >
      {(down) => (
        <>
          {/* Loading keeps the label visible next to the spinner, so the state is never silent */}
          {loading ? (
            <ActivityIndicator color={colors[fg]} />
          ) : (
            icon && <Icon name={icon} size={isSm ? 18 : 22} color={colors[fg]} active={!down} />
          )}
          <AppText
            variant={isSm ? 'footnote' : 'callout'}
            weight={weight}
            color={fg}
            numberOfLines={2}
            align="center"
            compact
            style={styles.label}
          >
            {label}
          </AppText>
        </>
      )}
    </NeuPressable>
  );
};

/** Main non-critical action (Sign in, Continue): raised, bold primary label + duotone icon. */
export const PrimaryButton: React.FC<ButtonProps> = (props) => <NeuButtonBase {...props} fg="primary" weight={700} />;

const SECONDARY_FG: Record<'neutral' | 'primary' | 'success', ColorRole> = {
  neutral: 'ink',
  primary: 'primary',
  success: 'successDeep',
};

export const SecondaryButton: React.FC<ButtonProps & { tone?: keyof typeof SECONDARY_FG }> = ({ tone = 'neutral', ...props }) => (
  <NeuButtonBase {...props} fg={SECONDARY_FG[tone]} />
);

/** Non-critical destructive action (Revoke access): raised with a dangerDeep label. */
export const DestructiveButton: React.FC<ButtonProps> = (props) => <NeuButtonBase {...props} fg="dangerDeep" />;

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  md: {
    minHeight: touch.min + 4,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  sm: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  label: {
    flexShrink: 1,
  },
});
