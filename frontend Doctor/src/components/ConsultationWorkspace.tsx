import React, { useState, useEffect, useRef } from 'react';
import type { PatientSummary } from '../services/api';
import { api } from '../services/api';
import { Icon } from './ui/Icon';
import { Avatar } from './ui/Avatar';
import { buildIceServers, CallSession, type CallConnection, type SignalMessage } from '../services/callSession';
import {
  type SupportedLanguage,
  formatLocalizedName,
  formatLocalizedComplaint,
  stripNonLatinParentheses,
} from '../utils/translations';

/** Sends frames over the portal's telehealth socket and lets the call listen for `webrtc` frames. */
export interface CallSignaling {
  send: (msg: Record<string, unknown>) => void;
  subscribe: (handler: (msg: SignalMessage) => void) => () => void;
}

// Optional TURN relay (VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL) for calls across networks
const ICE_SERVERS = buildIceServers({
  url: import.meta.env.VITE_TURN_URL,
  username: import.meta.env.VITE_TURN_USERNAME,
  credential: import.meta.env.VITE_TURN_CREDENTIAL,
});

/** Plays a remote MediaStream (muted: the patient's audio plays through one hidden <audio> element). */
const StreamVideo: React.FC<{ stream: MediaStream | null; className?: string }> = ({ stream, className }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={className} />;
};

interface ConsultationWorkspaceProps {
  patient: PatientSummary | null;
  doctorName: string;
  /** Called after the note is signed so the queue can refresh. */
  onConsultationSigned?: () => void;
  callState: 'idle' | 'calling' | 'connected' | 'declined';
  /** Id of the call placed to the patient (null when no call). */
  callId: string | null;
  signaling: CallSignaling;
  onStartCall: (patient: PatientSummary) => void;
  onEndCall: () => void;
  onRequestRecordAccess: () => void;
  onPatientAccept?: () => void;
  onGoToQueue: () => void;
  selectedLanguage?: SupportedLanguage;
}

