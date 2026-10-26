// Heart rate from a fingertip on the camera (photoplethysmography, PPG).
// Each heartbeat pushes blood into the fingertip, which changes how much light it lets through; the camera
// sees this as a tiny rhythmic change in brightness. This file turns per-frame average colours into a
// heart rate estimate plus a quality score. Pure TypeScript (no React Native), so it is unit-tested directly.
//
// It is an estimate for the doctor's reference, not a medical device reading.

export interface ColorSample { t: number; r: number; g: number; b: number } // t in ms

export type Confidence = 'good' | 'fair' | 'poor';

export interface HeartRateResult {
  bpm: number;
  confidence: Confidence;
  /** 0..1: share of the pulse band's power at the detected rate (higher = cleaner signal). */
  quality: number;
  /** Beat-to-beat variation (coefficient of variation of intervals); for the doctor, never shown as a diagnosis. */
  irregularity: number | null;
  beats: number;
  seconds: number;
  channel: 'red' | 'green';
}

const FS = 30; // resample rate (Hz)
const MIN_HZ = 0.7; // 42 bpm
const MAX_HZ = 3.5; // 210 bpm

/** Is the camera covered by a fingertip? (Red dominates; with the flash on it is bright red.) */
export function fingerOnCamera(s: ColorSample): boolean {
  return s.r > 45 && s.r > s.g * 1.4 && s.r > s.b * 1.4;
}

/** Uniformly resampled channel values (linear interpolation over uneven frame times). */
function resample(samples: ColorSample[], pick: (s: ColorSample) => number): number[] {
  const out: number[] = [];
  if (samples.length < 2) return out;
  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t;
  let j = 0;
  for (let t = t0; t <= t1; t += 1000 / FS) {
    while (j < samples.length - 2 && samples[j + 1].t < t) j++;
    const a = samples[j];
    const b = samples[j + 1];
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    out.push(pick(a) + (pick(b) - pick(a)) * Math.min(1, Math.max(0, f)));
  }
  return out;
}

function movingAverage(x: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  const out = new Array<number>(x.length);
  let sum = 0;
  let count = 0;
  let lo = 0;
  let hi = -1;
  for (let i = 0; i < x.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(x.length - 1, i + half);
    while (hi < end) { hi++; sum += x[hi]; count++; }
    while (lo < start) { sum -= x[lo]; lo++; count--; }
    out[i] = sum / count;
  }
  return out;
}

/** Remove slow drift (pressure, light changes) and fast noise: a simple band-pass made of moving averages. */
export function bandPass(x: number[]): number[] {
  const trend = movingAverage(x, Math.round(FS * 1.2));
  const detrended = x.map((v, i) => v - trend[i]);
  return movingAverage(detrended, 3);
}

/** Power at each frequency in the pulse band (direct DFT; the signal is short, so this is cheap). */
function spectrum(x: number[]): { hz: number; power: number }[] {
  const out: { hz: number; power: number }[] = [];
  const n = x.length;
  // Hann window reduces leakage from the start/end of the recording.
  const w = x.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
  for (let hz = MIN_HZ; hz <= MAX_HZ + 1e-9; hz += 0.01) {
    let re = 0;
    let im = 0;
    const k = (2 * Math.PI * hz) / FS;
    for (let i = 0; i < n; i++) { re += w[i] * Math.cos(k * i); im -= w[i] * Math.sin(k * i); }
    out.push({ hz, power: re * re + im * im });
  }
  return out;
}

function std(x: number[]): number {
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length);
}

