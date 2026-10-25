// Phones (installed app): reading camera frames needs a native camera module (e.g. react-native-vision-camera
// with a frame processor), which this app doesn't include yet. The heart rate check runs in the web app.
import type { ColorSample } from './heartRate';
import type { CameraCapture } from './heartRateCamera';

export type { CameraCapture };
export const CAMERA_HEART_RATE_SUPPORTED = false;

export async function startFingertipCapture(_onSample: (s: ColorSample) => void): Promise<CameraCapture> {
  throw new Error('Camera heart rate is not available in the installed app yet.');
}
