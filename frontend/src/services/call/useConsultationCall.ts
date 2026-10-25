// State and actions for one doctor-patient call. Lives at the portal level, so the call keeps running
// while the user switches tabs; the call panels/windows only display it.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Language } from '../../types';
import { CallClient, type CallMessage, type CallQuality } from './callClient';
import { ChunkRecorder } from './audioRecorder';
import { startTone } from './ringtone';
import type { AiState, CallMinutes, CallRole } from './callTypes';

export type CallState = 'idle' | 'calling' | 'incoming' | 'in_call';
const RING_TIMEOUT_MS = 45000;

export interface IncomingCall { callerName: string; video: boolean }

export interface ConsultationCallApi {
  role: CallRole;
  peerName: string;
  connection: 'connecting' | 'open' | 'closed' | 'denied';
  peerPresent: boolean;
  callState: CallState;
  incoming: IncomingCall | null;
  /** Whether this side is sending video in the current call. */
  withVideo: boolean;
  callStartedAt: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** The other side is sending video (tracks can arrive one by one on the same stream). */
  remoteHasVideo: boolean;
  micOff: boolean;
  camOff: boolean;
  aiState: AiState;
  /** Extra information for the doctor about AI minutes (e.g. speech-to-text offline). */
  aiDetail: string | null;
  aiOn: boolean;
  quality: CallQuality | null;
  recordingSession: string | null;
  consentRequest: { session_id: string; doctor_name: string } | null;
  notice: string | null;
  speechAvailable: boolean;
  minutes: CallMinutes | null;
  startCall: (video: boolean) => Promise<void>;
  acceptCall: (video: boolean) => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCam: () => void;
  toggleAi: () => void;
  respondConsent: (accepted: boolean) => void;
  withdrawConsent: () => void;
}

interface Options {
  role: CallRole;
  encounterId: string | null;
  peerName: string;
  /** Doctor: current note text, sent to the server so the AI can compare it with the conversation. */
  noteText?: string;
  /** Doctor: answer automatically once the ringing call arrives (it was answered from the lobby). */
  autoAnswer?: { video: boolean } | null;
  onAutoAnswered?: () => void;
  language?: Language;
}

