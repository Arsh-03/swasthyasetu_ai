import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, tints } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { haptic } from '../utils/haptics';
import { TURN_CONFIG } from '../services/api';
import { buildIceServers, CallSession, type CallConnection, type SignalMessage } from '../services/rtc/callSession';
import { getLocalMedia, rtc } from '../services/rtc/platform';
import type { TranslationKey } from '../utils/translations';
import { GlassSurface } from './glass';
import { StreamView } from './call/StreamView';
import { AppText, CriticalButton, Icon, IconButton } from './ui';

/** Sends frames over the app's telehealth socket and lets the call listen for `webrtc` frames. */
export interface CallSignaling {
  send: (msg: Record<string, unknown>) => void;
  subscribe: (handler: (msg: SignalMessage) => void) => () => void;
}

interface PatientTelehealthCallProps {
  doctorName: string;
  /** The accepted call; null while the patient waits in the room for the doctor to call. */
  call: { callId: string; doctorId: string } | null;
  signaling: CallSignaling;
  onEndCall: () => void;
}

type NetworkTier = 'hd' | 'audio' | 'async';
type MediaProblem = 'unavailable' | 'blocked' | 'insecure' | null;

const NEXT_TIER: Record<NetworkTier, NetworkTier> = { hd: 'audio', audio: 'async', async: 'hd' };
const TIER_COLOR: Record<NetworkTier, string> = { hd: colors.success, audio: colors.warning, async: colors.danger };
const PROBLEM_TEXT: Record<Exclude<MediaProblem, null>, TranslationKey> = {
  unavailable: 'callNeedsAppBuild',
  blocked: 'callCameraBlocked',
  insecure: 'callNeedsHttps',
};

/**
 * Live 1:1 video consultation (WebRTC). The patient is the callee: once the camera is up it
 * signals "ready", the doctor's portal sends an offer, and the two connect peer-to-peer.
 */
