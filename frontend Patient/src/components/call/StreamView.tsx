import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { NativeRTCView } from '../../services/rtc/platform';

export interface StreamViewProps {
  stream: any;
  /** Mirror (selfie view). */
  mirror?: boolean;
  /** Mute playback (always for your own camera, to avoid echo). Native local streams are never played back. */
  muted?: boolean;
  /** Draw above a sibling video (the picture-in-picture tile). */
  overlay?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Phones: renders a WebRTC stream with react-native-webrtc's RTCView. */
export const StreamView: React.FC<StreamViewProps> = ({ stream, mirror = false, overlay = false, style }) => {
  if (!NativeRTCView || !stream) return <View style={[styles.fill, style]} />;
  return (
    <NativeRTCView
      streamURL={stream.toURL()}
      mirror={mirror}
      objectFit="cover"
      zOrder={overlay ? 1 : 0}
      style={[styles.fill, style]}
    />
  );
};

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%', backgroundColor: '#000' },
});
