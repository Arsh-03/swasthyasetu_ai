import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, critical, elevation, radii, spacing } from '../../theme/tokens';
import { usePressScale } from '../../hooks/usePressScale';
import { haptic } from '../../utils/haptics';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

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
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const MIN_HEIGHT = 52;

/**
 * Flat solid critical actions: always the highest-contrast element on screen (white label ≥ 4.5:1).
 * Replaces neumorphism: solid deep colour, 1px subtle edge, e1 elevation, pressed scale .98.
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
  const inactive = disabled || loading;
  const c = critical[tone];

  return (
    <Animated.View style={[press.style, fullWidth && styles.fullWidth, style]}>
      <Pressable
        onPress={() => {
          haptic.heavy();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: loading }}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: inactive ? critical.disabledFill : pressed ? c.pressed : c.fill,
          },
          inactive ? styles.disabled : elevation.e1,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={inactive ? colors.ink : colors.onPrimary} size="small" />
        ) : (
          <Icon name={icon} size={22} color={inactive ? colors.ink : colors.onPrimary} active />
        )}
        <View style={styles.textWrap}>
          <AppText
            variant="callout"
            weight={700}
            color={inactive ? 'ink' : 'onPrimary'}
            compact
            numberOfLines={1}
          >
            {label}
          </AppText>
          {sublabel ? (
            <AppText
              variant="caption"
              weight={500}
              color={inactive ? 'inkMuted' : 'onPrimary'}
              compact
              numberOfLines={1}
            >
              {sublabel}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  button: {
    minHeight: MIN_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  textWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
});
