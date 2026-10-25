// One doctor-patient video call: signaling over the CareBridge server, media peer-to-peer (WebRTC).
// Uses the standard WebRTC globals: the browser's, or react-native-webrtc's on phones (registerGlobals).
// No third-party servers: with no STUN/TURN configured, calls connect on the same network
// (clinic LAN / same machine). Add your own TURN server in ICE_SERVERS for calls across networks.

import { getStoredToken, wsUrl } from '../backend';

const ICE_SERVERS: RTCIceServer[] = [];

/** Audio settings that help speech clarity for the minutes (all built into the browser). */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

/** Video kept light so calls stay smooth on modest computers and slow connections. */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 480 }, height: { ideal: 270 }, frameRate: { ideal: 15, max: 20 } };
const VIDEO_MAX_BITRATE = 300_000;

// Messages from the server are loosely typed by design (one switch statement handles them).
export type CallMessage = { type: string; [key: string]: any };

/** What the user can see about call quality. */
export interface CallQuality {
  networkMs: number | null;        // round trip between the two browsers
  audioDelayMs: number | null;     // time incoming audio waits in the buffer before it is played
  video: string | null;            // what we receive, e.g. "480×270 · 15 fps"
  limitedBy: string | null;        // why our own video was reduced: "cpu" | "bandwidth" | null
}

export interface CallClientHandlers {
  onMessage: (msg: CallMessage) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onConnection: (state: 'connecting' | 'open' | 'closed' | 'denied') => void;
}

export class CallClient {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private closed = false;
  private retry = 1000;
  private retryTimer: number | undefined;
  localStream: MediaStream | null = null;
  private readonly encounterId: string;
  private readonly h: CallClientHandlers;

  constructor(encounterId: string, handlers: CallClientHandlers) {
    this.encounterId = encounterId;
    this.h = handlers;
    this.connect();
  }

