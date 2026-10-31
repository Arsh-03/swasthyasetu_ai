import React from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, elevation, radii, spacing } from '../../theme/tokens';
import { usePressScale } from '../../hooks/usePressScale';
import { haptic } from '../../utils/haptics';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { Speakable, type SpeechSource } from '../../speech/Speakable';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** `md` = 48-52pt main action, `sm` = 40pt inline action. */
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Spoken on double tap (default: the label). */
  speech?: SpeechSource;
}

/** Main solid action: solid primary, white text (5.89:1), e1 shadow, pressed darker. */
export const PrimaryButton: React.FC<ButtonProps> = ({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  size = 'md',
  style,
  accessibilityLabel,
  accessibilityHint,
  speech,
}) => {
  const press = usePressScale(0.98);
  const isSm = size === 'sm';
  const inactive = disabled || loading;

  return (
    <Animated.View style={[press.style, style]}>
      <Speakable
        atomic
        speech={speech}
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ busy: loading }}
        style={({ pressed }) => [
          styles.base,
          isSm ? styles.sm : styles.md,
          {
            backgroundColor: inactive
              ? colors.primarySoft
              : pressed
              ? colors.primaryPressed
              : colors.primary,
          },
          inactive ? styles.disabled : elevation.e1,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} size="small" />
        ) : (
          icon && <Icon name={icon} size={isSm ? 18 : 20} color={colors.onPrimary} active />
        )}
        <AppText
          variant={isSm ? 'footnote' : 'callout'}
          weight={600}
          color="onPrimary"
          numberOfLines={1}
          align="center"
          compact
        >
          {label}
        </AppText>
      </Speakable>
    </Animated.View>
  );
};

/** Secondary tonal action: tonal ice fill, deep primary text (≥ 4.5:1), subtle 1px border. */
export const SecondaryButton: React.FC<ButtonProps & { tone?: 'neutral' | 'primary' | 'success' }> = ({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  size = 'md',
  style,
  accessibilityLabel,
  accessibilityHint,
  speech,
}) => {
  const press = usePressScale(0.98);
  const isSm = size === 'sm';
  const inactive = disabled || loading;

  return (
    <Animated.View style={[press.style, style]}>
      <Speakable
        atomic
        speech={speech}
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ busy: loading }}
        style={({ pressed }) => [
          styles.base,
          isSm ? styles.sm : styles.md,
          styles.secondaryBase,
          {
            backgroundColor: pressed ? '#C8E2ED' : colors.ice,
          },
          inactive && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryDeep} size="small" />
        ) : (
          icon && <Icon name={icon} size={isSm ? 18 : 20} color={colors.primaryDeep} active />
        )}
        <AppText
          variant={isSm ? 'footnote' : 'callout'}
          weight={600}
          color="primaryDeep"
          numberOfLines={1}
          align="center"
          compact
        >
          {label}
        </AppText>
      </Speakable>
    </Animated.View>
  );
};

/** Tertiary action: transparent background with text. */
export const TertiaryButton: React.FC<ButtonProps> = ({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  size = 'md',
  style,
  accessibilityLabel,
  accessibilityHint,
  speech,
}) => {
  const isSm = size === 'sm';
  const inactive = disabled || loading;

  return (
    <Speakable
        atomic
        speech={speech}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading }}
      style={({ pressed }) => [
        styles.base,
        isSm ? styles.sm : styles.md,
        styles.tertiaryBase,
        pressed && styles.tertiaryPressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        icon && <Icon name={icon} size={isSm ? 18 : 20} color={colors.primary} active />
      )}
      <AppText
        variant={isSm ? 'footnote' : 'callout'}
        weight={600}
        color="primary"
        numberOfLines={1}
        align="center"
        compact
      >
        {label}
      </AppText>
    </Speakable>
  );
};

/** Non-critical destructive action: dangerDeep text with subtle tint or outline. */
export const DestructiveButton: React.FC<ButtonProps> = ({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  size = 'md',
  style,
  accessibilityLabel,
  accessibilityHint,
  speech,
}) => {
  const press = usePressScale(0.98);
  const isSm = size === 'sm';
  const inactive = disabled || loading;

  return (
    <Animated.View style={[press.style, style]}>
      <Speakable
        atomic
        speech={speech}
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ busy: loading }}
        style={({ pressed }) => [
          styles.base,
          isSm ? styles.sm : styles.md,
          styles.destructiveBase,
          {
            backgroundColor: pressed ? '#FADADA' : '#FDF2F2',
          },
          inactive && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.dangerDeep} size="small" />
        ) : (
          icon && <Icon name={icon} size={isSm ? 18 : 20} color={colors.dangerDeep} active />
        )}
        <AppText
          variant={isSm ? 'footnote' : 'callout'}
          weight={600}
          color="dangerDeep"
          numberOfLines={1}
          align="center"
          compact
        >
          {label}
        </AppText>
      </Speakable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  md: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sm: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  secondaryBase: {
    borderWidth: 1,
    borderColor: 'rgba(62, 105, 133, 0.2)',
  },
  tertiaryBase: {
    backgroundColor: 'transparent',
  },
  tertiaryPressed: {
    opacity: 0.6,
  },
  destructiveBase: {
    borderWidth: 1,
    borderColor: 'rgba(214, 69, 69, 0.2)',
  },
  disabled: {
    opacity: 0.6,
  },
});
