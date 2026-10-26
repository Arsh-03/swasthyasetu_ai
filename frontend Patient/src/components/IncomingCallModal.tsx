import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { colors, spacing, tints } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { haptic } from '../utils/haptics';
import { GlassSheet } from './glass';
import { AppText, CriticalButton, Icon } from './ui';

interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  onAccept: () => void;
  onDecline: () => void;
  /** Video call (default) or audio-only call. */
  video?: boolean;
  /** Answer a video call with audio only. */
  onAcceptAudio?: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  visible, callerName, onAccept, onDecline, video = true, onAcceptAudio,
}) => {
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
    <GlassSheet visible={visible} onClose={onDecline} material="night" strongScrim>
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
            <Icon name="doctor" size={40} color={colors.onPrimary} />
          </View>
        </View>

        <View style={styles.text}>
          <AppText variant="eyebrow" color="successDeep" align="center" compact>
            {video ? t('incomingVideoCall') : t('incomingAudioCall')}
          </AppText>
          <AppText variant="title" color="onPrimary" align="center">
            {callerName}
          </AppText>
          <AppText variant="footnote" color="onNightMuted" align="center">
            {t('callerFacility')}
          </AppText>
          <View style={styles.compliance}>
            <Icon name="shieldCheck" size={14} color={colors.onNightMuted} />
            <AppText variant="caption" weight={600} color="onNightMuted" compact>
              {t('callCompliance')}
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <CriticalButton tone="danger" label={t('decline')} icon="callEnd" onPress={onDecline} fullWidth={false} style={styles.action} />
          <CriticalButton tone="primary" label={t('accept')} icon={video ? 'video' : 'call'} onPress={onAccept} fullWidth={false} style={styles.action} />
        </View>
        {video && onAcceptAudio && (
          <CriticalButton tone="success" label={t('answerAudioOnly')} icon="call" onPress={onAcceptAudio} style={styles.audioOnly} />
        )}
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
    backgroundColor: tints.successRing,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: tints.white,
    borderWidth: 2,
    borderColor: tints.whiteStrong,
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
    gap: spacing.md,
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
  action: {
    flex: 1,
  },
  audioOnly: {
    alignSelf: 'stretch',
  },
});