export const PatientTelehealthCall: React.FC<PatientTelehealthCallProps> = ({ onEndCall, doctorName, call, signaling }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [networkTier, setNetworkTier] = useState<NetworkTier>('hd');

  const [localStream, setLocalStream] = useState<any>(null);
  // Without WebRTC there is no camera step to wait for
  const [mediaSettled, setMediaSettled] = useState(!rtc);
  const [mediaProblem, setMediaProblem] = useState<MediaProblem>(rtc ? null : 'unavailable');
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [remoteMedia, setRemoteMedia] = useState({ video: true, audio: true });
  const [connection, setConnection] = useState<CallConnection>('connecting');
  const sessionRef = useRef<CallSession | null>(null);
  const streamRef = useRef<any>(null);
  // Latest toggles, read when a session starts
  const sendVideo = isCamOn && networkTier === 'hd';
  const mediaRef = useRef({ video: sendVideo, audio: isMicOn });
  const signalingRef = useRef(signaling);
  useEffect(() => {
    mediaRef.current = { video: sendVideo, audio: isMicOn };
    signalingRef.current = signaling;
  }, [sendVideo, isMicOn, signaling]);

  // 1. Camera + microphone
  useEffect(() => {
    let cancelled = false;
    if (!rtc) return;
    getLocalMedia()
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track: any) => track.stop());
          return;
        }
        streamRef.current = stream;
        setLocalStream(stream);
      })
      .catch((err: any) => {
        console.warn('Patient camera/mic unavailable:', err);
        setMediaProblem(err?.message === 'insecure-context' ? 'insecure' : 'blocked');
      })
      .finally(() => !cancelled && setMediaSettled(true));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track: any) => track.stop());
      streamRef.current = null;
    };
  }, []);

  // 2. Peer connection, once the doctor's call is accepted and the camera step has finished.
  // Without a camera the patient still sees and hears the doctor.
  useEffect(() => {
    if (!rtc || !call || !mediaSettled) return;
    const session = new CallSession({
      rtc,
      role: 'callee',
      callId: call.callId,
      localStream: streamRef.current,
      iceServers: buildIceServers(TURN_CONFIG),
      send: (msg) => signalingRef.current.send({ ...msg, to: call.doctorId }),
      onRemoteStream: setRemoteStream,
      onConnection: setConnection,
      onRemoteMedia: setRemoteMedia,
    });
    sessionRef.current = session;
    const unsubscribe = signalingRef.current.subscribe((msg) => session.handleSignal(msg));
    session.start();
    session.setLocalMedia(mediaRef.current);
    return () => {
      unsubscribe();
      session.close();
      sessionRef.current = null;
      setRemoteStream(null);
    };
  }, [call?.callId, call?.doctorId, mediaSettled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply mic / camera / bandwidth-tier changes to the live call
  useEffect(() => {
    if (sessionRef.current) sessionRef.current.setLocalMedia({ video: sendVideo, audio: isMicOn });
    else streamRef.current?.getVideoTracks().forEach((track: any) => (track.enabled = sendVideo));
  }, [sendVideo, isMicOn]);

  // Call timer runs while connected
  const isConnected = connection === 'connected';
  useEffect(() => {
    if (!isConnected) return;
    const timer = setInterval(() => setCallSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isConnected]);

  const handleToggleMic = () => setIsMicOn((on) => !on);
  const handleToggleCam = () => setIsCamOn((on) => !on);

  const handleEnd = () => {
    haptic.warning();
    sessionRef.current?.close();
    streamRef.current?.getTracks().forEach((track: any) => track.stop());
    onEndCall();
  };

  const cycleNetworkTier = () => setNetworkTier(NEXT_TIER[networkTier]);

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const tierLabel = networkTier === 'hd' ? t('networkHd') : networkTier === 'audio' ? t('networkAudio') : t('networkOffline');
  const overlayTop = insets.top + spacing.md;

  const showRemoteVideo = !!remoteStream && isConnected && remoteMedia.video;
  // What the stage says while there is no doctor video to show
  const stageStatus: string = !call
    ? t('callWaitingForDoctor')
    : connection === 'failed'
      ? t('callFailed')
      : connection === 'reconnecting'
        ? t('callReconnecting')
        : !isConnected
          ? t('callConnecting')
          : !remoteMedia.video
            ? t('callDoctorCameraOff')
            : '';

  return (
    <View style={styles.callContainer}>
      {/* Video stage */}
      <View style={styles.videoStage}>
        {/* Always mounted while there is a stream so the doctor's audio keeps playing */}
        {remoteStream && <StreamView stream={remoteStream} style={StyleSheet.absoluteFill} />}

        {!showRemoteVideo && (
          <View style={[StyleSheet.absoluteFill, styles.cameraOffPlaceholder]}>
            <View style={styles.avatarPlaceholder}>
              <Icon name="doctor" size={44} color={colors.onPrimary} />
            </View>
            <AppText variant="title" color="onPrimary" align="center">
              {doctorName}
            </AppText>
            <AppText variant="footnote" weight={500} color="onNightMuted" align="center" accessibilityLiveRegion="polite">
              {stageStatus}
            </AppText>
          </View>
        )}

        {/* Weak-network: own video paused, audio only */}
        {networkTier === 'audio' && (
          <View style={styles.audioWaveOverlay} pointerEvents="none">
            <View style={styles.waveRow}>
              {[20, 38, 26, 48, 24].map((h, i) => (
                <View key={i} style={[styles.waveBar, { height: h }]} />
              ))}
            </View>
            <GlassSurface material="night" style={styles.glassPill}>
              <AppText variant="footnote" weight={600} color="onPrimary" compact>
                {t('weakSignal')}
              </AppText>
            </GlassSurface>
          </View>
        )}

        {/* Top status pills */}
        <View style={[styles.topBar, { top: overlayTop }]}>
          <Pressable
            onPress={cycleNetworkTier}
            accessibilityRole="button"
            accessibilityLabel={`${t('switchNetworkTier')}: ${tierLabel}`}
            hitSlop={8}
          >
            <GlassSurface material="night" style={styles.glassPill}>
              <View style={[styles.statusDot, { backgroundColor: TIER_COLOR[networkTier] }]} />
              <AppText variant="caption" weight={600} color="onPrimary" compact>
                {tierLabel}
              </AppText>
            </GlassSurface>
          </Pressable>

          <GlassSurface material="night" style={styles.glassPill}>
            <View style={[styles.statusDot, isConnected ? styles.recordingDot : styles.idleDot]} />
            <AppText variant="mono" color="onPrimary" style={styles.tabular}>
              {formatTimer(callSeconds)}
            </AppText>
          </GlassSurface>
        </View>

        {/* Clinician info */}
        <GlassSurface material="night" style={[styles.doctorInfo, { top: overlayTop + 48 }]}>
          <AppText variant="subhead" weight={700} color="onPrimary" numberOfLines={1}>
            {doctorName}
          </AppText>
          <View style={styles.infoRow}>
            {isConnected && !remoteMedia.audio && <Icon name="micOff" size={14} color={colors.onNightMuted} />}
            <AppText variant="caption" color="onNightMuted" numberOfLines={1}>
              {isConnected && !remoteMedia.audio ? t('callDoctorMuted') : t('telehealthBrand')}
            </AppText>
          </View>
        </GlassSurface>

        {/* Self picture-in-picture: your live camera */}
        <View style={[styles.selfPip, { top: overlayTop + 48 }]}>
          {localStream && sendVideo ? (
            <StreamView stream={localStream} mirror muted overlay />
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

        {/* Camera / WebRTC problem */}
        {mediaProblem && (
          <View style={styles.captionContainer}>
            <GlassSurface material="night" style={styles.captionBanner}>
              <Icon name="warning" size={18} color={colors.warning} active />
              <AppText variant="subhead" weight={500} color="onPrimary" style={styles.captionText}>
                {t(PROBLEM_TEXT[mediaProblem])}
              </AppText>
            </GlassSurface>
          </View>
        )}
      </View>
      {/* Floating call controls */}
      <View style={[styles.controlsContainer, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}>
        <GlassSurface material="night" style={styles.controlsPill}>
          <IconButton
            icon={isMicOn ? 'mic' : 'micOff'}
            tone={isMicOn ? 'night' : 'nightOff'}
            size={52}
            iconSize={24}
            selected={!isMicOn}
            accessibilityLabel={isMicOn ? t('muteMic') : t('unmuteMic')}
            onPress={handleToggleMic}
            haptics
          />
          <IconButton
            icon={isCamOn ? 'video' : 'videoOff'}
            tone={isCamOn ? 'night' : 'nightOff'}
            size={52}
            iconSize={24}
            selected={!isCamOn}
            accessibilityLabel={isCamOn ? t('cameraOff') : t('cameraOn')}
            onPress={handleToggleCam}
            haptics
          />
          <IconButton
            icon="network"
            tone="night"
            size={52}
            iconSize={24}
            accessibilityLabel={t('switchNetworkTier')}
            onPress={cycleNetworkTier}
            haptics
          />
          <CriticalButton tone="danger" label={t('endCall')} icon="callEnd" onPress={handleEnd} fullWidth={false} />
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
    backgroundColor: colors.night,
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
  audioWaveOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrimStrong,
    gap: spacing.lg,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  waveBar: {
    width: 5,
    backgroundColor: colors.success,
    borderRadius: 2.5,
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
  idleDot: {
    backgroundColor: colors.onNightMuted,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
    fontSize: 12,
  },
  doctorInfo: {
    position: 'absolute',
    left: spacing.lg,
    maxWidth: '55%',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
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
