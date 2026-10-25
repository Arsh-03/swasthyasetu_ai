/**
 * One 1:1 WebRTC video call. Two identical copies exist, one per app:
 *   frontend Patient/src/services/rtc/callSession.ts and frontend Doctor/src/services/callSession.ts
 * Keep them in sync.
 *
 * Signaling goes over the backend WebSocket as `{ type: 'webrtc', kind, call_id, to, ... }`:
 *   callee (patient) → 'ready'   (repeated until an offer arrives, so start-up order never matters)
 *   caller (doctor)  → 'offer'
 *   callee           → 'answer'
 *   both             → 'candidate' (ICE) and 'media' (camera / mic on-off, for the other side's UI)
 *
 * `rtc` is the platform's WebRTC API: the browser globals on web, react-native-webrtc on phones.
 */

export interface RtcApi {
  RTCPeerConnection: any;
  RTCIceCandidate: any;
  RTCSessionDescription: any;
}

export type CallRole = 'caller' | 'callee';
export type CallConnection = 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'closed';

export interface SignalMessage {
  type: 'webrtc';
  kind: 'ready' | 'offer' | 'answer' | 'candidate' | 'media';
  call_id: string;
  sdp?: { type: string; sdp: string };
  candidate?: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
  video?: boolean;
  audio?: boolean;
}

export interface CallSessionOptions {
  rtc: RtcApi;
  role: CallRole;
  callId: string;
  localStream: any;
  iceServers: { urls: string | string[]; username?: string; credential?: string }[];
  /** Sends a signaling frame to the other person (the caller adds `to`). */
  send: (msg: SignalMessage) => void;
  onRemoteStream: (stream: any) => void;
  onConnection: (state: CallConnection) => void;
  onRemoteMedia?: (media: { video: boolean; audio: boolean }) => void;
}

const READY_INTERVAL_MS = 2000;
const READY_MAX_TRIES = 45; // ~90 s for the doctor's side to come up

/** Public STUN by default; set a TURN server for calls between different networks (mobile data ↔ Wi-Fi). */
export const buildIceServers = (turn?: { url?: string; username?: string; credential?: string }) => {
  const servers: CallSessionOptions['iceServers'] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (turn?.url) servers.push({ urls: turn.url.split(',').map((u) => u.trim()), username: turn.username, credential: turn.credential });
  return servers;
};

export class CallSession {
  private pc: any = null;
  private pendingCandidates: any[] = [];
  private readyTimer: ReturnType<typeof setInterval> | null = null;
  private readyTries = 0;
  private offerSent = false;
  private answered = false;
  private closed = false;
  private localVideo = true;
  private localAudio = true;

  private opts: CallSessionOptions;

  constructor(opts: CallSessionOptions) {
    this.opts = opts;
  }

  start() {
    const { rtc, localStream, iceServers } = this.opts;
    const pc = new rtc.RTCPeerConnection({ iceServers });
    this.pc = pc;

    localStream?.getTracks().forEach((track: any) => pc.addTrack(track, localStream));

    pc.addEventListener('icecandidate', (e: any) => {
      if (!e.candidate) return;
      const c = e.candidate;
      this.signal({ kind: 'candidate', candidate: { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex } });
    });

    pc.addEventListener('track', (e: any) => {
      const stream = e.streams?.[0];
      if (stream) this.opts.onRemoteStream(stream);
    });

    const onState = () => {
      if (this.closed) return;
      const s: string = pc.connectionState || pc.iceConnectionState;
      if (s === 'connected' || s === 'completed') this.opts.onConnection('connected');
      else if (s === 'disconnected') this.opts.onConnection('reconnecting');
      else if (s === 'failed') this.opts.onConnection('failed');
    };
    pc.addEventListener('connectionstatechange', onState);
    pc.addEventListener('iceconnectionstatechange', onState);

    this.opts.onConnection('connecting');

    if (this.opts.role === 'callee') {
      // Tell the caller we're ready; repeat until their offer arrives
      const ping = () => {
        if (this.answered || this.readyTries >= READY_MAX_TRIES) return this.stopReady();
        this.readyTries += 1;
        this.signal({ kind: 'ready' });
      };
      ping();
      this.readyTimer = setInterval(ping, READY_INTERVAL_MS);
    }
  }

