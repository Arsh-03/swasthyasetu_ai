// State and actions for one doctor-patient call. Lives at the portal level, so the call keeps running
// while the user switches tabs; the call panels/windows only display it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AUDIO_CONSTRAINTS, CallClient, type CallMessage, type CallQuality } from './callClient';
import { ChunkRecorder, canRecordAudio } from './audioRecorder';
import { startTone } from './ringtone';
import type { AiState, AssistAlert, AssistState, AssistSuggestion, CallLanguage as Language, CallMinutes, CallRole } from './callTypes';

export type CallState = 'idle' | 'calling' | 'incoming' | 'in_call';
const EMPTY_ASSIST: AssistState = { speech: null, model: null, streaming: null, suggestions: [], alerts: [] };
const RING_TIMEOUT_MS = 45000;

export interface IncomingCall { callerName: string; video: boolean }

/** Why the last call attempt or call ended (for screens that show a result). */
export type CallEndReason = 'declined' | 'unavailable' | 'no_answer' | 'ended' | 'missed' | null;

export interface ConsultationCallApi {
  role: CallRole;
  peerName: string;
  connection: 'connecting' | 'open' | 'closed' | 'denied';
  /** The consultation whose call room is connected right now (null while connecting). */
  roomEncounterId: string | null;
  peerPresent: boolean;
  callState: CallState;
  incoming: IncomingCall | null;
  endReason: CallEndReason;
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
  /** Doctor: a practice run of the live assistant with the demo patient (no call, no audio, nothing auto-added). */
  practice: boolean;
  /** Practice is listening to the doctor's microphone (own speech server online), not playing the demo script. */
  practiceVoice: boolean;
  /** Meeting waiting room. Doctor: the patient asking to join (null if nobody). */
  waitingPatient: { name: string; video: boolean; autoAdmit: boolean } | null;
  /** Patient: 'waiting' after asking to join, 'denied' if the doctor declined. */
  knockState: 'idle' | 'waiting' | 'denied';
  /** Patient: ask to join the meeting (the call is answered automatically once the doctor admits). */
  knock: (video: boolean) => void;
  cancelKnock: () => void;
  /** Doctor: in the meeting and waiting, so the patient is let in straight away. */
  setHostWaiting: (on: boolean) => void;
  /** Doctor: turn the waiting patient away. */
  denyEntry: () => void;
  quality: CallQuality | null;
  recordingSession: string | null;
  consentRequest: { session_id: string; doctor_name: string } | null;
  notice: string | null;
  speechAvailable: boolean;
  minutes: CallMinutes | null;
  /** Live assistant during the call: engines in use, streamed suggestions, safety alerts. */
  assist: AssistState;
  dismissAlert: (id: string) => void;
  dismissSuggestion: (id: string) => void;
  startCall: (video: boolean) => Promise<void>;
  acceptCall: (video: boolean) => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCam: () => void;
  toggleAi: () => void;
  startPractice: (voice?: boolean) => void;
  stopPractice: () => void;
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
  const [roomEncounterId, setRoomEncounterId] = useState<string | null>(null);
  const [peerPresent, setPeerPresent] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [endReason, setEndReason] = useState<CallEndReason>(null);
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
  // Doctor: the patient's phone can't record, so record the patient's voice from the call here.
  const [recordRemote, setRecordRemote] = useState(false);
  const [consentRequest, setConsentRequest] = useState<ConsultationCallApi['consentRequest']>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [minutes, setMinutes] = useState<CallMinutes | null>(null);
  const [assist, setAssist] = useState<AssistState>(EMPTY_ASSIST);
  const [practice, setPractice] = useState(false);
  const [practiceVoice, setPracticeVoice] = useState<{ sessionId: string } | null>(null);
  const [waitingPatient, setWaitingPatient] = useState<ConsultationCallApi['waitingPatient']>(null);
  const [knockState, setKnockState] = useState<'idle' | 'waiting' | 'denied'>('idle');
  const knockRef = useRef<{ video: boolean } | null>(null);

