// GENERATED COPY of shared/call/audioRecorder.ts. Do not edit here: edit shared/call/audioRecorder.ts,
// then run `node scripts/sync-call-engine.mjs`.

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
  private readonly speaker: 'self' | 'patient';

  /** speaker 'self' = this person's own microphone; 'patient' = the doctor recording the patient's voice
   *  from the call (only when the patient's phone can't record, and only with the patient's consent). */
  constructor(stream: MediaStream, sessionId: string, onError: (message: string) => void, speaker: 'self' | 'patient' = 'self') {
    // Audio only: video is never recorded.
    this.stream = new MediaStream(stream.getAudioTracks());
    this.sessionId = sessionId;
    this.onError = onError;
    this.speaker = speaker;
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
    const recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    const parts: Blob[] = [];
    const startedAt = performance.now();
    recorder.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    recorder.onstop = () => {
      const duration = Math.round(performance.now() - startedAt);
      const offset = this.offsetMs;
      this.offsetMs += duration;
      if (parts.length) void this.upload(new Blob(parts, { type: recorder.mimeType || 'audio/webm' }), offset, duration);
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

  private async upload(blob: Blob, offsetMs: number, durationMs: number) {
    const form = new FormData();
    form.append('file', blob, 'chunk.webm');
    form.append('offset_ms', String(offsetMs));
    form.append('duration_ms', String(durationMs));
    if (this.speaker === 'patient') form.append('speaker', 'patient');
    try {
      const res = await authFetch(`/api/v1/calls/${encodeURIComponent(this.sessionId)}/audio`, { method: 'POST', body: form });
      if (res.status === 409) { this.stop(); return; }           // recording was turned off on the server
      if (!res.ok) this.onError(`Audio upload failed (HTTP ${res.status}).`);
    } catch {
      this.onError('Audio upload failed (network).');
    }
  }

  /** Stops recording; the chunk in progress is still sent (it was recorded with consent). */
  stop() {
    this.active = false;
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.recorder = null;
  }
}
