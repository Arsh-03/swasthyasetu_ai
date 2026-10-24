import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { haptic } from '../utils/haptics';
import { GlassSurface } from './glass';
import { AppText, Icon, IconButton } from './ui';

interface PatientTelehealthCallProps {
  doctorName: string;
  onEndCall: () => void;
}

type NetworkTier = 'hd' | 'audio' | 'async';

const DOCTOR_FEED_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCNL4BMuLtJ2i8g6NTnwHeQCHuAOBoVH2a0-_LYQNHlpps-NYI7Zm0kJOS83_2mfT6iW0VmrLR_Ws1XWJQkqFvMdbLIdoytlvHdKWy4oymsMvJiix6ZCfnabbIW2pz4OVbBjAvjRwZlJrf3ptnODgtdPMIvvwU5TOI47tgVHvDdfaHFPeZZKaZ1uf0iQ6sHQIuhtUA6yt256idRVh9J47qEBF8ZhGzRWVzPeff2xX0xQ_aOPSGolBYQfw';
const SELF_PIP_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAMknnrL1azNBnB58uMox-l1CcLlCOqWvUimLBiLkJDaWKKrtkqvKnzs2xdOeVF8iSMHpTSk0ENugY-yF1k0JbvFHTOYCtzwJVjaqx9vKZdAogAGrJm1fLfa22lW6sdm1aSSRYxv0craALN6s1BZNS6itFWOoWj_QWMP-wF772FTz5PEDVqxhkesTSt97veSZTFlDJhJgLUmUjUgo1fQDzUqUL_PXosFUri_P1ve9yPukx2vFxzlUA5NQ';

const NEXT_TIER: Record<NetworkTier, NetworkTier> = { hd: 'audio', audio: 'async', async: 'hd' };
const TIER_COLOR: Record<NetworkTier, string> = { hd: colors.green, audio: colors.orange, async: colors.red };

