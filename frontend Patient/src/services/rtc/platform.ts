/* eslint-disable @typescript-eslint/no-require-imports */
import type { RtcApi } from './callSession';

/**
 * Phones: WebRTC comes from react-native-webrtc, which needs a development / EAS build.
 * In Expo Go its native module is missing and the import throws, so `rtc` stays null
 * and the call screen explains that video needs the app build.
 */
let lib: any = null;
try {
  lib = require('react-native-webrtc');
} catch (err) {
  if (__DEV__) console.warn('[Call] react-native-webrtc unavailable (Expo Go?). Video calls need a development build.', err);
}

export const rtc: RtcApi | null = lib
  ? { RTCPeerConnection: lib.RTCPeerConnection, RTCIceCandidate: lib.RTCIceCandidate, RTCSessionDescription: lib.RTCSessionDescription }
  : null;

/** Front camera + mic. */
export const getLocalMedia = (): Promise<any> => {
  if (!lib) return Promise.reject(new Error('webrtc-unavailable'));
  return lib.mediaDevices.getUserMedia({
    audio: true,
    video: { facingMode: 'user', width: 640, height: 480, frameRate: 24 },
  });
};

/** Native renderer for a stream (null when WebRTC isn't available). */
export const NativeRTCView: any = lib ? lib.RTCView : null;
