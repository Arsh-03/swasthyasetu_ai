// Web: fingertip camera capture for the heart rate check. Back camera, flash on where the browser allows it
// (Chrome on Android), and the average colour of each frame. (Phones: heartRateCamera.native.ts.)
import type { ColorSample } from './heartRate';

export interface CameraCapture {
  /** True when the flash could be switched on (much clearer signal). */
  torch: boolean;
  stop: () => void;
}

export const CAMERA_HEART_RATE_SUPPORTED =
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof document !== 'undefined';

export async function startFingertipCapture(onSample: (s: ColorSample) => void): Promise<CameraCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } },
  });
  const track = stream.getVideoTracks()[0];
  let torch = false;
  try {
    const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
    if (caps.torch) {
      await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
      torch = true;
    }
  } catch { /* no flash control: room light through the finger still works, less clearly */ }

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();

  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 24;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  let stopped = false;

  const grab = () => {
    if (stopped) return;
    if (video.readyState >= 2) {
      // Centre of the frame (the fingertip), averaged over a small image.
      const w = video.videoWidth || 320;
      const h = video.videoHeight || 240;
      ctx.drawImage(video, w * 0.2, h * 0.2, w * 0.6, h * 0.6, 0, 0, 32, 24);
      const px = ctx.getImageData(0, 0, 32, 24).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
      const n = px.length / 4;
      onSample({ t: performance.now(), r: r / n, g: g / n, b: b / n });
    }
    schedule();
  };
  // One sample per video frame where supported, else per animation frame.
  const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
  const schedule = () => (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(grab) : requestAnimationFrame(grab));
  schedule();

  return {
    torch,
    stop: () => {
      stopped = true;
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