  /** Feed every `type: 'webrtc'` frame from the socket in here. */
  async handleSignal(msg: SignalMessage) {
    if (this.closed || !this.pc || msg.call_id !== this.opts.callId) return;
    const { rtc } = this.opts;
    try {
      switch (msg.kind) {
        case 'ready':
          if (this.opts.role !== 'caller') return;
          if (!this.offerSent) {
            this.offerSent = true;
            const offer = await this.pc.createOffer({});
            await this.pc.setLocalDescription(offer);
            this.signal({ kind: 'offer', sdp: { type: offer.type, sdp: offer.sdp } });
          } else if (!this.answered && this.pc.localDescription) {
            // The callee missed our offer (e.g. it reconnected): send it again
            const d = this.pc.localDescription;
            this.signal({ kind: 'offer', sdp: { type: d.type, sdp: d.sdp } });
          }
          break;
        case 'offer':
          if (this.opts.role !== 'callee' || this.answered || !msg.sdp) return;
          this.answered = true;
          this.stopReady();
          await this.pc.setRemoteDescription(new rtc.RTCSessionDescription(msg.sdp));
          await this.flushCandidates();
          {
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            this.signal({ kind: 'answer', sdp: { type: answer.type, sdp: answer.sdp } });
          }
          this.sendMedia();
          break;
        case 'answer':
          if (this.opts.role !== 'caller' || this.answered || !msg.sdp) return;
          this.answered = true;
          await this.pc.setRemoteDescription(new rtc.RTCSessionDescription(msg.sdp));
          await this.flushCandidates();
          this.sendMedia();
          break;
        case 'candidate':
          if (!msg.candidate) return;
          if (this.pc.remoteDescription) await this.pc.addIceCandidate(new rtc.RTCIceCandidate(msg.candidate));
          else this.pendingCandidates.push(msg.candidate);
          break;
        case 'media':
          this.opts.onRemoteMedia?.({ video: msg.video !== false, audio: msg.audio !== false });
          break;
      }
    } catch (err) {
      console.warn('[Call] signaling step failed:', msg.kind, err);
    }
  }

  /** Turns the local camera / mic on or off and tells the other side. */
  setLocalMedia(media: { video?: boolean; audio?: boolean }) {
    if (media.video !== undefined) this.localVideo = media.video;
    if (media.audio !== undefined) this.localAudio = media.audio;
    this.opts.localStream?.getVideoTracks().forEach((t: any) => (t.enabled = this.localVideo));
    this.opts.localStream?.getAudioTracks().forEach((t: any) => (t.enabled = this.localAudio));
    this.sendMedia();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.stopReady();
    try {
      this.pc?.close();
    } catch {
      // already closed
    }
    this.pc = null;
    this.opts.onConnection('closed');
  }

  private sendMedia() {
    this.signal({ kind: 'media', video: this.localVideo, audio: this.localAudio });
  }

  private signal(msg: Omit<SignalMessage, 'type' | 'call_id'>) {
    if (this.closed) return;
    this.opts.send({ type: 'webrtc', call_id: this.opts.callId, ...msg });
  }

  private stopReady() {
    if (this.readyTimer) clearInterval(this.readyTimer);
    this.readyTimer = null;
  }

  private async flushCandidates() {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of queued) {
      try {
        await this.pc.addIceCandidate(new this.opts.rtc.RTCIceCandidate(c));
      } catch (err) {
        console.warn('[Call] could not add ICE candidate', err);
      }
    }
  }
}
