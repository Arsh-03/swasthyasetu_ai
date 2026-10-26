// Web build: the browser has WebRTC built in. (Phones: see webrtcPlatform.native.tsx.)
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** True when real calls can run here. */
export function enableWebRTC(): boolean {
  return typeof RTCPeerConnection !== 'undefined' && !!globalThis.navigator?.mediaDevices?.getUserMedia;
}

export interface CallVideoProps {
  stream: MediaStream | null;
  mirror?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Not used on the web (the call screen uses a <video> element there). */
export const NativeCallVideo: React.FC<CallVideoProps> | null = null;
