// Phones (iOS / Android): real calls use react-native-webrtc, which needs a development build
// (`npx expo run:android` / `eas build --profile development`). Expo Go doesn't include it, so there
// enableWebRTC() returns false and the app explains where calls work instead of crashing.
import React from 'react';
import { NativeModules } from 'react-native';
import type { CallVideoProps } from './webrtcPlatform';

type WebRTCModule = typeof import('react-native-webrtc');
let webrtc: WebRTCModule | null = null;

/** True when real calls can run here; also installs the standard WebRTC globals the call engine uses. */
export function enableWebRTC(): boolean {
  if (webrtc) return true;
  if (!NativeModules.WebRTCModule) return false;        // Expo Go: the native module isn't compiled in
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    webrtc = require('react-native-webrtc') as WebRTCModule;
    webrtc.registerGlobals();                           // RTCPeerConnection, navigator.mediaDevices, MediaStream...
    return true;
  } catch {
    webrtc = null;
    return false;
  }
}

/** Shows a call stream with the native video view. */
export const NativeCallVideo: React.FC<CallVideoProps> = ({ stream, mirror, style }) => {
  if (!webrtc || !stream) return null;
  const RTCView = webrtc.RTCView;
  const url = (stream as unknown as { toURL: () => string }).toURL();
  return <RTCView streamURL={url} objectFit="cover" mirror={mirror} style={[{ width: '100%', height: '100%' }, style]} />;
};