  const clientRef = useRef<CallClient | null>(null);
  const recorderRef = useRef<ChunkRecorder | null>(null);
  const peerNameRef = useRef(peerName);
  const callStateRef = useRef<CallState>('idle');
  useEffect(() => { peerNameRef.current = peerName; }, [peerName]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // A different consultation: start from a clean slate (adjusted while rendering, not in an effect).
  const [stateFor, setStateFor] = useState(encounterId);
  if (stateFor !== encounterId) {
    setStateFor(encounterId);
    setMinutes(null);
    setAssist(EMPTY_ASSIST);
    setPractice(false);
    setWaitingPatient(null);
    setKnockState('idle');
    setAiState('off');
    setRecordingSession(null);
    setCallState('idle');
    setIncoming(null);
    setLocalStream(null);
    setCallStartedAt(null);
  }

  // Answered from the doctor lobby: accept as soon as this consultation's ringing call arrives.
  const autoAnswerRef = useRef(autoAnswer);
  const onAutoAnsweredRef = useRef(onAutoAnswered);
  const acceptRef = useRef<((video: boolean) => Promise<void>) | null>(null);
  useEffect(() => { autoAnswerRef.current = autoAnswer; onAutoAnsweredRef.current = onAutoAnswered; });
  const maybeAutoAnswer = () => {
    // Patient in the waiting room: the doctor's call is the admission, answer it.
    const knocked = knockRef.current;
    if (knocked) {
      knockRef.current = null;
      setKnockState('idle');
      window.setTimeout(() => { void acceptRef.current?.(knocked.video); }, 0);
      return;
    }
    const auto = autoAnswerRef.current;
    if (!auto) return;
    onAutoAnsweredRef.current?.();
    window.setTimeout(() => { void acceptRef.current?.(auto.video); }, 0);
  };

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
        setWaitingPatient(msg.waiting ? { name: msg.waiting.patient_name || peer, video: msg.waiting.video !== false, autoAdmit: false } : null);
        if (msg.ringing) {
          setIncoming({ callerName: msg.ringing.caller_name, video: !!msg.ringing.video });
          setCallState('incoming');
          maybeAutoAnswer();
        }
        break;
      case 'KNOCK':
        setWaitingPatient({ name: msg.patient_name || peer, video: msg.video !== false, autoAdmit: !!msg.auto_admit });
        break;
      case 'KNOCK_CANCELLED':
        setWaitingPatient(null);
        break;
      case 'WAITING':
        setKnockState('waiting');
        break;
      case 'DENIED':
        knockRef.current = null;
        setKnockState('denied');
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
        maybeAutoAnswer();
        break;
      case 'CALL_ACCEPTED':                         // we called; the other side answered: we make the offer
        setWaitingPatient(null);
        setCallState('in_call');
        setCallStartedAt(Date.now());
        void clientRef.current?.makeOffer().then(() => setLocalStream(clientRef.current?.localStream ?? null));
        break;
      case 'CALL_DECLINED':
        clientRef.current?.hangup();
        resetCall();
        setNotice(`${peer} declined the call.`);
        setEndReason('declined');
        break;
      case 'CALL_UNAVAILABLE':
        clientRef.current?.hangup();
        resetCall();
        setNotice(msg.reason || `${peer} is not online right now.`);
        setEndReason('unavailable');
        break;
      case 'CALL_ENDED':
        setEndReason(callStateRef.current === 'incoming' ? 'missed' : 'ended');
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
        if (msg.active) {
          setRecordingSession(msg.session_id);
          setRecordRemote(!!msg.record_remote);
        } else {
          setRecordRemote(false);
          setRecordingSession(null);
          setConsentRequest(null);
          if (msg.reason && msg.reason !== 'call ended') setNotice(msg.reason);
        }
        break;
      case 'AI_STATUS':
        setAiState(msg.state as AiState);
        setAiDetail(msg.detail ?? null);
        if (msg.state === 'off' || msg.practice !== undefined) setPractice(msg.state !== 'off' && !!msg.practice);
        setPracticeVoice(msg.state === 'recording' && msg.practice && msg.practice_voice ? { sessionId: String(msg.session_id) } : null);
        break;
      case 'AI_WARNING':
        setAiDetail(msg.detail ?? null);
        break;
      case 'AI_MINUTES':
        setMinutes(msg as unknown as CallMinutes);
        break;
      case 'AI_MODE':
        setAssist((a) => ({ ...EMPTY_ASSIST, speech: msg.speech ?? null, model: msg.model ?? null, alerts: a.alerts }));
        break;
      case 'AI_ASSIST':
        if (msg.state === 'streaming') {
          setAssist((a) => ({ ...a, streaming: String(msg.text ?? ''), model: msg.engine ?? a.model }));
        } else {
          const items = (msg.items ?? []) as AssistSuggestion[];
          setAssist((a) => ({
            ...a, streaming: null, model: msg.engine ?? a.model,
            suggestions: [...items, ...a.suggestions.filter((s) => !items.some((i) => i.id === s.id))].slice(0, 6),
          }));
        }
        break;
      case 'AI_ALERT': {
        const alert = msg as unknown as AssistAlert;
        setAssist((a) => (a.alerts.some((x) => x.id === alert.id) ? a : { ...a, alerts: [alert, ...a.alerts] }));
        break;
      }
      case 'REPLACED':
        setNotice('This consultation was opened in another window.');
        break;
    }
  }, [role, resetCall]);

  // One room connection per consultation.
  useEffect(() => {
    if (!encounterId) return;
    const client = new CallClient(encounterId, {
      onMessage: handleMessage,
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        setRemoteHasVideo(!!stream && stream.getVideoTracks().length > 0);
      },
      onConnection: (state) => {
        setConnection(state);
        setRoomEncounterId(state === 'open' ? encounterId : null);
      },
    });
    clientRef.current = client;
    return () => { recorderRef.current?.stop(); client.close(); clientRef.current = null; };
  }, [encounterId, handleMessage, resetCall]);

  // Record this side's own microphone only while: in a call, and the patient has consented.
  useEffect(() => {
    if (!recordingSession || callState !== 'in_call' || !localStream || !canRecordAudio()) return;
    const rec = new ChunkRecorder(localStream, recordingSession, setNotice);
    recorderRef.current = rec;
    rec.start();
    return () => { rec.stop(); recorderRef.current = null; };
  }, [recordingSession, callState, localStream]);

  // Doctor, when the patient's phone can't record: record the patient's voice from the call (consented).
  useEffect(() => {
    if (role !== 'doctor' || !recordRemote || !recordingSession || callState !== 'in_call' || !remoteStream) return;
    const rec = new ChunkRecorder(remoteStream, recordingSession, setNotice, 'patient');
    rec.start();
    return () => rec.stop();
  }, [role, recordRemote, recordingSession, callState, remoteStream]);

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
    if (callState !== 'in_call') return;
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
    if (callState !== 'incoming' || typeof document === 'undefined') return;
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
    setEndReason(null);
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
      setEndReason('no_answer');
    }, RING_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [callState, resetCall]);

  const acceptCall = useCallback(async (video: boolean) => {
    if (!clientRef.current) return;
    setIncoming(null);
    setNotice(null);
    setEndReason(null);
    if (!(await getMedia(video))) {
      clientRef.current?.send('CALL_DECLINE');
      resetCall();
      return;
    }
    clientRef.current.send('CALL_ACCEPT');
    setCallState('in_call');
    setCallStartedAt(Date.now());
  }, [resetCall]);
  useEffect(() => { acceptRef.current = acceptCall; }, [acceptCall]);

  const declineCall = () => { clientRef.current?.send('CALL_DECLINE'); resetCall(); };

  const endCall = () => {
    clientRef.current?.send('CALL_END');
    recorderRef.current?.stop();
    clientRef.current?.hangup();
    setRecordingSession(null);
    if (role === 'doctor') setAiState(s => (s === 'recording' ? 'finishing' : 'off'));
    setEndReason('ended');
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
    clientRef.current?.send('CONSENT_RESPONSE', { session_id: consentRequest.session_id, accepted, can_record: canRecordAudio() });
    setConsentRequest(null);
    if (!accepted) setNotice('You declined recording. The consultation continues normally.');
  };

  const withdrawConsent = () => {
    clientRef.current?.send('CONSENT_WITHDRAW');
    recorderRef.current?.stop();
    setRecordingSession(null);
  };

  const knock = useCallback((video: boolean) => {
    knockRef.current = { video };
    setKnockState('waiting');
    clientRef.current?.send('KNOCK', { video });
  }, []);
  const cancelKnock = useCallback(() => {
    knockRef.current = null;
    setKnockState('idle');
    clientRef.current?.send('KNOCK_CANCEL');
  }, []);
  const setHostWaiting = useCallback((on: boolean) => { clientRef.current?.send('HOST_WAITING', { on }); }, []);
  const denyEntry = useCallback(() => { setWaitingPatient(null); clientRef.current?.send('DENY'); }, []);

  const startPractice = useCallback((voice = true) => {
    setMinutes(null);
    setAssist(EMPTY_ASSIST);
    clientRef.current?.send('PRACTICE_START', { voice });
  }, []);
  const stopPractice = useCallback(() => {
    clientRef.current?.send('PRACTICE_STOP');
    setPractice(false);
    setPracticeVoice(null);
    setAiState('off');
  }, []);

  // Practice with your voice: record the doctor's microphone (as the "patient" side, so one person can test).
  useEffect(() => {
    if (!practiceVoice || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    let rec: ChunkRecorder | null = null;
    let mic: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        mic = stream;
        rec = new ChunkRecorder(stream, practiceVoice.sessionId, setNotice, 'patient');
        rec.start();
      })
      .catch(() => setNotice('Microphone permission is needed to practise with your voice.'));
    return () => { cancelled = true; rec?.stop(); mic?.getTracks().forEach((t) => t.stop()); };
  }, [practiceVoice]);

  const dismissAlert = useCallback((id: string) => setAssist((a) => ({ ...a, alerts: a.alerts.filter((x) => x.id !== id) })), []);
  const dismissSuggestion = useCallback((id: string) => setAssist((a) => ({ ...a, suggestions: a.suggestions.filter((x) => x.id !== id) })), []);

  return {
    role, peerName, connection, roomEncounterId, peerPresent, callState, incoming, endReason, withVideo, callStartedAt, localStream, remoteStream, remoteHasVideo,
    micOff, camOff, aiState, aiDetail, aiOn, practice, practiceVoice: !!practiceVoice, waitingPatient, knockState, knock, cancelKnock, setHostWaiting, denyEntry, quality: callState === 'in_call' ? quality : null, recordingSession, consentRequest, notice, speechAvailable, minutes, assist, dismissAlert, dismissSuggestion,
    startCall, acceptCall, declineCall, endCall, toggleMic, toggleCam, toggleAi, startPractice, stopPractice, respondConsent, withdrawConsent,
  };
}