export const PatientTelehealthCall: React.FC<PatientTelehealthCallProps> = ({ onEndCall, doctorName }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [networkTier, setNetworkTier] = useState<NetworkTier>('hd');

  // WebRTC Local Media Stream for Patient
  const [localStream, setLocalStream] = useState<any>(null);
  const streamRef = useRef<any>(null);
  const videoRef = useRef<any>(null);

  const stopTracks = () => {
    if (streamRef.current && typeof streamRef.current.getTracks === 'function') {
      streamRef.current.getTracks().forEach((track: any) => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {
          console.warn('Track stop error:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setLocalStream(null);
  };

  // Request camera and microphone permissions on call start
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        })
        .then((stream) => {
          streamRef.current = stream;
          setLocalStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn('Patient camera/mic permission not granted:', err);
        });
    }

    return () => {
      stopTracks();
    };
  }, []);

  // Sync stream to video ref
  useEffect(() => {
    const activeStream = streamRef.current || localStream;
    if (activeStream && videoRef.current && videoRef.current.srcObject !== activeStream) {
      videoRef.current.srcObject = activeStream;
    }
  }, [localStream, isCamOn]);

  const handleToggleMic = () => {
    const next = !isMicOn;
    setIsMicOn(next);
    const activeStream = streamRef.current || localStream;
    if (activeStream && typeof activeStream.getAudioTracks === 'function') {
      activeStream.getAudioTracks().forEach((track: any) => {
        track.enabled = next;
      });
    }
  };

  const handleToggleCam = () => {
    const next = !isCamOn;
    setIsCamOn(next);
    const activeStream = streamRef.current || localStream;
    if (activeStream && typeof activeStream.getVideoTracks === 'function') {
      activeStream.getVideoTracks().forEach((track: any) => {
        track.enabled = next;
      });
    }
  };

  const handleEnd = () => {
    haptic.warning();
    stopTracks();
    onEndCall();
  };

  const cycleNetworkTier = () => setNetworkTier(NEXT_TIER[networkTier]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const tierLabel = networkTier === 'hd' ? t('networkHd') : networkTier === 'audio' ? t('networkAudio') : t('networkOffline');
  const overlayTop = insets.top + spacing.md;

  return (
    <View style={styles.callContainer}>
      {/* Video stage */}
      <View style={styles.videoStage}>
        {networkTier !== 'async' ? (
          <Image
            source={{ uri: DOCTOR_FEED_URL }}
            style={[styles.doctorFeedImage, networkTier === 'audio' && styles.dimmedImage]}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.cameraOffPlaceholder}>
            <View style={styles.avatarPlaceholder}>
              <Icon name="person" size={44} color={colors.onTint} />
            </View>
            <AppText variant="title" color="onTint">
              {doctorName}
            </AppText>
            <AppText variant="footnote" weight={500} color="gray2">
              {t('audioPrioritized')}
            </AppText>
          </View>
        )}

        {/* Weak-network audio waveform */}
        {networkTier === 'audio' && (
          <View style={styles.audioWaveOverlay}>
            <View style={styles.waveRow}>
              {[20, 38, 26, 48, 24].map((h, i) => (
                <View key={i} style={[styles.waveBar, { height: h }]} />
              ))}
            </View>
            <GlassSurface material="dark" style={styles.glassPill}>
              <AppText variant="footnote" weight={600} color="onTint" compact>
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
            <GlassSurface material="dark" style={styles.glassPill}>
              <View style={[styles.statusDot, { backgroundColor: TIER_COLOR[networkTier] }]} />
              <AppText variant="caption" weight={600} color="onTint" compact>
                {tierLabel}
              </AppText>
            </GlassSurface>
          </Pressable>

          <GlassSurface material="dark" style={styles.glassPill}>
            <View style={[styles.statusDot, styles.recordingDot]} />
            <AppText variant="mono" color="onTint" style={styles.tabular}>
              {formatTimer(callSeconds)}
            </AppText>
          </GlassSurface>
        </View>

        {/* Clinician info */}
        <GlassSurface material="dark" style={[styles.doctorInfo, { top: overlayTop + 48 }]}>
          <AppText variant="subhead" weight={700} color="onTint" numberOfLines={1}>
            {doctorName}
          </AppText>
          <AppText variant="caption" color="gray3" numberOfLines={1}>
            {t('telehealthBrand')}
          </AppText>
        </GlassSurface>

        {/* Self picture-in-picture with the live camera on web */}
        <View style={[styles.selfPip, { top: overlayTop + 48 }]}>
          {Platform.OS === 'web' && localStream && isCamOn ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
          ) : isCamOn ? (
            <Image source={{ uri: SELF_PIP_URL }} style={styles.pipImage} accessibilityIgnoresInvertColors />
          ) : (
            <View style={styles.pipOff}>
              <Icon name="videocam-off" size={28} color={colors.gray2} />
            </View>
          )}
          <View style={styles.pipLabel}>
            <AppText variant="caption" weight={600} color="onTint" compact>
              {t('you')}
            </AppText>
          </View>
        </View>

        {/* Live translated caption */}
        <View style={styles.captionContainer}>
          <GlassSurface material="dark" style={styles.captionBanner}>
            <Icon name="auto-awesome" size={16} color="#64D2FF" />
            <AppText variant="subhead" weight={500} color="onTint" style={styles.captionText}>
              {t('liveCaption')}
            </AppText>
          </GlassSurface>
        </View>
      </View>

      {/* Floating call controls */}
      <View style={[styles.controlsContainer, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}>
        <GlassSurface material="dark" style={styles.controlsPill}>
          <IconButton
            icon={isMicOn ? 'mic' : 'mic-off'}
            tone={isMicOn ? 'dark' : 'darkOff'}
            size={52}
            iconSize={24}
            selected={!isMicOn}
            accessibilityLabel={isMicOn ? t('muteMic') : t('unmuteMic')}
            onPress={handleToggleMic}
            haptics
          />
          <IconButton
            icon={isCamOn ? 'videocam' : 'videocam-off'}
            tone={isCamOn ? 'dark' : 'darkOff'}
            size={52}
            iconSize={24}
            selected={!isCamOn}
            accessibilityLabel={isCamOn ? t('cameraOff') : t('cameraOn')}
            onPress={handleToggleCam}
            haptics
          />
          <IconButton
            icon="network-check"
            tone="dark"
            size={52}
            iconSize={24}
            accessibilityLabel={t('switchNetworkTier')}
            onPress={cycleNetworkTier}
            haptics
          />
          <IconButton icon="call-end" tone="red" size={60} iconSize={28} accessibilityLabel={t('endCall')} onPress={handleEnd} />
        </GlassSurface>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  callContainer: {
    flex: 1,
    backgroundColor: colors.black,
  },
  videoStage: {
    flex: 1,
    backgroundColor: colors.dark,
    overflow: 'hidden',
  },
  doctorFeedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  dimmedImage: {
    opacity: 0.25,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioWaveOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    gap: spacing.lg,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  waveBar: {
    width: 5,
    backgroundColor: colors.green,
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
    backgroundColor: colors.red,
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
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: colors.dark,
    ...shadows.lg,
  },
  pipImage: {
    width: '100%',
    height: '100%',
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
    backgroundColor: colors.black,
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
