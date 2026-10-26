// GENERATED COPY of shared/call/ringtone.ts. Do not edit here: edit shared/call/ringtone.ts,
// then run `node scripts/sync-call-engine.mjs`.

// Ring and ring-back tones made with Web Audio (no sound files to ship).

type Tone = 'incoming' | 'ringback';

/** Starts a repeating tone; returns a function that stops it. Silent if the browser blocks audio. */
export function startTone(kind: Tone): () => void {
  let ctx: AudioContext | null = null;
  let timer: number | undefined;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctx();
  } catch {
    return () => undefined;
  }
  const audio = ctx;

  const beep = (freqs: number[], start: number, length: number, volume: number) => {
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.setValueAtTime(volume, start + length - 0.05);
    gain.gain.linearRampToValueAtTime(0, start + length);
    gain.connect(audio.destination);
    for (const f of freqs) {
      const osc = audio.createOscillator();
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + length);
    }
  };

  const ring = () => {
    if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
    const t = audio.currentTime + 0.05;
    if (kind === 'incoming') {          // two short rings, like a phone
      beep([440, 480], t, 0.4, 0.18);
      beep([440, 480], t + 0.6, 0.4, 0.18);
    } else {                            // quieter ring-back for the caller
      beep([440, 480], t, 1.0, 0.06);
    }
  };
  ring();
  timer = window.setInterval(ring, kind === 'incoming' ? 2500 : 3000);

  return () => {
    window.clearInterval(timer);
    timer = undefined;
    void audio.close().catch(() => undefined);
  };
}