export const ConsultationWorkspace: React.FC<ConsultationWorkspaceProps> = ({
  patient,
  doctorName,
  onConsultationSigned,
  callState,
  callId,
  signaling,
  onStartCall,
  onEndCall,
  onRequestRecordAccess,
  onPatientAccept,
  onGoToQueue,
  selectedLanguage = 'en',
}) => {
  const patientDisplayName = patient ? formatLocalizedName(patient.full_name, selectedLanguage) : '';
  // Timer state - starts from 0 on connected call
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [callingSeconds, setCallingSeconds] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [networkTier, setNetworkTier] = useState<'hd' | 'audio' | 'async'>('hd');
  const [isSwappedView, setIsSwappedView] = useState(false);

  // WebRTC Local Media Stream State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mediaPermission, setMediaPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);

  // Live link to the patient (WebRTC)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connection, setConnection] = useState<CallConnection>('connecting');
  const [remoteMedia, setRemoteMedia] = useState({ video: true, audio: true });
  const sessionRef = useRef<CallSession | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // AI Scribe Items
  // SOAP note fields, filled in by the doctor during the call
  const emptyScribe = (p: PatientSummary | null) => [
    { id: 'complaint', label: 'Complaint', value: p?.complaint || '', placeholder: 'Chief complaint', confirmed: !!p?.complaint },
    { id: 'diagnosis', label: 'Diagnosis', value: '', placeholder: 'Working diagnosis', confirmed: false },
    { id: 'medicine', label: 'Medicine', value: '', placeholder: 'e.g. Paracetamol 650mg TDS (After food)', confirmed: false },
    { id: 'advice', label: 'Clinical Advice', value: '', placeholder: 'Advice for the patient', confirmed: false },
    { id: 'follow_up', label: 'Follow-up', value: '', placeholder: 'e.g. Review in 3 days', confirmed: false },
  ];
  const [scribeItems, setScribeItems] = useState(() => emptyScribe(patient));
  const [signError, setSignError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    setScribeItems(emptyScribe(patient));
    setSignError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.patient_id]);

  // Drug-Allergy Safety CDSS Warning
  const [ddiWarning] = useState<string | null>(
    patient?.allergies?.includes('Penicillin')
      ? 'CDSS Alert: Patient has documented Penicillin allergy. Beta-lactam antibiotics contraindicated.'
      : null
  );

  const [consultationCompleted, setConsultationCompleted] = useState(false);

  // Unconditionally stops all camera and microphone tracks
  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {
          console.warn('Track stop error:', e);
        }
      });
      streamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (fullVideoRef.current) {
      fullVideoRef.current.srcObject = null;
    }
    setLocalStream(null);
    // The next call asks for the camera again before connecting
    setMediaPermission('prompt');
  };

  // Request Camera & Microphone Permissions and stream video
  const requestMediaAccess = async () => {
    try {
      setMediaError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMediaError('Media devices API not supported in this browser environment.');
        setMediaPermission('denied');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: true,
      });

      streamRef.current = stream;
      setLocalStream(stream);
      setMediaPermission('granted');

      // Attach stream to video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (fullVideoRef.current) {
        fullVideoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Camera / Microphone permission denied or not found:', err);
      setMediaPermission('denied');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMediaError('Camera and Microphone permission was declined. Please allow access in browser bar.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMediaError('No camera or microphone hardware found on this system.');
      } else {
        setMediaError(`Media device error: ${err.message || 'Unable to access camera'}`);
      }
    }
  };

  // Only request camera when callState becomes 'connected'
  useEffect(() => {
    if (callState === 'connected') {
      requestMediaAccess();
    } else {
      stopTracks();
    }

    const handleBeforeUnload = () => {
      stopTracks();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopTracks();
    };
  }, [callState]);

  // Start the peer connection once the patient has accepted and our camera step has finished.
  // The patient's app signals "ready"; we answer with an offer (see callSession.ts).
  const mediaSettled = mediaPermission !== 'prompt';
  const sendVideo = isCamOn && networkTier === 'hd';
  const mediaRef = useRef({ video: sendVideo, audio: isMicOn });
  useEffect(() => {
    mediaRef.current = { video: sendVideo, audio: isMicOn };
    sessionRef.current?.setLocalMedia({ video: sendVideo, audio: isMicOn });
  }, [sendVideo, isMicOn]);

  const patientId = patient?.patient_id;
  useEffect(() => {
    if (callState !== 'connected' || !callId || !patientId || !mediaSettled) return;
    const session = new CallSession({
      rtc: { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription },
      role: 'caller',
      callId,
      localStream: streamRef.current,
      iceServers: ICE_SERVERS,
      send: (msg) => signaling.send({ ...msg, to: patientId }),
      onRemoteStream: setRemoteStream,
      onConnection: setConnection,
      onRemoteMedia: setRemoteMedia,
    });
    sessionRef.current = session;
    const unsubscribe = signaling.subscribe((msg) => session.handleSignal(msg));
    session.start();
    session.setLocalMedia(mediaRef.current);
    return () => {
      unsubscribe();
      session.close();
      sessionRef.current = null;
      setRemoteStream(null);
      setConnection('connecting');
      setRemoteMedia({ video: true, audio: true });
    };
  }, [callState, callId, patientId, mediaSettled, signaling]);

  // Patient audio: one element, muted by the speaker toggle
  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el) return;
    if (el.srcObject !== remoteStream) el.srcObject = remoteStream;
    el.muted = !isSpeakerOn;
    if (remoteStream) el.play().catch(() => {});
  }, [remoteStream, isSpeakerOn]);

  const patientLive = !!remoteStream && connection === 'connected' && remoteMedia.video;
  const patientStatus =
    connection === 'failed'
      ? 'Connection lost. End the call and call again.'
      : connection === 'reconnecting'
        ? 'Weak connection. Reconnecting…'
        : connection !== 'connected'
          ? 'Connecting to patient…'
          : !remoteMedia.video
            ? 'Patient camera is off'
            : '';

  // Outgoing ringing timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (callState === 'calling') {
      setCallingSeconds(0);
      timer = setInterval(() => {
        setCallingSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  // Connected call duration timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (callState === 'connected') {
      setSecondsElapsed(0);
      timer = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  // Update video element srcObject when stream or swap view changes
  useEffect(() => {
    const activeStream = streamRef.current || localStream;
    if (activeStream) {
      if (localVideoRef.current && localVideoRef.current.srcObject !== activeStream) {
        localVideoRef.current.srcObject = activeStream;
      }
      if (fullVideoRef.current && fullVideoRef.current.srcObject !== activeStream) {
        fullVideoRef.current.srcObject = activeStream;
      }
    }
  }, [localStream, isSwappedView, isCamOn, callState]);

  // Handle Mute / Unmute Microphone
  // Track on/off is applied (and told to the patient) by the effect on isMicOn / isCamOn
  const toggleMic = () => setIsMicOn((on) => !on);

  // Handle Camera On / Off
  const toggleCam = () => setIsCamOn((on) => !on);

  // Safe End Call with camera track cleanup
  const handleEndCall = () => {
    sessionRef.current?.close();
    stopTracks();
    onEndCall();
  };

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const toggleConfirm = (id: string) => {
    setScribeItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, confirmed: !item.confirmed } : item))
    );
  };

  const updateScribeValue = (id: string, value: string) => {
    setScribeItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value, confirmed: value.trim() !== '' } : item))
    );
  };

  const handleCompleteConsultation = async () => {
    if (!patient?.encounter_id) {
      setSignError('This patient has no open encounter to sign.');
      return;
    }
    // Only confirmed fields go into the signed note
    const field = (id: string) => {
      const item = scribeItems.find((i) => i.id === id);
      return item && item.confirmed ? item.value.trim() : '';
    };
    if (!field('diagnosis')) {
      setSignError('Enter and confirm a diagnosis before signing.');
      return;
    }
    setIsSigning(true);
    setSignError(null);
    try {
      await api.signSoapNote(patient.encounter_id, {
        subjective: field('complaint'),
        objective: patient.vitals || '',
        assessment: field('diagnosis'),
        plan: {
          medicine: field('medicine'),
          advice: field('advice'),
          follow_up: field('follow_up'),
        },
        doctor_signature_name: doctorName,
        ddi_acknowledged: !!ddiWarning,
      });
      setConsultationCompleted(true);
      onConsultationSigned?.();
      setTimeout(() => {
        handleEndCall();
      }, 2500);
    } catch (err) {
      setSignError(err instanceof Error ? err.message : 'Could not sign the note');
    } finally {
      setIsSigning(false);
    }
  };

  // 1. STATE: IDLE (No Active Call)
  if (callState === 'idle' || !patient) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-6 sm:p-10 min-h-[60vh]">
        <div className="w-full max-w-xl bg-card rounded-2xl p-8 sm:p-10 shadow-md border border-card-border flex flex-col items-center text-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
            <Icon name="video" size={32} />
          </div>

          <div className="flex flex-col gap-1.5 max-w-md">
            <h2 className="text-xl font-bold text-ink tracking-tight">No Active Consultation</h2>
            <p className="text-xs text-ink-muted leading-relaxed">
              Consultations do not connect automatically. Select a triage patient from the queue to start an outgoing call.
            </p>
          </div>

          {patient ? (
            <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => onStartCall(patient)}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-deep text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Icon name="call" size={16} />
                <span>Call {patientDisplayName}</span>
              </button>
              <button
                type="button"
                onClick={onGoToQueue}
                className="px-5 py-2.5 rounded-xl bg-fog hover:bg-fog/80 text-ink font-medium text-xs transition-all cursor-pointer border border-card-border"
              >
                Return to Patient Queue
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onGoToQueue}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-deep text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer mt-2"
            >
              <Icon name="people" size={16} />
              <span>Go to Patient Queue</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. STATE: CALLING / OUTGOING RINGING (Fills main content area, 16px radius, no halo glow, avatar 96px)
  if (callState === 'calling') {
    return (
      <div className="w-full h-full flex-1 flex flex-col min-h-0">
        <div className="w-full h-full flex-1 bg-night rounded-2xl p-8 sm:p-12 shadow-lg border border-white/10 flex flex-col items-center justify-center text-center gap-6 text-white relative overflow-hidden">
          {/* Patient Avatar (No radial halo/glow rings; avatar 96px) */}
          <div className="relative my-2">
            <Avatar
              src={patient.avatar_url}
              name={patientDisplayName}
              size={96}
              domain="emergency"
              className="relative shadow-xl"
            />
          </div>

          <div className="flex flex-col gap-1 z-10">
            <span className="text-xs uppercase tracking-widest text-success font-bold">
              Outgoing Telehealth Video Call
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{patientDisplayName}</h2>
            <span className="text-sm text-white/60 font-mono mt-0.5">{patient.abha_address}</span>
            <div className="inline-flex items-center justify-center gap-2 mt-3 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md self-center text-xs font-medium text-white/90">
              <span className="w-2 h-2 rounded-full bg-success animate-ping" />
              <span>Ringing patient's app... ({formatTimer(callingSeconds)})</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col items-center gap-3 z-10 mt-2">
            {/* Cancel Call Button (flat red button) */}
            <button
              type="button"
              onClick={handleEndCall}
              className="w-14 h-14 rounded-full bg-danger-deep hover:bg-danger-pressed text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              title="Cancel Call"
              aria-label="Cancel call"
            >
              <Icon name="callEnd" size={26} />
            </button>
            <span className="text-xs text-white/70 font-medium">Cancel Call</span>

            {/* Demo Simulation Button */}
            {onPatientAccept && (
              <button
                type="button"
                onClick={onPatientAccept}
                className="mt-2 px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs text-white/90 font-medium border border-white/20 transition-all cursor-pointer backdrop-blur-md"
              >
                <Icon name="mobile" size={14} className="inline-block align-[-2px]" /> Simulate Patient Answering Call (Demo)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. STATE: DECLINED
  if (callState === 'declined') {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-6 sm:p-10 min-h-[60vh]">
        <div className="w-full max-w-xl bg-card rounded-2xl p-8 sm:p-10 shadow-md border border-card-border flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-full bg-danger/10 text-danger-deep flex items-center justify-center">
            <Icon name="callDeclined" size={28} />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-ink">Call Declined by Patient</h2>
            <p className="text-xs text-ink-muted">
              {patientDisplayName} declined or was unavailable for the consultation.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => onStartCall(patient)}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-deep text-white font-semibold text-xs transition-all cursor-pointer"
            >
              Retry Call
            </button>
            <button
              type="button"
              onClick={onGoToQueue}
              className="px-5 py-2.5 rounded-xl bg-fog text-ink font-medium text-xs transition-all cursor-pointer border border-card-border"
            >
              Return to Queue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. STATE: CONNECTED (Active Consultation Workspace)
  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Active Patient Status Bar */}
      <div className="w-full bg-card rounded-2xl p-3 px-5 shadow-sm border border-card-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <Avatar
              src={patient.avatar_url}
              name={patientDisplayName}
              size={40}
              domain="emergency"
              className="ring-2 ring-ink/5"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success ring-2 ring-white"></span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <span className="text-base font-bold text-ink tracking-tight truncate">
              {patientDisplayName}, {patient.demographics.age || 54} yrs
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-success-tint text-success-deep text-2xs font-semibold shrink-0">
              <Icon name="verified" size={14} />
              Call Connected (Live)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Live Call Duration */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-base text-ink font-mono text-footnote font-semibold border border-ink/5">
            <span className="w-2 h-2 rounded-full bg-success animate-ping"></span>
            <span>{formatTimer(secondsElapsed)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-ink-muted text-xs font-medium bg-base px-2.5 py-1 rounded-full border border-ink/5">
            <Icon name="lock" size={15} tone="primary" weight="duotone" />
            <span>ABDM Encrypted</span>
          </div>

          <button
            onClick={onRequestRecordAccess}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-tint hover:bg-primary/10 text-primary text-xs font-semibold transition-all active:scale-95 cursor-pointer"
          >
            <Icon name="key" size={16} />
            <span>Request Diagnostic Record</span>
          </button>
        </div>
      </div>

      {/* Permission Notification Banner if Denied */}
      {mediaPermission === 'denied' && (
        <div className="w-full bg-warning/10 border border-warning/30 rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-ink">
          <div className="flex items-center gap-2.5">
            <Icon name="videoOff" size={20} tone="warning" weight="duotone" />
            <span className="font-medium">
              {mediaError || 'Camera & microphone permission needed for telehealth video stream.'}
            </span>
          </div>
          <button
            onClick={requestMediaAccess}
            className="px-3 py-1 rounded-lg bg-warning-deep text-white font-semibold text-xs hover:bg-warning-deep/90 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            Grant Camera Access
          </button>
        </div>
      )}

      {/* Main 3-Column Consultation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* 1. Left Column: Patient Clinical Summary (3 cols) */}
        <aside className="lg:col-span-3 bg-card rounded-2xl p-4 shadow-sm border border-card-border flex flex-col gap-3.5">
          <div className="flex flex-col items-center text-center pb-2 border-b border-card-border">
            <div className="relative w-16 h-16 mb-2">
              <Avatar
                src={patient.avatar_url}
                name={patientDisplayName}
                size={64}
                domain="emergency"
                className="shadow-sm ring-1 ring-ink/10"
              />
              <span className="absolute -bottom-1 right-0 bg-primary text-white p-1 rounded-full shadow-sm flex items-center justify-center">
                <Icon name="person" size={13} />
              </span>
            </div>
            <h2 className="text-lg font-bold text-ink tracking-tight leading-tight">{patientDisplayName}</h2>
            <span className="text-2xs font-mono text-ink-muted mt-0.5">{patient.abha_address}</span>
          </div>

          {/* Metric Badges Stack */}
          <div className="flex flex-col gap-2">
            {/* Complaint */}
            <div className="p-2.5 rounded-xl bg-base flex items-center gap-2.5 border border-card-border">
              <span className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-primary shrink-0 shadow-2xs">
                <Icon name="symptom" size={18} />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-4xs font-semibold text-ink-muted uppercase tracking-wider">Chief Complaint</span>
                <span className="text-xs font-semibold text-ink truncate">{formatLocalizedComplaint(patient.complaint, selectedLanguage) || 'Not recorded'}</span>
              </div>
            </div>

            {/* Critical Allergy */}
            {patient.allergies && patient.allergies.length > 0 && (
              <div className="p-2.5 rounded-xl bg-danger-tint text-danger-deep flex items-center gap-2.5 border border-danger/20">
                <span className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-danger-deep shrink-0 shadow-2xs">
                  <Icon name="warning" size={18} />
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-4xs font-semibold uppercase tracking-wider">Documented Allergy</span>
                  <span className="text-xs font-semibold truncate">{stripNonLatinParentheses(patient.allergies.join(', '))}</span>
                </div>
              </div>
            )}

            {/* Active Rx */}
            <div className="p-2.5 rounded-xl bg-base flex items-center gap-2.5 border border-ink/5">
              <span className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-primary shrink-0 shadow-2xs">
                <Icon name="medication" size={18} />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-4xs font-semibold text-ink-muted uppercase tracking-wider">Current Meds</span>
                <span className="text-xs font-semibold text-ink truncate">
                  {patient.active_rx?.join(', ') || 'None recorded'}
                </span>
              </div>
            </div>

            {/* Vitals */}
            <div className="p-2.5 rounded-xl bg-base flex items-center gap-2.5 border border-ink/5">
              <span className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-success-deep shrink-0 shadow-2xs">
                <Icon name="vitals" size={18} />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-4xs font-semibold text-ink-muted uppercase tracking-wider">Vitals Recorded</span>
                <span className="text-xs font-semibold text-ink truncate">{patient.vitals || 'Not recorded'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onRequestRecordAccess}
            className="w-full py-2 px-3 rounded-xl bg-base hover:bg-fog text-ink text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-ink/5 cursor-pointer"
          >
            <Icon name="history" size={16} />
            <span>Inspect Health Records</span>
          </button>
        </aside>

        {/* 2. Centre Column: Adaptive Telehealth Suite (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <div className="relative w-full aspect-[4/3] bg-night rounded-3xl overflow-hidden shadow-lg border border-ink/10 flex items-center justify-center">
            {/* Patient's voice */}
            <audio ref={remoteAudioRef} autoPlay className="hidden" />
            {/* MAIN STAGE VIDEO: Swappable between Patient Feed and Doctor Webcam */}
            {isSwappedView ? (
              /* Doctor Webcam is on Main Stage */
              isCamOn && localStream ? (
                <video
                  ref={fullVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-white">
                  <Icon name="videoOff" size={36} tone="ice" weight="duotone" />
                  <span className="text-xs text-ice">Your Camera is Off</span>
                </div>
              )
            ) : (
              /* Patient's live video is on Main Stage */
              patientLive ? (
                <StreamVideo
                  stream={remoteStream}
                  className={`absolute inset-0 w-full h-full object-cover ${networkTier === 'audio' ? 'blur-md opacity-40' : ''}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 text-white px-6 text-center">
                  <Avatar
                    src={patient.avatar_url}
                    name={patientDisplayName}
                    size={80}
                    domain="emergency"
                    className="ring-2 ring-white/30"
                  />
                  <span className="text-sm font-semibold">{patientDisplayName}</span>
                  <span className="text-xs text-ice" aria-live="polite">{patientStatus}</span>
                </div>
              )
            )}

            {/* Audio Waveform Overlay when in Audio mode */}
            {networkTier === 'audio' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-night/70 backdrop-blur-xs">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-6 bg-success rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-12 bg-primary rounded-full animate-pulse"></span>
                  <span className="w-1.5 h-8 bg-warning rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-14 bg-success rounded-full animate-pulse"></span>
                  <span className="w-1.5 h-6 bg-primary rounded-full animate-bounce"></span>
                </div>
                <span className="text-2xs font-semibold text-white bg-night/70 px-3 py-1 rounded-full">
                  Audio Priority Mode (50 kbps)
                </span>
              </div>
            )}

            {/* Network Tier Selector Badge */}
            <div className="absolute top-3 left-3 z-30">
              <div className="inline-flex items-center gap-1.5 p-1 px-2.5 rounded-full bg-night/70 backdrop-blur-md shadow-md text-xs font-semibold text-white border border-white/10">
                <span
                  className={`w-2 h-2 rounded-full ${
                    networkTier === 'hd' ? 'bg-success' : networkTier === 'audio' ? 'bg-warning' : 'bg-danger'
                  }`}
                ></span>
                <select
                  aria-label="Network mode"
                  value={networkTier}
                  onChange={(e) => setNetworkTier(e.target.value as any)}
                  className="bg-transparent font-medium text-2xs focus:outline-none cursor-pointer text-white"
                >
                  <option value="hd" className="text-ink">HD Video (450 kbps)</option>
                  <option value="audio" className="text-ink">Audio Priority (50 kbps)</option>
                  <option value="async" className="text-ink">Store & Forward (5 kbps)</option>
                </select>
              </div>
            </div>

            {/* Audio Live Indicator */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
              {connection === 'connected' && !remoteMedia.audio && (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-night/70 text-white backdrop-blur-md text-2xs font-semibold border border-white/10">
                  <Icon name="micOff" size={14} weight="duotone" className="text-warning" />
                  <span className="text-3xs text-warning">Patient muted</span>
                </div>
              )}
              {isMicOn && (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-night/70 text-white backdrop-blur-md text-2xs font-semibold border border-white/10">
                  <Icon name="mic" size={14} weight="duotone" className="text-success" />
                  <span className="text-3xs text-success-deep">Live</span>
                </div>
              )}
            </div>

            {/* PIP Self-View (Interactive & Click to Swap View) */}
            <div
              onClick={() => setIsSwappedView(!isSwappedView)}
              role="button"
              tabIndex={0}
              aria-label="Swap main view and picture-in-picture"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.currentTarget.click();
                }
              }}
              className="absolute bottom-16 right-3 w-28 h-36 rounded-2xl overflow-hidden shadow-lg z-30 border-2 border-white/40 bg-night cursor-pointer group transition-transform hover:scale-105"
              title="Click to swap main view and PIP"
            >
              {!isSwappedView ? (
                /* Doctor Live Webcam in PIP */
                isCamOn && localStream ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-night text-white/70 p-2 text-center">
                    <Icon name="videoOff" size={24} tone="ice" weight="duotone" />
                    <span className="text-3xs mt-1 font-medium leading-tight">
                      {mediaPermission === 'denied' ? 'Cam Blocked' : 'Camera Off'}
                    </span>
                  </div>
                )
              ) : (
                /* Patient's live video in PIP when swapped */
                patientLive ? (
                  <StreamVideo stream={remoteStream} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-night text-white/70 p-2 text-center">
                    <Icon name="videoOff" size={24} tone="ice" weight="duotone" />
                    <span className="text-3xs mt-1 font-medium leading-tight">{patientStatus || 'Patient'}</span>
                  </div>
                )
              )}

              {/* PIP Label badge with status */}
              <div className="absolute bottom-1.5 left-2 flex items-center gap-1 bg-night/70 px-1.5 py-0.5 rounded text-3xs font-semibold text-white backdrop-blur-xs">
                <span>{!isSwappedView ? 'You (Doc)' : 'Patient'}</span>
                {!isMicOn && <Icon name="micOff" size={11} weight="duotone" className="text-danger" label="Microphone muted" />}
              </div>

              {/* Hover swap icon */}
              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 bg-night/70 p-1 rounded-full text-white transition-opacity">
                <Icon name="swap" size={13} />
              </div>
            </div>

            {/* In-Call Floating Liquid Glass Control Bar */}
            <div className="absolute bottom-3 inset-x-0 mx-auto w-fit z-30 px-3 py-1.5 rounded-full glass shadow-lg flex items-center gap-2.5">
              {/* Mic Toggle */}
              <button
                onClick={toggleMic}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isMicOn ? 'bg-fog/80 text-ink hover:bg-fog' : 'bg-danger-deep text-white'
                }`}
                title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
                aria-label="Mute microphone"
                aria-pressed={!isMicOn}
              >
                <Icon name={isMicOn ? 'mic' : 'micOff'} size={18} />
              </button>

              {/* Camera Toggle */}
              <button
                onClick={toggleCam}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isCamOn ? 'bg-fog/80 text-ink hover:bg-fog' : 'bg-danger-deep text-white'
                }`}
                title={isCamOn ? 'Turn Video Off' : 'Turn Video On'}
                aria-label="Turn camera off"
                aria-pressed={!isCamOn}
              >
                <Icon name={isCamOn ? 'video' : 'videoOff'} size={18} />
              </button>

              {/* Speaker Toggle */}
              <button
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isSpeakerOn ? 'bg-fog/80 text-ink hover:bg-fog' : 'bg-danger-deep text-white'
                }`}
                title="Toggle Speaker"
                aria-label="Mute speaker"
                aria-pressed={!isSpeakerOn}
              >
                <Icon name={isSpeakerOn ? 'listen' : 'speakerOff'} size={18} />
              </button>

              {/* Swap View Button */}
              <button
                onClick={() => setIsSwappedView(!isSwappedView)}
                className="w-9 h-9 rounded-full bg-fog/80 text-ink hover:bg-fog flex items-center justify-center transition-all cursor-pointer"
                title="Swap Full Screen & PIP"
                aria-label="Swap main view and picture-in-picture"
              >
                <Icon name="cameraSwitch" size={18} />
              </button>

              {/* Hangup Call */}
              <button
                onClick={handleEndCall}
                className="w-9 h-9 rounded-full bg-danger-deep hover:bg-danger-pressed text-white flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer"
                title="End Consultation"
                aria-label="End consultation"
              >
                <Icon name="callEnd" size={18} />
              </button>
            </div>
          </div>

          {/* Vernacular Bhashini Transcription Banner */}
          <div className="w-full bg-card p-2.5 px-3.5 rounded-xl flex items-center justify-between text-xs border border-ink/5 shadow-sm">
            <div className="flex items-center gap-2 text-ink font-medium">
              <Icon name="hearing" size={18} tone="primary" weight="duotone" />
              <span>Bhashini Multilingual Speech Engine (Kannada / Hindi)</span>
            </div>
            <span className="text-3xs font-semibold text-success-deep bg-success-tint px-2 py-0.5 rounded-full">
              98% Clinical Accuracy
            </span>
          </div>
        </section>

        {/* 3. Right Column: AI Ambient Scribe & CDSS Panel (4 cols) */}
        <section className="lg:col-span-4 bg-card rounded-2xl p-4 shadow-sm border border-ink/5 flex flex-col justify-between min-h-[500px]">
          <div className="flex flex-col gap-3">
            {/* AI Draft Header Banner (Apple Intelligence Style) */}
            <div className="w-full rounded-xl bg-gradient-to-r from-primary/10 via-primary/10 to-ice/10 border border-primary/20 text-ink p-2.5 px-3.5 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <Icon name="aiAssist" size={18} tone="primary" weight="duotone" />
                <span>Ambient Clinical Scribe</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
            </div>

            {/* CDSS Safety Alert */}
            {ddiWarning && (
              <div className="p-2.5 rounded-xl bg-danger-tint border border-danger/20 text-danger-deep flex flex-col gap-0.5">
                <div className="flex items-center gap-1 font-semibold text-xs">
                  <Icon name="drugAlert" size={16} />
                  <span>Safety Contraindication (CDSS)</span>
                </div>
                <span className="text-2xs leading-tight">{ddiWarning}</span>
              </div>
            )}

            {/* SOAP Scribe Items */}
            <div className="flex flex-col gap-2">
              <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">
                Generated SOAP Draft Elements
              </span>
              <div className="flex flex-col gap-2">
                {scribeItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                      item.confirmed
                        ? 'bg-success/5 border-success/30 text-ink'
                        : 'bg-base border-ink/5 text-ink-muted'
                    }`}
                  >
                    <label className="flex flex-col min-w-0 pr-2 flex-1">
                      <span className="text-3xs font-bold text-ink-muted uppercase">{item.label}</span>
                      <input
                        value={item.value}
                        placeholder={item.placeholder}
                        onChange={(e) => updateScribeValue(item.id, e.target.value)}
                        disabled={consultationCompleted}
                        className="font-medium bg-transparent outline-none min-w-0 placeholder:text-ink-inset"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => item.value.trim() && toggleConfirm(item.id)}
                      title={item.confirmed ? 'Exclude from signed note' : 'Include in signed note'}
                      aria-label="Include in signed note"
                      aria-pressed={item.confirmed}
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 cursor-pointer ${
                        item.confirmed ? 'bg-success-deep text-white' : 'bg-ink/10 text-transparent'
                      }`}
                    >
                      <Icon name="check" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Actions: Sign Note & Complete */}
          <div className="pt-4 border-t border-ink/5 flex flex-col gap-2">
            {signError && (
              <div className="text-2xs text-danger-deep bg-danger-tint px-3 py-2 rounded-xl">{signError}</div>
            )}
            {consultationCompleted ? (
              <div className="w-full py-3 bg-success-tint text-success-deep font-bold text-center rounded-xl text-xs flex items-center justify-center gap-1.5 animate-pulse">
                <Icon name="verified" size={18} />
                <span>SOAP Note Digitally Signed • Synchronized to ABDM Vault</span>
              </div>
            ) : (
              <button
                onClick={handleCompleteConsultation}
                disabled={isSigning}
                className="disabled:opacity-60 w-full h-11 rounded-xl bg-primary hover:bg-primary-deep text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Icon name="sign" size={16} />
                <span>{isSigning ? 'Signing…' : 'Sign SOAP Note & Complete Consultation'}</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
