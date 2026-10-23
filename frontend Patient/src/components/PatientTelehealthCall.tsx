import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { AppleTheme } from '../theme/tokens';

interface PatientTelehealthCallProps {
  doctorName: string;
  onEndCall: () => void;
  selectedLanguage: 'kn' | 'hi' | 'en';
}

export const PatientTelehealthCall: React.FC<PatientTelehealthCallProps> = ({
  onEndCall,
  selectedLanguage,
  doctorName,
}) => {
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [networkTier, setNetworkTier] = useState<'hd' | 'audio' | 'async'>('hd');

  // WebRTC Local Media Stream for Patient
  const [localStream, setLocalStream] = useState<any>(null);
  const streamRef = useRef<any>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
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
          setHasPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn('Patient camera/mic permission not granted:', err);
          setHasPermission(false);
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
    stopTracks();
    onEndCall();
  };

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

  return (
    <View style={styles.callContainer}>
      {/* Video Stage */}
      <View style={styles.videoStage}>
        {networkTier !== 'async' ? (
          <Image
            source={{
              uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCNL4BMuLtJ2i8g6NTnwHeQCHuAOBoVH2a0-_LYQNHlpps-NYI7Zm0kJOS83_2mfT6iW0VmrLR_Ws1XWJQkqFvMdbLIdoytlvHdKWy4oymsMvJiix6ZCfnabbIW2pz4OVbBjAvjRwZlJrf3ptnODgtdPMIvvwU5TOI47tgVHvDdfaHFPeZZKaZ1uf0iQ6sHQIuhtUA6yt256idRVh9J47qEBF8ZhGzRWVzPeff2xX0xQ_aOPSGolBYQfw',
            }}
            style={[styles.doctorFeedImage, networkTier === 'audio' && styles.blurredImage]}
          />
        ) : (
          <View style={styles.cameraOffPlaceholder}>
            <View style={styles.avatarPlaceholder}>
              <Text style={{ fontSize: 44 }}>👩‍⚕️</Text>
            </View>
            <Text style={styles.doctorNameText}>{doctorName}</Text>
            <Text style={styles.cameraOffText}>Audio Prioritized Telehealth • 50 kbps</Text>
          </View>
        )}

        {/* Audio Waveform overlay if in weak network mode */}
        {networkTier === 'audio' && (
          <View style={styles.audioWaveOverlay}>
            <View style={styles.waveRow}>
              <View style={[styles.waveBar, { height: 20 }]} />
              <View style={[styles.waveBar, { height: 38 }]} />
              <View style={[styles.waveBar, { height: 26 }]} />
              <View style={[styles.waveBar, { height: 48 }]} />
              <View style={[styles.waveBar, { height: 24 }]} />
            </View>
            <View style={styles.lowBandwidthBadge}>
              <Text style={styles.lowBandwidthText}>Weak Signal • Audio Prioritized</Text>
            </View>
          </View>
        )}

        {/* iOS Dynamic Status Pill (Top Center) */}
        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              setNetworkTier(networkTier === 'hd' ? 'audio' : networkTier === 'audio' ? 'async' : 'hd')
            }
            style={styles.networkBadge}
          >
            <View
              style={[
                styles.networkDot,
                {
                  backgroundColor:
                    networkTier === 'hd'
                      ? AppleTheme.colors.systemGreen
                      : networkTier === 'audio'
                      ? AppleTheme.colors.systemOrange
                      : AppleTheme.colors.systemRed,
                },
              ]}
            />
            <Text style={styles.networkText}>
              {networkTier === 'hd'
                ? 'HD 450 kbps'
                : networkTier === 'audio'
                ? 'Audio 50 kbps'
                : 'Offline Sync'}
            </Text>
          </TouchableOpacity>

          <View style={styles.callTimerBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.callTimerText}>{formatTimer(callSeconds)}</Text>
          </View>
        </View>

        {/* Clinician Info Overlay */}
        <View style={styles.doctorInfoOverlay}>
          <Text style={styles.doctorOverlayName}>{doctorName}</Text>
          <Text style={styles.doctorOverlaySpecialty}>SwasthyaSetu Telehealth</Text>
        </View>

        {/* Patient Self-PIP (Floating iOS Window with Live Camera Stream) */}
        <View style={styles.selfPip}>
          {Platform.OS === 'web' && localStream && isCamOn ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
              }}
            />
          ) : (
            <Image
              source={{
                uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAMknnrL1azNBnB58uMox-l1CcLlCOqWvUimLBiLkJDaWKKrtkqvKnzs2xdOeVF8iSMHpTSk0ENugY-yF1k0JbvFHTOYCtzwJVjaqx9vKZdAogAGrJm1fLfa22lW6sdm1aSSRYxv0craALN6s1BZNS6itFWOoWj_QWMP-wF772FTz5PEDVqxhkesTSt97veSZTFlDJhJgLUmUjUgo1fQDzUqUL_PXosFUri_P1ve9yPukx2vFxzlUA5NQ',
              }}
              style={styles.pipImage}
            />
          )}
          <View style={styles.pipLabelContainer}>
            <Text style={styles.pipLabel}>You</Text>
          </View>
        </View>

        {/* Live Subtitle / Translation Banner (Apple Intelligence style pill) */}
        <View style={styles.captionContainer}>
          <View style={styles.captionBanner}>
            <Text style={styles.captionSparkle}>✨</Text>
            <Text style={styles.captionText}>
              {selectedLanguage === 'kn'
                ? 'ಡಾಕ್ಟರ್: "ಜ್ವರ ಕಡಿಮೆಯಾಗಲು ಪ್ಯಾರಸಿಟಮಾಲ್ 650mg ತೆಗೆದುಕೊಳ್ಳಿ"'
                : selectedLanguage === 'hi'
                ? 'डॉक्टर: "बुखार कम करने के लिए पैरासिटामोल 650mg लें"'
                : 'Doctor: "Take Paracetamol 650mg after meals for fever"'}
            </Text>
          </View>
        </View>
      </View>

      {/* Floating Bottom FaceTime Controls (Liquid Glass functional layer) */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlsGlassPill}>
          {/* Mute Mic */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleToggleMic}
            style={[styles.controlButton, !isMicOn && styles.controlButtonOff]}
          >
            <Text style={styles.controlEmoji}>{isMicOn ? '🎙️' : '🔇'}</Text>
          </TouchableOpacity>

          {/* Toggle Camera */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleToggleCam}
            style={[styles.controlButton, !isCamOn && styles.controlButtonOff]}
          >
            <Text style={styles.controlEmoji}>{isCamOn ? '📹' : '🚫'}</Text>
          </TouchableOpacity>

          {/* Switch Network Tier */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              setNetworkTier(networkTier === 'hd' ? 'audio' : networkTier === 'audio' ? 'async' : 'hd')
            }
            style={styles.controlButton}
          >
            <Text style={styles.controlEmoji}>📶</Text>
          </TouchableOpacity>

          {/* End Call / Hang Up */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleEnd}
            style={styles.hangupButton}
          >
            <Text style={styles.hangupEmoji}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  callContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  videoStage: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#1C1C1E',
    overflow: 'hidden',
  },
  doctorFeedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  blurredImage: {
    opacity: 0.25,
  },
  cameraOffPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorNameText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'System',
  },
  cameraOffText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  audioWaveOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  waveBar: {
    width: 5,
    backgroundColor: AppleTheme.colors.systemGreen,
    borderRadius: 2.5,
  },
  lowBandwidthBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  lowBandwidthText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  topBar: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(28, 28, 30, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  networkDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  networkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  callTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(28, 28, 30, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AppleTheme.colors.systemRed,
  },
  callTimerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'monospace',
  },
  doctorInfoOverlay: {
    position: 'absolute',
    top: 68,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  doctorOverlayName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  doctorOverlaySpecialty: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  selfPip: {
    position: 'absolute',
    top: 68,
    right: 20,
    width: 96,
    height: 136,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: '#1C1C1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  pipImage: {
    width: '100%',
    height: '100%',
  },
  pipLabelContainer: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  captionContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  captionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  captionSparkle: {
    fontSize: 13,
  },
  captionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
    lineHeight: 18,
  },
  controlsContainer: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 16,
    backgroundColor: '#000000',
  },
  controlsGlassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: 'rgba(28, 28, 30, 0.92)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 40,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonOff: {
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
  },
  controlEmoji: {
    fontSize: 20,
  },
  hangupButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: AppleTheme.colors.systemRed,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppleTheme.colors.systemRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  hangupEmoji: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