/** Beat times (sample indexes) from local maxima at least 0.3 s apart and clearly above the noise. */
function findBeats(x: number[], expectedHz: number): number[] {
  const minGap = Math.max(Math.round(FS * 0.3), Math.round((FS / expectedHz) * 0.6));
  const threshold = 0.25 * std(x);
  const peaks: number[] = [];
  for (let i = 2; i < x.length - 2; i++) {
    if (x[i] > threshold && x[i] >= x[i - 1] && x[i] >= x[i + 1] && x[i] >= x[i - 2] && x[i] >= x[i + 2]) {
      if (peaks.length && i - peaks[peaks.length - 1] < minGap) {
        if (x[i] > x[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = i;
      } else {
        peaks.push(i);
      }
    }
  }
  return peaks;
}

/** Peak position between frames (parabola through the peak and its neighbours): 30 fps alone is too coarse for beat timing. */
function refine(x: number[], i: number): number {
  const a = x[i - 1], b = x[i], c = x[i + 1];
  const d = a - 2 * b + c;
  return d === 0 ? i : i + (0.5 * (a - c)) / d;
}

function analyseChannel(samples: ColorSample[], channel: 'red' | 'green') {
  const raw = resample(samples, (s) => (channel === 'red' ? s.r : s.g));
  // Blood absorbs light: more blood = darker. Invert so each beat is a peak.
  const x = bandPass(raw.map((v) => -v));
  const spec = spectrum(x);
  const total = spec.reduce((a, s) => a + s.power, 0) || 1;
  let best = spec[0];
  for (const s of spec) if (s.power > best.power) best = s;
  // The second harmonic can win on sharp pulse shapes: prefer half the frequency when it is nearly as strong.
  const half = spec.find((s) => Math.abs(s.hz - best.hz / 2) < 0.006);
  if (half && half.power > best.power * 0.5) best = half;
  const near = spec.filter((s) => Math.abs(s.hz - best.hz) <= 0.08).reduce((a, s) => a + s.power, 0);
  const harmonic = spec.filter((s) => Math.abs(s.hz - best.hz * 2) <= 0.08).reduce((a, s) => a + s.power, 0);
  const quality = Math.min(1, (near + harmonic) / total);
  return { x, hz: best.hz, quality };
}

/**
 * Heart rate from at least ~15 s of fingertip samples. Returns null when there isn't enough data.
 * `confidence: 'poor'` means "don't use this number": ask the patient to measure again.
 */
export function estimateHeartRate(samples: ColorSample[]): HeartRateResult | null {
  if (samples.length < 2) return null;
  const seconds = (samples[samples.length - 1].t - samples[0].t) / 1000;
  if (seconds < 8) return null;

  const red = analyseChannel(samples, 'red');
  const green = analyseChannel(samples, 'green');
  const pick = green.quality > red.quality ? { ...green, channel: 'green' as const } : { ...red, channel: 'red' as const };

  const beats = findBeats(pick.x, pick.hz).map((i) => refine(pick.x, i));
  const intervals = beats.slice(1).map((b, i) => (b - beats[i]) / FS);
  const plausible = intervals.filter((iv) => iv > 0.28 && iv < 1.6);
  let peaksBpm: number | null = null;
  let irregularity: number | null = null;
  if (plausible.length >= 4) {
    const sorted = [...plausible].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    // The average interval, not the median: with an irregular rhythm the average is the true rate.
    // Gaps far from the typical one are missed or extra beats (detection errors), so they are left out.
    const kept = plausible.filter((v) => v > median * 0.6 && v < median * 1.5);
    const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
    peaksBpm = 60 / mean;
    // Robust spread (median absolute deviation): one slightly misplaced peak must not look like an irregular rhythm.
    const dev = plausible.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
    irregularity = (1.4826 * dev[Math.floor(dev.length / 2)]) / median;
  }

  const fftBpm = pick.hz * 60;
  const agree = peaksBpm !== null && Math.abs(peaksBpm - fftBpm) <= 8;
  // Irregular rhythms spread the spectrum, so the beat count is the better rate there.
  const bpm = Math.round(agree ? (irregularity !== null && irregularity > 0.1 ? peaksBpm! : (fftBpm + peaksBpm!) / 2) : fftBpm);
  // The number of beats found must fit the rate (noise makes random, too few or too many peaks).
  const expectedBeats = (bpm * seconds) / 60;
  const beatsFit = Math.abs(beats.length - expectedBeats) <= Math.max(3, expectedBeats * 0.2);
  let confidence: Confidence = 'poor';
  if (pick.quality >= 0.35 && agree && beatsFit && seconds >= 20) confidence = 'good';
  else if (pick.quality >= 0.25 && agree && beatsFit) confidence = 'fair';
  // Noise looks like a weak signal with scattered "beats": refuse rather than show a made-up number.
  if (irregularity !== null && irregularity > 0.24 && pick.quality < 0.4) confidence = 'poor';

  return {
    bpm,
    confidence,
    quality: Math.round(pick.quality * 100) / 100,
    irregularity: irregularity === null ? null : Math.round(irregularity * 100) / 100,
    beats: beats.length,
    seconds: Math.round(seconds),
    channel: pick.channel,
  };
}

/** The last `seconds` of the band-passed signal, scaled to 0..1 (for the live waveform). */
export function waveform(samples: ColorSample[], seconds = 5): number[] {
  const recent = samples.filter((s) => s.t >= samples[samples.length - 1].t - seconds * 1000 - 1500);
  if (recent.length < FS) return [];
  const x = bandPass(resample(recent, (s) => -s.r)).slice(-seconds * FS);
  const lo = Math.min(...x);
  const hi = Math.max(...x);
  return x.map((v) => (hi === lo ? 0.5 : (v - lo) / (hi - lo)));
}