export function useConsultationCall({ role, encounterId, peerName, noteText, autoAnswer, onAutoAnswered }: Options): ConsultationCallApi {
  const [connection, setConnection] = useState<ConsultationCallApi['connection']>('connecting');
  const [peerPresent, setPeerPresent] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [withVideo, setWithVideo] = useState(true);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [micOff, setMicOff] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [aiState, setAiState] = useState<AiState>('off');
  const [aiDetail, setAiDetail] = useState<string | null>(null);
  const [quality, setQuality] = useState<CallQuality | null>(null);
  const [recordingSession, setRecordingSession] = useState<string | null>(null);
  const [consentRequest, setConsentRequest] = useState<ConsultationCallApi['consentRequest']>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [minutes, setMinutes] = useState<CallMinutes | null>(null);

  const clientRef = useRef<CallClient | null>(null);
  const recorderRef = useRef<ChunkRecorder | null>(null);
  const peerNameRef = useRef(peerName);
  const callStateRef = useRef<CallState>('idle');
  useEffect(() => { peerNameRef.current = peerName; }, [peerName]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const resetCall = useCallback(() => {
    setCallState('idle');
    setIncoming(null);
    setLocalStream(null);
    setCallStartedAt(null);
    setMicOff(false);
    setCamOff(false);
  }, []);

  const handleMessage = useCallback((msg: CallMessage) => {
    const peer = peerNameRef.current;
    switch (msg.type) {
      case 'WELCOME':
        setPeerPresent(!!msg.peer_present);
        setSpeechAvailable(!!msg.speech?.enabled);
        if (msg.recording && msg.session_id) setRecordingSession(msg.session_id);
        if (msg.ringing) {
          setIncoming({ callerName: msg.ringing.caller_name, video: !!msg.ringing.video });
          setCallState('incoming');
        }
        break;
      case 'PEER_JOINED':
        setPeerPresent(true);
        break;
      case 'PEER_LEFT':
        setPeerPresent(false);
        if (callStateRef.current !== 'idle') setNotice(`${peer} left the call.`);
        resetCall();
        break;
      case 'INCOMING_CALL':
        setIncoming({ callerName: msg.caller_name || peer, video: msg.video !== false });
        setCallState('incoming');
        break;
      case 'CALL_ACCEPTED':                         // we called; the other side answered: we make the offer
        setCallState('in_call');
        setCallStartedAt(Date.now());
        void clientRef.current?.makeOffer().then(() => setLocalStream(clientRef.current?.localStream ?? null));
        break;
      case 'CALL_DECLINED':
        clientRef.current?.hangup();
        resetCall();
        setNotice(`${peer} declined the call.`);
        break;
      case 'CALL_UNAVAILABLE':
        clientRef.current?.hangup();
        resetCall();
        setNotice(msg.reason || `${peer} is not online right now.`);
        break;
      case 'CALL_ENDED':
        setNotice(callStateRef.current === 'incoming' ? `Missed call from ${peer}.` : 'The call has ended.');
        resetCall();
        setRecordingSession(null);
        // Recording minutes are finished by the server (it sends the final minutes, then "off").
        if (role === 'doctor') setAiState(s => (s === 'recording' || s === 'finishing' ? 'finishing' : 'off'));
        break;
      case 'CONSENT_REQUEST':
        setConsentRequest({ session_id: msg.session_id, doctor_name: msg.doctor_name });
        break;
      case 'RECORDING':
        if (msg.active) setRecordingSession(msg.session_id);
        else {
          setRecordingSession(null);
          setConsentRequest(null);
          if (msg.reason && msg.reason !== 'call ended') setNotice(msg.reason);
        }
        break;
      case 'AI_STATUS':
        setAiState(msg.state as AiState);
        setAiDetail(msg.detail ?? null);
        break;
      case 'AI_WARNING':
        setAiDetail(msg.detail ?? null);
        break;
      case 'AI_MINUTES':
        setMinutes(msg as unknown as CallMinutes);
        break;
      case 'REPLACED':
        setNotice('This consultation was opened in another window.');
        break;
    }
  }, [role, resetCall]);

  // One room connection per consultation.
  useEffect(() => {
    if (!encounterId) return;
    setMinutes(null);
    setAiState('off');
    setRecordingSession(null);
    resetCall();
    const client = new CallClient(encounterId, {
      onMessage: handleMessage,
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        setRemoteHasVideo(!!stream && stream.getVideoTracks().length > 0);
      },
      onConnection: setConnection,
    });
    clientRef.current = client;
    return () => { recorderRef.current?.stop(); client.close(); clientRef.current = null; };
  }, [encounterId, handleMessage, resetCall]);

  // Record this side's own microphone only while: in a call, and the patient has consented.
  useEffect(() => {
    if (!recordingSession || callState !== 'in_call' || !localStream) return;
    const rec = new ChunkRecorder(localStream, recordingSession, setNotice);
    recorderRef.current = rec;
    rec.start();
    return () => { rec.stop(); recorderRef.current = null; };
  }, [recordingSession, callState, localStream]);

  // Doctor: keep the server's copy of the note current (debounced) so "missing" is computed against it.
  useEffect(() => {
    if (role !== 'doctor' || !recordingSession || noteText === undefined) return;
    const t = window.setTimeout(() => clientRef.current?.send('NOTE_SNAPSHOT', { text: noteText }), 1500);
    return () => window.clearTimeout(t);
  }, [role, recordingSession, noteText]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // Call quality, every few seconds while connected.
  useEffect(() => {
    if (callState !== 'in_call') { setQuality(null); return; }
    const t = window.setInterval(() => {
      void clientRef.current?.quality().then(setQuality).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(t);
  }, [callState]);

  // Sounds: ringing for the person being called, ring-back for the caller.
  useEffect(() => {
    if (callState === 'incoming') return startTone('incoming');
    if (callState === 'calling') return startTone('ringback');
    return undefined;
  }, [callState]);

  // Flash the tab title while ringing, so a call isn't missed in a background tab.
  useEffect(() => {
    if (callState !== 'incoming') return;
    const original = document.title;
    let on = false;
    const t = window.setInterval(() => { on = !on; document.title = on ? '📞 Incoming call…' : original; }, 1000);
    return () => { window.clearInterval(t); document.title = original; };
  }, [callState]);

  // ---- actions ----
  const getMedia = async (video: boolean): Promise<MediaStream | null> => {
    try {
      const stream = await clientRef.current!.startMedia(video);
      const hasVideo = stream.getVideoTracks().length > 0;
      setWithVideo(hasVideo);
      if (video && !hasVideo) setNotice('Camera not available (it may be in use by another app), so this is an audio call.');
      setLocalStream(stream);
      return stream;
    } catch {
      setNotice('Microphone permission is needed for the call. Allow it in the browser and try again.');
      return null;
    }
  };

  const startCall = async (video: boolean) => {
    if (!clientRef.current || callState !== 'idle') return;
    setNotice(null);
    if (!(await getMedia(video))) return;
    clientRef.current.send('CALL_START', { video });
    setCallState('calling');
  };

  // No answer: give up after a while.
  useEffect(() => {
    if (callState !== 'calling') return;
    const t = window.setTimeout(() => {
      clientRef.current?.send('CALL_END');
      clientRef.current?.hangup();
      resetCall();
      setNotice(`${peerNameRef.current} did not answer.`);
    }, RING_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [callState, resetCall]);

  const acceptCall = useCallback(async (video: boolean) => {
    if (!clientRef.current) return;
    setIncoming(null);
    setNotice(null);
    if (!(await getMedia(video))) {
      clientRef.current?.send('CALL_DECLINE');
      resetCall();
      return;
    }
    clientRef.current.send('CALL_ACCEPT');
    setCallState('in_call');
    setCallStartedAt(Date.now());
  }, [resetCall]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Answered from the doctor lobby: accept as soon as this consultation's ringing call arrives.
  useEffect(() => {
    if (autoAnswer && callState === 'incoming') {
      void acceptCall(autoAnswer.video);
      onAutoAnswered?.();
    }
  }, [autoAnswer, callState, acceptCall, onAutoAnswered]);

  const declineCall = () => { clientRef.current?.send('CALL_DECLINE'); resetCall(); };

  const endCall = () => {
    clientRef.current?.send('CALL_END');
    recorderRef.current?.stop();
    clientRef.current?.hangup();
    setRecordingSession(null);
    if (role === 'doctor') setAiState(s => (s === 'recording' ? 'finishing' : 'off'));
    resetCall();
  };

  const toggleMic = () => { const v = !micOff; setMicOff(v); clientRef.current?.setMuted('audio', v); };
  const toggleCam = () => { const v = !camOff; setCamOff(v); clientRef.current?.setMuted('video', v); };

  const aiOn = aiState === 'waiting_consent' || aiState === 'recording';
  const toggleAi = () => {
    const enable = !aiOn;
    clientRef.current?.send('AI_TOGGLE', { enabled: enable });
    setAiDetail(null);
    if (!enable) { setAiState('off'); setRecordingSession(null); }
  };

  const respondConsent = (accepted: boolean) => {
    if (!consentRequest) return;
    clientRef.current?.send('CONSENT_RESPONSE', { session_id: consentRequest.session_id, accepted });
    setConsentRequest(null);
    if (!accepted) setNotice('You declined recording. The consultation continues normally.');
  };

  const withdrawConsent = () => {
    clientRef.current?.send('CONSENT_WITHDRAW');
    recorderRef.current?.stop();
    setRecordingSession(null);
  };

  return {
    role, peerName, connection, peerPresent, callState, incoming, withVideo, callStartedAt, localStream, remoteStream, remoteHasVideo,
    micOff, camOff, aiState, aiDetail, aiOn, quality, recordingSession, consentRequest, notice, speechAvailable, minutes,
    startCall, acceptCall, declineCall, endCall, toggleMic, toggleCam, toggleAi, respondConsent, withdrawConsent,
  };
}
