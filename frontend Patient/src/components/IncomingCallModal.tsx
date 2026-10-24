import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { haptic } from '../utils/haptics';
import { GlassSheet } from './glass';
import { AppText, Icon, IconButton } from './ui';

interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ visible, callerName, onAccept, onDecline }) => {
  const { t } = useLanguage();
  const [pulse] = useState(() => new Animated.Value(0));

  // Ringing pulse; skipped when the user prefers reduced motion
  useEffect(() => {
    if (!visible) return;
    haptic.warning();
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return;
      loop = Animated.loop(
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      loop.start();
    });
    return () => {
      loop?.stop();
      pulse.setValue(0);
    };
  }, [visible, pulse]);

  return (
    <GlassSheet visible={visible} onClose={onDecline} material="dark" strongScrim>
      <View style={styles.body}>
        <View style={styles.avatarWrap}>
          <Animated.View
            style={[
              styles.ring,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
              },
            ]}
          />
          <View style={styles.avatar}>
            <Icon name="medical-services" size={40} color={colors.onTint} />
          </View>
        </View>

        <View style={styles.text}>
          <AppText variant="eyebrow" color="green" align="center" compact>
            {t('incomingVideoCall')}
          </AppText>
          <AppText variant="title" color="onTint" align="center">
            {callerName}
          </AppText>
          <AppText variant="footnote" color="gray3" align="center">
            {t('callerFacility')}
          </AppText>
          <View style={styles.compliance}>
            <Icon name="verified-user" size={14} color={colors.teal} />
            <AppText variant="caption" weight={600} color="teal" compact>
              {t('callCompliance')}
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.action}>
            <IconButton icon="call-end" tone="red" size={68} iconSize={30} accessibilityLabel={t('decline')} onPress={onDecline} haptics />
            <AppText variant="footnote" weight={600} color="gray3" compact>
              {t('decline')}
            </AppText>
          </View>
          <View style={styles.action}>
            <IconButton icon="videocam" tone="green" size={68} iconSize={30} accessibilityLabel={t('accept')} onPress={onAccept} haptics />
            <AppText variant="footnote" weight={600} color="gray3" compact>
              {t('accept')}
            </AppText>
          </View>
        </View>
      </View>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  avatarWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(52, 199, 89, 0.45)',
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  compliance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 320,
    marginTop: spacing.md,
  },
  action: {
    alignItems: 'center',
    gap: spacing.sm,
  },
});
