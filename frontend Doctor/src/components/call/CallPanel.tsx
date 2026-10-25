// Displays a consultation call (state lives in useConsultationCall). Used inline in a tab and inside
// the floating call windows; several can show the same call, so it never owns call state.

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneCall, PhoneOff, Phone, Sparkles, ShieldCheck, CircleStop } from 'lucide-react';
import type { CallLanguage as Language } from '../../services/call/callTypes';
import type { ConsultationCallApi } from '../../services/call/useConsultationCall';
import type { AiState } from '../../services/call/callTypes';
import { CONSENT_TEXT } from '../../services/call/consentText';
import { useCallTimer } from '../../services/call/useCallTimer';
import './ConsultationCall.css';

const AI_LABEL: Record<AiState, string> = {
  off: 'Off',
  waiting_consent: "Waiting for the patient's consent…",
  recording: 'On · recording audio',
  finishing: 'Call ended · finishing the minutes (transcribing the last part)…',
  declined: 'Patient declined recording',
  withdrawn: 'Patient stopped the recording',
  unavailable: 'Speech-to-text not configured on the server',
};

interface Props {
  call: ConsultationCallApi;
  /** Patient: language of the recording banner / stop button. */
  language?: Language;
  /** Smaller layout for floating windows. */
  compact?: boolean;
  /** Hide the start-call buttons (e.g. when another panel already shows them). */
  hideStart?: boolean;
}

