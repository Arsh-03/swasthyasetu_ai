import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing } from '../../theme/tokens';
import { GlassSurface } from '../glass/GlassSurface';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type ToastTone = 'info' | 'success' | 'warning' | 'error' | 'call' | 'calendar';

const TONE_ICON: Record<ToastTone, { icon: IconName; color: string }> = {
  info: { icon: 'info', color: colors.onTint },
  success: { icon: 'check-circle', color: colors.green },
  warning: { icon: 'warning', color: colors.orange },
  error: { icon: 'error', color: colors.red },
  call: { icon: 'videocam', color: colors.green },
  calendar: { icon: 'event', color: '#64D2FF' },
};

export interface ToastMessage {
  text: string;
  tone: ToastTone;
}

const useNative = Platform.OS !== 'web';

/** Dynamic-Island style capsule in dark glass. Announced to screen readers. */
export const Toast: React.FC<{ message: ToastMessage | null }> = ({ message }) => {
  const insets = useSafeAreaInsets();
  const [anim] = useState(() => new Animated.Value(0));
  // Keep the last message on screen while it fades out
  const [shown, setShown] = useState<ToastMessage | null>(message);
  if (message && message !== shown) setShown(message);

  useEffect(() => {
    if (message) {
      AccessibilityInfo.announceForAccessibility(message.text);
      Animated.spring(anim, { toValue: 1, damping: 18, stiffness: 240, useNativeDriver: useNative }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: useNative }).start(({ finished }) => {
        if (finished) setShown(null);
      });
    }
  }, [message, anim]);

  if (!shown) return null;
  const look = TONE_ICON[shown.tone];

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + spacing.sm }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.shadow,
          {
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            ],
          },
        ]}
      >
        <GlassSurface material="dark" style={styles.pill}>
          <Icon name={look.icon} size={18} color={look.color} />
          <AppText variant="subhead" weight={600} color="onTint" style={styles.text}>
            {shown.text}
          </AppText>
        </GlassSurface>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  shadow: {
    borderRadius: radii.xl,
    maxWidth: 440,
    ...shadows.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flexShrink: 1,
  },
});
