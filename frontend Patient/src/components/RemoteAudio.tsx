import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Plays the doctor's voice (web build). Mounted once in App so it keeps playing on every screen;
 *  the call screen's <video> elements are muted so the voice is never heard twice. */
export const RemoteAudio: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  if (Platform.OS !== 'web') return null;
  return <audio ref={ref} autoPlay style={{ display: 'none' }} />;
};