  private connect() {
    if (this.closed) return;
    const token = getStoredToken();
    if (!token) { this.h.onConnection('denied'); return; }
    this.h.onConnection('connecting');
        const ws = new WebSocket(wsUrl(`/ws/v1/encounters/${encodeURIComponent(this.encounterId)}/call`));
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'AUTH', token }));
    ws.onmessage = (event) => {
      let msg: CallMessage;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'WELCOME') { this.retry = 1000; this.h.onConnection('open'); }
      if (msg.type === 'SIGNAL') { void this.handleSignal(msg.data); return; }
      if (msg.type === 'CALL_ENDED' || msg.type === 'PEER_LEFT') this.hangup();
      this.h.onMessage(msg);
    };
    ws.onclose = (event) => {
      this.ws = null;
      if (this.closed) return;
      if ([4401, 4403, 4404].includes(event.code)) { this.h.onConnection('denied'); return; }
      if (event.code === 4409) { this.h.onConnection('closed'); return; }   // opened in another tab: let that one have it
      this.h.onConnection('closed');
      this.retryTimer = window.setTimeout(() => this.connect(), this.retry);
      this.retry = Math.min(this.retry * 2, 15000);
    };
  }

  send(type: string, extra: Record<string, unknown> = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type, ...extra }));
  }

  /** Microphone, plus the camera for a video call; falls back to audio-only when the camera can't be used
   *  (no camera, permission refused, or already in use by another browser/app). */
  async startMedia(video = true): Promise<MediaStream> {
    if (this.localStream) return this.localStream;
    if (video) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: VIDEO_CONSTRAINTS });
        for (const t of this.localStream.getVideoTracks()) {
          try { t.contentHint = 'motion'; } catch { /* not supported on every platform */ }
        }
        return this.localStream;
      } catch { /* fall through to audio only */ }
    }
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false });
    return this.localStream;
  }

  private ensurePeer(): RTCPeerConnection {
    if (this.pc) return this.pc;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    // addEventListener (not on* properties): supported by both browsers and react-native-webrtc
    pc.addEventListener('icecandidate', (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate) this.send('SIGNAL', { data: { candidate: e.candidate.toJSON() } });
    });
    pc.addEventListener('track', (e: RTCTrackEvent) => this.h.onRemoteStream(e.streams[0] ?? new MediaStream([e.track])));
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.h.onRemoteStream(null);
    });
    for (const track of this.localStream?.getTracks() ?? []) pc.addTrack(track, this.localStream!);
    this.pc = pc;
    return pc;
  }

  /** The caller starts the media connection once the other side has answered. */
  async makeOffer() {
    await this.startMedia();
    const pc = this.ensurePeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send('SIGNAL', { data: { sdp: pc.localDescription } });
    void this.tuneSenders();
  }

  /** Voice first: audio gets priority; video is capped so it never crowds out the audio. */
  private async tuneSenders() {
    for (const sender of this.pc?.getSenders() ?? []) {
      const kind = sender.track?.kind;
      if (!kind) continue;
      try {
        const params = sender.getParameters();
        if (!params.encodings?.length) continue;
        params.encodings = params.encodings.map(e => (kind === 'audio'
          ? { ...e, priority: 'high', networkPriority: 'high' }
          : { ...e, priority: 'low', networkPriority: 'low', maxBitrate: VIDEO_MAX_BITRATE, maxFramerate: 15 }));
        if (kind === 'video') params.degradationPreference = 'maintain-framerate';
        await sender.setParameters(params);
      } catch { /* not supported by this browser: defaults are fine */ }
    }
  }

  /** Call quality summary (null when not in a call). */
  async quality(): Promise<CallQuality | null> {
    if (!this.pc) return null;
    const q: CallQuality = { networkMs: null, audioDelayMs: null, video: null, limitedBy: null };
    const report = await this.pc.getStats();
    report.forEach((s: any) => {
      if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded' && s.currentRoundTripTime !== undefined) {
        q.networkMs = Math.round(s.currentRoundTripTime * 1000);
      } else if (s.type === 'inbound-rtp' && s.kind === 'audio' && s.jitterBufferEmittedCount) {
        q.audioDelayMs = Math.round(1000 * s.jitterBufferDelay / s.jitterBufferEmittedCount);
      } else if (s.type === 'inbound-rtp' && s.kind === 'video' && s.frameWidth) {
        q.video = `${s.frameWidth}×${s.frameHeight} · ${Math.round(s.framesPerSecond || 0)} fps`;
      } else if (s.type === 'outbound-rtp' && s.kind === 'video' && s.qualityLimitationReason && s.qualityLimitationReason !== 'none') {
        q.limitedBy = s.qualityLimitationReason;
      }
    });
    return q;
  }

  private async handleSignal(data: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit } | undefined) {
    if (!data) return;
    if (data.sdp) {
      if (data.sdp.type === 'offer') {
        await this.startMedia();
        const pc = this.ensurePeer();
        await pc.setRemoteDescription(data.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send('SIGNAL', { data: { sdp: pc.localDescription } });
        void this.tuneSenders();
      } else if (this.pc) {
        await this.pc.setRemoteDescription(data.sdp);
      }
      for (const c of this.pendingIce.splice(0)) await this.pc?.addIceCandidate(c).catch(() => undefined);
    } else if (data.candidate) {
      if (this.pc?.remoteDescription) await this.pc.addIceCandidate(data.candidate).catch(() => undefined);
      else this.pendingIce.push(data.candidate);
    }
  }

  setMuted(kind: 'audio' | 'video', muted: boolean) {
    for (const t of this.localStream?.getTracks() ?? []) if (t.kind === kind) t.enabled = !muted;
  }

  /** End the media connection (the room connection stays open for the next call). */
  hangup() {
    this.pc?.close();
    this.pc = null;
    this.pendingIce = [];
    for (const t of this.localStream?.getTracks() ?? []) t.stop();
    this.localStream = null;
    this.h.onRemoteStream(null);
  }

  close() {
    this.closed = true;
    window.clearTimeout(this.retryTimer);
    this.hangup();
    this.ws?.close();
    this.ws = null;
  }
}
