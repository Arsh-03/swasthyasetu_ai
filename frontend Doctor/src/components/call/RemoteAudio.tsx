import { useEffect, useRef } from 'react';

/** Plays the other person's voice. Mounted once at portal level, so it keeps playing on every tab;
 *  every <video> showing the call is muted to avoid hearing the voice twice.
 *  `sinkId` picks the speaker / headset (browsers that support setSinkId; others use the default). */
export function RemoteAudio({ stream, muted = false, sinkId }: { stream: MediaStream | null; muted?: boolean; sinkId?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  useEffect(() => {
    const el = ref.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (el?.setSinkId && sinkId !== undefined) el.setSinkId(sinkId).catch(() => { /* device gone: keep the default */ });
  }, [sinkId]);
  return <audio ref={ref} autoPlay muted={muted} style={{ display: 'none' }} />;
}
