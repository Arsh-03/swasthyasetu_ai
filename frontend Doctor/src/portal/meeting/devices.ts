// Camera / microphone / speaker choice for the meeting room, remembered between visits.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface DeviceChoice { audioInput: string; videoInput: string; audioOutput: string }

const KEY = 'meeting_devices';

function load(): DeviceChoice {
  try {
    return { audioInput: '', videoInput: '', audioOutput: '', ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { audioInput: '', videoInput: '', audioOutput: '' };
  }
}

export function useDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [choice, setChoiceState] = useState<DeviceChoice>(load);
  const refresh = useCallback(async () => {
    try {
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch {
      setDevices([]);
    }
  }, []);
  useEffect(() => {
    void refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
  }, [refresh]);
  const setChoice = (patch: Partial<DeviceChoice>) => {
    setChoiceState((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  };
  const of = (kind: MediaDeviceKind) => devices.filter((d) => d.kind === kind && d.deviceId);
  return {
    microphones: of('audioinput'),
    cameras: of('videoinput'),
    speakers: of('audiooutput'),
    canPickSpeaker: typeof (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId === 'function',
    choice,
    setChoice,
    refresh,
  };
}

/** Live camera + microphone preview with a microphone level (0..1). Stops when disabled or unmounted. */
export function usePreview(enabled: boolean, camOn: boolean, choice: DeviceChoice, onPermission: () => void) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<'denied' | 'nodevice' | null>(null);
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let raf = 0;
    let ctx: AudioContext | null = null;
    const start = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: choice.audioInput ? { deviceId: { ideal: choice.audioInput } } : true,
          video: camOn ? (choice.videoInput ? { deviceId: { ideal: choice.videoInput } } : true) : false,
        });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        setStream(s);
        setError(null);
        onPermission();
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 64));
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        if (!cancelled) setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'nodevice');
      }
    };
    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      void ctx?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      setLevel(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, camOn, choice.audioInput, choice.videoInput]);

  return { stream, error, level };
}
