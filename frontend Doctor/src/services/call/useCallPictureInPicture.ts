// Hook for Picture-in-Picture (PiP) functionality during consultation calls.
// Automatically shifts call video to PiP mode when the doctor switches browser tabs,
// provides interactive controls (mic, camera, hangup) via MediaSession in native PiP,
// and supports manual PiP toggling for both video and audio-only consultations.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConsultationCallApi } from './useConsultationCall';

interface Options {
  call: ConsultationCallApi;
  peerName?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  enabled?: boolean;
}

export function useCallPictureInPicture({ call, peerName, videoRef, enabled = true }: Options) {
  const [isPipActive, setIsPipActive] = useState(false);
  const [pipSupported] = useState<boolean>(() => {
    return typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
  });

  const callRef = useRef(call);
  useEffect(() => {
    callRef.current = call;
  }, [call]);
  const inCall = call.callState === 'in_call';

  // Audio-only calls: generate a lightweight canvas video stream with patient avatar/pulse
  // so Picture-in-Picture can still be entered by the browser even without an incoming video track.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [audioVideoStream, setAudioVideoStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!inCall || call.remoteHasVideo) {
      if (audioVideoStream) {
        audioVideoStream.getTracks().forEach((t) => t.stop());
        setAudioVideoStream(null);
      }
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;
    const name = peerName || call.peerName || 'Patient';
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const draw = () => {
      t += 0.04;
      // Gradient background
      const grad = ctx.createLinearGradient(0, 0, 640, 360);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#134e4a');
      grad.addColorStop(1, '#022c22');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 360);

      // Pulsing concentric circles
      const pulse1 = Math.sin(t) * 12 + 65;
      const pulse2 = Math.sin(t + 0.5) * 18 + 80;
      ctx.beginPath();
      ctx.arc(320, 160, pulse2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20, 184, 166, 0.15)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(320, 160, pulse1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20, 184, 166, 0.28)';
      ctx.fill();

      // Avatar circle
      ctx.beginPath();
      ctx.arc(320, 160, 52, 0, Math.PI * 2);
      ctx.fillStyle = '#0d9488';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#5eead4';
      ctx.stroke();

      // Initials
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, 320, 160);

      // Name & status
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 22px system-ui, -apple-system, sans-serif';
      ctx.fillText(name, 320, 245);

      ctx.fillStyle = '#5eead4';
      ctx.font = '500 15px system-ui, -apple-system, sans-serif';
      ctx.fillText('Audio Consultation Active', 320, 275);

      animId = requestAnimationFrame(draw);
    };

    draw();

    try {
      const stream = canvas.captureStream(15);
      setAudioVideoStream(stream);
    } catch {
      // captureStream not supported in this environment
    }

    return () => {
      cancelAnimationFrame(animId);
      if (audioVideoStream) {
        audioVideoStream.getTracks().forEach((trk) => trk.stop());
      }
    };
  }, [inCall, call.remoteHasVideo, peerName, call.peerName]);

  // Sync MediaSession action handlers (Hang Up, Mute/Unmute Mic, Camera Toggle)
  // Modern browsers (Chrome/Edge) render these interactive buttons directly inside Picture-in-Picture!
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (inCall) {
      const displayName = peerName || call.peerName || 'Patient';
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `Consultation with ${displayName}`,
          artist: 'CareBridge Telehealth',
          album: call.withVideo ? 'Video Call' : 'Audio Call',
        });
      } catch {}

      const setAction = (action: string, handler: (() => void) | null) => {
        try {
          (navigator.mediaSession.setActionHandler as (act: string, fn: (() => void) | null) => void)(action, handler);
        } catch {}
      };

      setAction('hangup', () => {
        callRef.current.endCall();
      });

      setAction('togglemicrophone', () => {
        callRef.current.toggleMic();
      });

      setAction('togglecamera', () => {
        callRef.current.toggleCam();
      });

      // Play / Pause fallback for some OS PiP players
      setAction('pause', () => {
        callRef.current.toggleMic();
      });
      setAction('play', () => {
        callRef.current.toggleMic();
      });
    } else {
      const setAction = (action: string, handler: (() => void) | null) => {
        try {
          (navigator.mediaSession.setActionHandler as (act: string, fn: (() => void) | null) => void)(action, handler);
        } catch {}
      };

      setAction('hangup', null);
      setAction('togglemicrophone', null);
      setAction('togglecamera', null);
      setAction('pause', null);
      setAction('play', null);
    }
  }, [inCall, peerName, call.peerName, call.withVideo]);

  // Monitor document picture-in-picture events
  useEffect(() => {
    const onEnterPip = () => setIsPipActive(true);
    const onLeavePip = () => setIsPipActive(false);

    document.addEventListener('enterpictureinpicture', onEnterPip);
    document.addEventListener('leavepictureinpicture', onLeavePip);

    return () => {
      document.removeEventListener('enterpictureinpicture', onEnterPip);
      document.removeEventListener('leavepictureinpicture', onLeavePip);
    };
  }, []);

  // Automatic PiP when doctor changes browser tab
  useEffect(() => {
    if (!enabled || !inCall || !pipSupported) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        // Tab changed/minimized: automatically shift call to PiP mode
        if (document.pictureInPictureElement) return;

        // Try candidate videos: explicitly passed ref, or query for call video elements
        const candidate =
          videoRef?.current ||
          document.querySelector<HTMLVideoElement>('video[data-call-pip-target="true"]') ||
          document.querySelector<HTMLVideoElement>('video.cc-remote') ||
          document.querySelector<HTMLVideoElement>('video[autoPlay]');

        if (candidate && candidate.readyState >= 1) {
          try {
            await candidate.requestPictureInPicture();
          } catch {
            // User gesture may be required on some platforms without autoPictureInPicture
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, inCall, pipSupported, videoRef]);

  // Manual toggle Picture-in-Picture
  const togglePip = useCallback(
    async (targetElement?: HTMLVideoElement | null) => {
      if (!pipSupported) return false;

      if (document.pictureInPictureElement) {
        try {
          await document.exitPictureInPicture();
          setIsPipActive(false);
          return false;
        } catch {
          return false;
        }
      }

      const el =
        targetElement ||
        videoRef?.current ||
        document.querySelector<HTMLVideoElement>('video[data-call-pip-target="true"]') ||
        document.querySelector<HTMLVideoElement>('video.cc-remote') ||
        document.querySelector<HTMLVideoElement>('video[autoPlay]');

      if (el) {
        try {
          await el.requestPictureInPicture();
          setIsPipActive(true);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    [pipSupported, videoRef],
  );

  return {
    isPipActive,
    togglePip,
    pipSupported,
    audioVideoStream,
  };
}
