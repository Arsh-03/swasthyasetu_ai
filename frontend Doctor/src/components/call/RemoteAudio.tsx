import { useEffect, useRef } from 'react';

/** Plays the other person's voice. Mounted once at portal level, so it keeps playing on every tab;
 *  every <video> showing the call is muted to avoid hearing the voice twice. */
export function RemoteAudio({ stream, muted = false }: { stream: MediaStream | null; muted?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay muted={muted} style={{ display: 'none' }} />;
}
