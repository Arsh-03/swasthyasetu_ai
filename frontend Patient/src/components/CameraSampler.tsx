// Web: fingertip camera capture for the heart rate check (browser camera API). Phones: CameraSampler.native.tsx.
import React, { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { ColorSample } from '../services/heartRate';
import { startFingertipCapture, type CameraCapture } from '../services/heartRateCamera';

export interface CameraSamplerProps {
  /** Camera on while true; switched off (and the flash released) when false or unmounted. */
  active: boolean;
  onSample: (s: ColorSample) => void;
  onStarted: (torch: boolean) => void;
  onError: (kind: 'denied' | 'failed') => void;
  /** Phones show a small camera preview here; the web build has none. */
  style?: StyleProp<ViewStyle>;
}

export const CAMERA_SAMPLER_SUPPORTED =
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof document !== 'undefined';

export const CameraSampler: React.FC<CameraSamplerProps> = ({ active, onSample, onStarted, onError }) => {
  const handlers = useRef({ onSample, onStarted, onError });
  handlers.current = { onSample, onStarted, onError };
  useEffect(() => {
    if (!active) return;
    let capture: CameraCapture | null = null;
    let cancelled = false;
    startFingertipCapture((s) => handlers.current.onSample(s))
      .then((c) => {
        if (cancelled) { c.stop(); return; }
        capture = c;
        handlers.current.onStarted(c.torch);
      })
      .catch((err) => {
        const denied = err instanceof Error && /denied|NotAllowed/i.test(err.name + err.message);
        if (!cancelled) handlers.current.onError(denied ? 'denied' : 'failed');
      });
    return () => { cancelled = true; capture?.stop(); };
  }, [active]);
  return null;
};
