import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, tints } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { haptic } from '../utils/haptics';
import { GlassSurface } from './glass';
import { AppText, CriticalButton, Icon, IconButton } from './ui';
import type { ConsultationCallApi } from '../services/call/useConsultationCall';
import { useCallTimer } from '../services/call/useCallTimer';
import { CONSENT_TEXT } from '../services/call/consentText';
import { NativeCallVideo } from '../services/webrtcPlatform';

interface PatientTelehealthCallProps {
  /** The live call (state lives in App so the call keeps running across screens). */
  call: ConsultationCallApi;
  doctorName: string;
  onEndCall: () => void;
}

const isWeb = Platform.OS === 'web';

/** A call stream: a browser <video> on the web (muted: the voice plays from App's <RemoteAudio>),
 *  the react-native-webrtc view on phones (which also plays the voice). */
const StreamVideo: React.FC<{ stream: MediaStream | null; mirror?: boolean }> = (props) =>
  isWeb ? <WebVideo {...props} /> : NativeCallVideo ? <NativeCallVideo {...props} /> : null;

const WebVideo: React.FC<{ stream: MediaStream | null; mirror?: boolean }> = ({ stream, mirror }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  });
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: mirror ? 'scaleX(-1)' : undefined }}
    />
  );
};

export const PatientTelehealthCall: React.FC<PatientTelehealthCallProps> = ({ call, onEndCall, doctorName }) => {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const timer = useCallTimer(call.callStartedAt);
  const copy = CONSENT_TEXT[lang];
  const calling = call.callState === 'calling';
  const isMicOn = !call.micOff;
  const isCamOn = !call.camOff;
  const q = call.quality;
  const slow = !!q && (q.limitedBy === 'cpu' || (q.networkMs ?? 0) > 300 || (q.audioDelayMs ?? 0) > 250);

  const handleEnd = () => {
    haptic.warning();
    call.endCall();
    onEndCall();
  };

  const overlayTop = insets.top + spacing.md;

  return (
    <View style={styles.callContainer}>
      {/* Video stage: the doctor's real video, or (audio call / connecting) their name */}
      <View style={styles.videoStage}>
        {call.remoteHasVideo && !calling ? (
          <StreamVideo stream={call.remoteStream} />
        ) : (
          <View style={styles.cameraOffPlaceholder}>
            <View style={styles.avatarPlaceholder}>
              <Icon name="doctor" size={44} color={colors.onPrimary} />
            </View>
            <AppText variant="title" color="onPrimary" align="center">
              {doctorName}
            </AppText>
            <AppText variant="footnote" weight={500} color="onNightMuted" align="center">
              {calling
                ? t('callCalling', { name: doctorName })
                : call.remoteStream
                ? t('callAudioWith', { name: doctorName })
                : t('callConnecting')}
            </AppText>
          </View>
        )}

        {/* Top status pills: measured connection quality, call time, recording */}
        <View style={[styles.topBar, { top: overlayTop }]}>
          <GlassSurface material="night" style={styles.glassPill}>
            <View style={[styles.statusDot, { backgroundColor: slow ? colors.warning : colors.success }]} />
            <AppText variant="caption" weight={600} color="onPrimary" compact>
              {q ? `${q.networkMs ?? '–'} ms · ${q.audioDelayMs ?? '–'} ms` : calling ? '…' : t('callConnecting')}
            </AppText>
          </GlassSurface>

          <GlassSurface material="night" style={styles.glassPill}>
            {call.recordingSession && <View style={[styles.statusDot, styles.recordingDot]} />}
            <AppText variant="mono" color="onPrimary" style={styles.tabular}>
              {timer || '0:00'}
            </AppText>
          </GlassSurface>
        </View>

        {/* Self picture-in-picture (video calls) */}
        {call.withVideo && call.localStream && (
          <View style={[styles.selfPip, { top: overlayTop + 48 }]}>
            {isCamOn ? (
              <StreamVideo stream={call.localStream} mirror />
            ) : (
              <View style={styles.pipOff}>
                <Icon name="videoOff" size={28} color={colors.onNightMuted} />
              </View>
            )}
            <View style={styles.pipLabel}>
              <AppText variant="caption" weight={600} color="onPrimary" compact>
                {t('you')}
              </AppText>
            </View>
          </View>
        )}

        {/* Recording for AI minutes (only with consent): always visible, with Stop */}
        {(call.recordingSession || slow) && (
          <View style={styles.captionContainer}>
            {call.recordingSession && (
              <GlassSurface material="night" style={styles.captionBanner}>
                <View style={[styles.statusDot, styles.recordingDot]} />
                <AppText variant="footnote" weight={500} color="onPrimary" style={styles.captionText}>
                  {copy.recordingBanner}
                </AppText>
                <Pressable
                  onPress={call.withdrawConsent}
                  accessibilityRole="button"
                  accessibilityLabel={copy.stop}
                  style={styles.stopButton}
                  hitSlop={8}
                >
                  <Icon name="stop" size={16} color={colors.onPrimary} />
                  <AppText variant="caption" weight={700} color="onPrimary" compact>
                    {copy.stop}
                  </AppText>
                </Pressable>
              </GlassSurface>
            )}
            {slow && !call.recordingSession && (
              <GlassSurface material="night" style={styles.captionBanner}>
                <Icon name="network" size={18} color={colors.onNightMuted} />
                <AppText variant="footnote" weight={500} color="onPrimary" style={styles.captionText}>
                  {t('callSlow')}
                </AppText>
              </GlassSurface>
            )}
          </View>
        )}
      </View>

      {/* Floating call controls */}
      <View style={[styles.controlsContainer, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}>
        <GlassSurface material="night" style={styles.controlsPill}>
          {!calling && (
            <IconButton
              icon={isMicOn ? 'mic' : 'micOff'}
              tone={isMicOn ? 'night' : 'nightOff'}
              size={52}
              iconSize={24}
              selected={!isMicOn}
              accessibilityLabel={isMicOn ? t('muteMic') : t('unmuteMic')}
              onPress={call.toggleMic}
              haptics
            />
          )}
          {!calling && call.withVideo && (
            <IconButton
              icon={isCamOn ? 'video' : 'videoOff'}
              tone={isCamOn ? 'night' : 'nightOff'}
              size={52}
              iconSize={24}
              selected={!isCamOn}
              accessibilityLabel={isCamOn ? t('cameraOff') : t('cameraOn')}
              onPress={call.toggleCam}
              haptics
            />
          )}
          <CriticalButton
            tone="danger"
            label={calling ? t('callCancel') : t('endCall')}
            icon="callEnd"
            onPress={handleEnd}
            fullWidth={false}
          />
        </GlassSurface>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  callContainer: {
    flex: 1,
    backgroundColor: colors.night,
  },
  videoStage: {
    flex: 1,
    backgroundColor: colors.night,
    overflow: 'hidden',
  },
  cameraOffPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: tints.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  recordingDot: {
    backgroundColor: colors.danger,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
    fontSize: 12,
  },
  selfPip: {
    position: 'absolute',
    right: spacing.lg,
    width: 96,
    height: 136,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: tints.whiteStrong,
    backgroundColor: colors.night,
    ...shadows.lg,
  },
  pipOff: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipLabel: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: colors.scrimStrong,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.xs,
  },
  captionContainer: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  captionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 440,
  },
  captionText: {
    flexShrink: 1,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
  },
  controlsContainer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    backgroundColor: colors.night,
  },
  controlsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    borderRadius: 40,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
