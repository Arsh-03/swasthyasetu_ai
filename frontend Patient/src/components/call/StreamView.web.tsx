import React, { useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { StreamViewProps } from './StreamView';

/** Web: plays a MediaStream in a <video> element. */
export const StreamView: React.FC<StreamViewProps & { style?: StyleProp<ViewStyle> }> = ({ stream, mirror = false, muted = false, style }) => {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream ?? null;
    // Autoplay with sound can be blocked until the user has interacted; the accept tap usually counts
    el.play?.().catch(() => {});
  }, [stream]);

  return (
    <View style={[{ width: '100%', height: '100%', backgroundColor: '#000' }, style]}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: mirror ? 'scaleX(-1)' : undefined }}
      />
    </View>
  );
};
