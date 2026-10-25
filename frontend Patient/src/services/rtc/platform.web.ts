import type { RtcApi } from './callSession';

/** Web: the browser's own WebRTC. Camera access needs https:// or localhost. */
const hasWebRtc = typeof window !== 'undefined' && typeof window.RTCPeerConnection === 'function';

export const rtc: RtcApi | null = hasWebRtc
  ? { RTCPeerConnection: window.RTCPeerConnection, RTCIceCandidate: window.RTCIceCandidate, RTCSessionDescription: window.RTCSessionDescription }
  : null;

export const getLocalMedia = (): Promise<MediaStream> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    // Browsers hide getUserMedia on plain-http pages other than localhost
    return Promise.reject(new Error('insecure-context'));
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  });
};

export const NativeRTCView = null;
