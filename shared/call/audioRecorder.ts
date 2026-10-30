// Records only this person's own microphone, in short self-contained chunks, and sends each chunk
// to the CareBridge server for transcription. Only runs after the patient has consented.
// Each chunk is a complete small file (the recorder restarts every CHUNK_MS), so the server can
// transcribe it on its own and then discard it.

import { authFetch } from '../backend';

// 5 s pieces keep the live assistant a few seconds behind the conversation (Whisper needs a few seconds of speech).
const CHUNK_MS = 5000;

/** Browsers can record audio chunks; phones (react-native-webrtc) can't, so there the doctor's app
 *  records the patient's voice from the call instead (still only with the patient's consent). */
export function canRecordAudio(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

function pickMimeType(): string {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export class ChunkRecorder {
  private active = false;
  private recorder: MediaRecorder | null = null;
  private offsetMs = 0;
  private readonly stream: MediaStream;
  private readonly sessionId: string;
  private readonly onError: (message: string) => void;
  private speaker: 'self' | 'patient' | 'doctor';
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private processedStream: MediaStream | null = null;
  private maxVoiceEnergy = 0;
  private voiceFramesCount = 0;
  private vadInterval: number | null = null;

  /** speaker 'self' = this person's own microphone; 'patient' = the doctor recording the patient's voice
   *  from the call (only when the patient's phone can't record, and only with the patient's consent);
   *  'doctor' = doctor role. In CHIBI Test Lab, speaker can be toggled dynamically between 'doctor' and 'patient'. */
  constructor(stream: MediaStream, sessionId: string, onError: (message: string) => void, speaker: 'self' | 'patient' | 'doctor' = 'self') {
    // Audio only: video is never recorded.
    this.stream = new MediaStream(stream.getAudioTracks());
    this.sessionId = sessionId;
    this.onError = onError;
    this.speaker = speaker;
    this.initAudioPipeline();
  }

  /** Web Audio processing: 100Hz highpass (kills fan/HVAC hum & desk bumps), 7000Hz lowpass (kills hiss),
   *  DynamicsCompressor (evens speech & suppresses background floor), and AnalyserNode for Voice Activity Detection
   *  (VAD) to avoid uploading dead air or transient clicks to Whisper. */
  private initAudioPipeline() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx || typeof MediaStreamAudioDestinationNode === 'undefined') return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') void ctx.resume();

      const source = ctx.createMediaStreamSource(this.stream);

      // High-pass filter at 100 Hz: cuts low frequency rumble, AC hum, desk vibrations, breathing pops
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 100;
      highpass.Q.value = 0.7;

      // Low-pass filter at 7000 Hz: cuts high-frequency electrical hiss and static
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 7000;
      lowpass.Q.value = 0.7;

      // Dynamic compressor: reduces dynamic range and dampens quiet room background floor
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -32;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.25;

      // Real-time voice band analyser (150 Hz to 3500 Hz for human vocal tract frequencies)
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;

      const destination = ctx.createMediaStreamDestination();

      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(analyser);
      lowpass.connect(compressor);
      compressor.connect(destination);

      this.audioCtx = ctx;
      this.analyser = analyser;
      this.processedStream = destination.stream;
    } catch {
      this.audioCtx = null;
      this.analyser = null;
      this.processedStream = null;
    }
  }

  setSpeaker(speaker: 'self' | 'patient' | 'doctor') {
    if (this.speaker === speaker) return;
    this.speaker = speaker;
    // If actively recording, cut the current chunk so speech is not mixed across roles
    if (this.active && this.recorder && this.recorder.state === 'recording') {
      try {
        this.recorder.stop();
      } catch { /* already stopped */ }
    }
  }

  getSpeaker(): 'self' | 'patient' | 'doctor' {
    return this.speaker;
  }

  start() {
    if (this.active || !this.stream.getAudioTracks().length || !canRecordAudio()) return;
    this.active = true;
    this.next();
  }

  private next() {
    // The call may have just ended (microphone switched off) a moment before stop() is called.
    if (!this.active || !this.stream.getAudioTracks().some(t => t.readyState === 'live')) {
      this.active = false;
      return;
    }
    const mimeType = pickMimeType();
    // Record the noise-filtered stream if Web Audio is running, else fallback to raw mic
    const streamToRecord = (this.processedStream && this.processedStream.getAudioTracks().some(t => t.readyState === 'live'))
      ? this.processedStream
      : this.stream;
    const recorder = new MediaRecorder(streamToRecord, mimeType ? { mimeType } : undefined);
    const parts: Blob[] = [];
    const startedAt = performance.now();
    const chunkSpeaker = this.speaker;
    this.maxVoiceEnergy = 0;
    this.voiceFramesCount = 0;

    // Track speech frequency energy during this 5-second chunk
    if (this.analyser && this.audioCtx) {
      const analyser = this.analyser;
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const sampleRate = this.audioCtx.sampleRate || 48000;
      // Focus on human vocal frequencies (150 Hz to 3500 Hz)
      const minBin = Math.max(1, Math.floor(150 / (sampleRate / analyser.fftSize)));
      const maxBin = Math.min(freqData.length - 1, Math.floor(3500 / (sampleRate / analyser.fftSize)));

      const checkVad = () => {
        if (!this.active) return;
        analyser.getByteFrequencyData(freqData);
        let peak = 0;
        for (let i = minBin; i <= maxBin; i++) {
          if (freqData[i] > peak) peak = freqData[i];
        }
        if (peak > this.maxVoiceEnergy) this.maxVoiceEnergy = peak;
        // Vocal energy threshold: >= 85 ensures genuine spoken voice rather than ambient room noise / fan
        if (peak >= 85) {
          this.voiceFramesCount++;
        }
      };

      if (this.vadInterval) window.clearInterval(this.vadInterval);
      this.vadInterval = window.setInterval(checkVad, 100);
    }

    recorder.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    recorder.onstop = () => {
      if (this.vadInterval) {
        window.clearInterval(this.vadInterval);
        this.vadInterval = null;
      }
      const duration = Math.round(performance.now() - startedAt);
      const offset = this.offsetMs;
      this.offsetMs += duration;

      // Voice Activity Gate (Noise Cancellation):
      // Require sustained vocal energy (at least 4 sample windows = 400ms of speech and peak energy >= 85).
      // Background fan hum, quiet murmurs, breathing, and static are completely cancelled and NOT uploaded!
      const hasVoice = Boolean(this.analyser && this.maxVoiceEnergy >= 85 && this.voiceFramesCount >= 4);

      if (parts.length && hasVoice) {
        void this.upload(new Blob(parts, { type: recorder.mimeType || 'audio/webm' }), offset, duration, chunkSpeaker);
      }
      this.next();
    };
    try {
      recorder.start();
    } catch {
      this.active = false;
      return;
    }
    this.recorder = recorder;
    window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, CHUNK_MS);
  }

  private async upload(blob: Blob, offsetMs: number, durationMs: number, chunkSpeaker: 'self' | 'patient' | 'doctor') {
    const form = new FormData();
    form.append('file', blob, 'chunk.webm');
    form.append('offset_ms', String(offsetMs));
    form.append('duration_ms', String(durationMs));
    if (chunkSpeaker === 'patient') form.append('speaker', 'patient');
    else if (chunkSpeaker === 'doctor') form.append('speaker', 'doctor');
    try {
      const res = await authFetch(`/api/v1/calls/${encodeURIComponent(this.sessionId)}/audio`, { method: 'POST', body: form });
      if (res.status === 409) { this.stop(); return; }           // recording was turned off on the server
      if (!res.ok) this.onError(`Audio upload failed (HTTP ${res.status}).`);
    } catch {
      this.onError('Audio upload failed (network).');
    }
  }

  /** Stops recording; cleans up audio processing graph and releases resources. */
  stop() {
    this.active = false;
    if (this.vadInterval) {
      window.clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.recorder = null;
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close().catch(() => undefined);
      this.audioCtx = null;
    }
    this.analyser = null;
    this.processedStream = null;
  }
}