export const CallPanel: React.FC<Props> = ({ call, language = 'en', compact = false, hideStart = false }) => {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const timer = useCallTimer(call.callStartedAt);
  const { role, peerName, callState, connection, peerPresent } = call;

  useEffect(() => { if (localVideo.current) localVideo.current.srcObject = call.localStream; }, [call.localStream, callState]);
  useEffect(() => {
    if (remoteVideo.current) remoteVideo.current.srcObject = call.remoteStream;
  }, [call.remoteStream, call.remoteHasVideo, callState]);

  const inCall = callState === 'in_call';
  const active = inCall || callState === 'calling';
  const remoteHasVideo = call.remoteHasVideo;
  const copy = CONSENT_TEXT[language];
  const other = role === 'doctor' ? 'Patient' : 'Doctor';
  const q = call.quality;
  const slow = !!q && (q.limitedBy === 'cpu' || (q.networkMs ?? 0) > 300 || (q.audioDelayMs ?? 0) > 250);
  const slowHint = q?.limitedBy === 'cpu'
    ? 'This computer is busy, so video quality was reduced. Close other apps or tabs, or turn the camera off.'
    : 'The connection is slow. Turning the camera off keeps the voice clear.';

  return (
    <div className={`cc-root ${compact ? 'cc-compact' : ''}`}>
      <div className="cc-header">
        <strong>{role === 'doctor' ? `Consultation · ${peerName}` : `Consultation with ${peerName}`}</strong>
        <span className={`cc-pill ${peerPresent ? 'ok' : ''}`}>
          {connection !== 'open' ? (connection === 'denied' ? 'Not allowed' : 'Connecting…')
            : peerPresent ? `${other} online` : `${other} offline`}
        </span>
        {inCall && timer && <span className="cc-timer">● {timer}</span>}
        {call.recordingSession && <span className="cc-rec"><span className="cc-rec-dot" /> REC · audio only</span>}
      </div>

      {active && (
        <div className={`cc-videos ${remoteHasVideo ? '' : 'cc-audio-only'}`}>
          {/* Muted: the voice plays from the portal's single <RemoteAudio>, so it continues on every tab. */}
          <video ref={remoteVideo} className="cc-remote" autoPlay playsInline muted style={{ display: remoteHasVideo ? undefined : 'none' }} />
          {!remoteHasVideo && (
            <div className="cc-remote-placeholder">
              {callState === 'calling' ? `Calling ${peerName}…` : call.remoteStream ? (
                <span className="cc-voice"><Phone size={18} /> Audio call with {peerName}</span>
              ) : 'Connecting…'}
            </div>
          )}
          {call.withVideo && <video ref={localVideo} className="cc-local" autoPlay playsInline muted />}
        </div>
      )}

      <div className="cc-controls">
        {callState === 'idle' && !hideStart && (
          <>
            <button type="button" className="cc-btn cc-accept" onClick={() => void call.startCall(true)} disabled={connection !== 'open'}>
              <Video size={16} /> Video call
            </button>
            <button type="button" className="cc-btn" onClick={() => void call.startCall(false)} disabled={connection !== 'open'}>
              <Phone size={16} /> Audio call
            </button>
            {connection === 'open' && !peerPresent && (
              <span className="cc-hint">{role === 'patient' ? `${peerName} will be notified if they're online.` : `${peerName} is not online right now.`}</span>
            )}
          </>
        )}
        {active && (
          <>
            <button type="button" className="cc-btn" onClick={call.toggleMic} aria-pressed={call.micOff}>{call.micOff ? <MicOff size={16} /> : <Mic size={16} />} {call.micOff ? 'Unmute' : 'Mute'}</button>
            {call.withVideo && (
              <button type="button" className="cc-btn" onClick={call.toggleCam} aria-pressed={call.camOff}>{call.camOff ? <VideoOff size={16} /> : <Video size={16} />} {call.camOff ? 'Camera on' : 'Camera off'}</button>
            )}
            <button type="button" className="cc-btn cc-end" onClick={call.endCall}><PhoneOff size={16} /> {callState === 'calling' ? 'Cancel' : 'End call'}</button>
          </>
        )}
        {callState === 'incoming' && call.incoming && (
          <>
            <button type="button" className="cc-btn cc-accept" onClick={() => void call.acceptCall(true)}><PhoneCall size={16} /> Answer</button>
            <button type="button" className="cc-btn cc-end" onClick={call.declineCall}><PhoneOff size={16} /> Decline</button>
          </>
        )}
        {role === 'patient' && call.recordingSession && (
          <button type="button" className="cc-btn cc-stop" onClick={call.withdrawConsent}><CircleStop size={16} /> {copy.stop}</button>
        )}
      </div>

      {role === 'doctor' && (
        <div className={`cc-ai ${call.aiOn ? 'on' : ''}`}>
          <label className="cc-switch">
            <input type="checkbox" checked={call.aiOn} onChange={call.toggleAi} disabled={!inCall || !call.speechAvailable} aria-label="Quick AI minutes and auto-update notes" />
            <span className="cc-slider" />
          </label>
          <div className="cc-ai-text">
            <div className="cc-ai-title"><Sparkles size={15} /> Quick AI minutes &amp; auto-update notes</div>
            <div className="cc-ai-status">
              {!call.speechAvailable ? AI_LABEL.unavailable
                : call.aiState === 'finishing' || call.aiDetail ? AI_LABEL[call.aiState]
                : !inCall && !call.aiOn ? 'Available once the call has started.' : AI_LABEL[call.aiState]}
            </div>
            {call.aiDetail && <div className="cc-ai-detail" role="status">{call.aiDetail}</div>}
            {!compact && (
              <div className="cc-ai-privacy"><ShieldCheck size={13} /> Needs the patient's consent. Names, phone and ID numbers are removed before AI; processing stays on CareBridge servers.</div>
            )}
          </div>
        </div>
      )}

      {role === 'patient' && call.recordingSession && (
        <div className="cc-banner" role="status"><span className="cc-rec-dot" /> {copy.recordingBanner}</div>
      )}

      {inCall && call.quality && (
        <div className={`cc-quality ${slow ? 'warn' : ''}`}>
          Connection {call.quality.networkMs ?? '–'} ms · audio delay {call.quality.audioDelayMs ?? '–'} ms
          {call.quality.video ? ` · video ${call.quality.video}` : ''}
          {slow && <div>{slowHint}</div>}
        </div>
      )}

      {call.notice && <div className="cc-notice" role="status">{call.notice}</div>}
    </div>
  );
};
