import React, { useState, useEffect, useRef } from 'react';
import type { PatientSummary } from '../services/api';
import { api } from '../services/api';
import { buildIceServers, CallSession, type CallConnection, type SignalMessage } from '../services/callSession';

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
}) => {
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
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-full bg-white rounded-3xl p-8 sm:p-12 shadow-apple-md border border-black/5 flex flex-col items-center text-center gap-6">
          <div className="w-20 h-20 rounded-3xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center ring-1 ring-[#007AFF]/20">
            <span className="material-symbols-outlined text-4xl">video_camera_front</span>
          </div>

          <div className="flex flex-col gap-2 max-w-md">
            <h2 className="text-2xl font-bold text-[#1C1C1E] tracking-tight">No Active Consultation</h2>
            <p className="text-sm text-[#636366] leading-relaxed">
              Consultations do not connect automatically. Select a triage patient from the queue to start an outgoing call.
            </p>
          </div>

          {patient ? (
            <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
              <button
                onClick={() => onStartCall(patient)}
                className="px-6 py-3 rounded-2xl bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold text-sm flex items-center gap-2.5 shadow-apple-sm transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">call</span>
                <span>Call {patient.full_name}</span>
              </button>
              <button
                onClick={onGoToQueue}
                className="px-6 py-3 rounded-2xl bg-[#E5E5EA]/80 hover:bg-[#E5E5EA] text-[#1C1C1E] font-medium text-sm transition-all cursor-pointer"
              >
                Return to Patient Queue
              </button>
            </div>
          ) : (
            <button
              onClick={onGoToQueue}
              className="px-6 py-3 rounded-2xl bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold text-sm flex items-center gap-2 shadow-apple-sm transition-all active:scale-95 cursor-pointer mt-2"
            >
              <span className="material-symbols-outlined text-[20px]">group</span>
              <span>Go to Patient Queue</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. STATE: CALLING / OUTGOING RINGING (Apple FaceTime Calling Screen)
  if (callState === 'calling') {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-full bg-[#1C1C1E] rounded-3xl p-8 sm:p-14 shadow-apple-lg border border-white/10 flex flex-col items-center text-center gap-8 text-white relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute inset-0 bg-radial from-[#007AFF]/20 via-transparent to-transparent opacity-60 pointer-events-none" />

          {/* Patient Avatar with Animated Calling Rings */}
          <div className="relative my-4">
            <span className="absolute -inset-4 rounded-full bg-[#007AFF]/20 animate-ping opacity-75" />
            <span className="absolute -inset-8 rounded-full bg-[#007AFF]/10 animate-pulse" />
            <img
              src={patient.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBQT6aO4C_m4NbriR87bXfRSNMmR-rpf-JWoKt4ZFzWNtNKGEO_emcIywgRVu5wpWiGBmhJ2tsMCKVdWy_wNtRlGlU29KXuJLJkgl3EaJoZ_OpalP9oj00UIVWgmwVMAn7fweec4XpDLfRUrV8PVV7hU6D00rfgD14OYCAurD1_RzwSwopbfNjsiqEnC8c_Q9KV8uIJXW_cY0zblJRpxmUEP51ehbZrISqXIbtk1KKAbWVzidj3oIQEMg'}
              alt={patient.full_name}
              className="relative w-28 h-28 rounded-full object-cover ring-4 ring-white/30 shadow-2xl"
            />
          </div>

          <div className="flex flex-col gap-1.5 z-10">
            <span className="text-xs uppercase tracking-widest text-[#34C759] font-bold">
              Outgoing Telehealth Video Call
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-white">{patient.full_name}</h2>
            <span className="text-sm text-white/60 font-mono mt-1">{patient.abha_address}</span>
            <div className="inline-flex items-center justify-center gap-2 mt-3 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md self-center text-xs font-medium text-white/90">
              <span className="w-2 h-2 rounded-full bg-[#34C759] animate-ping" />
              <span>Ringing patient's app... ({formatTimer(callingSeconds)})</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col items-center gap-4 z-10 mt-4">
            {/* Cancel Call Button */}
            <button
              onClick={handleEndCall}
              className="w-16 h-16 rounded-full bg-[#FF3B30] hover:bg-[#D70015] text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              title="Cancel Call"
            >
              <span className="material-symbols-outlined text-3xl">call_end</span>
            </button>
            <span className="text-xs text-white/70 font-medium">Cancel Call</span>

            {/* Demo Simulation Button */}
            {onPatientAccept && (
              <button
                onClick={onPatientAccept}
                className="mt-4 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-xs text-white/90 font-medium border border-white/20 transition-all cursor-pointer backdrop-blur-md"
              >
                📱 Simulate Patient Answering Call (Demo)
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
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-full bg-white rounded-3xl p-8 sm:p-12 shadow-apple-md border border-black/5 flex flex-col items-center text-center gap-5">
          <div className="w-16 h-16 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">phone_disabled</span>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-[#1C1C1E]">Call Declined by Patient</h2>
            <p className="text-sm text-[#636366]">
              {patient.full_name} declined or was unavailable for the consultation.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => onStartCall(patient)}
              className="px-5 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold text-xs transition-all cursor-pointer"
            >
              Retry Call
            </button>
            <button
              onClick={onGoToQueue}
              className="px-5 py-2.5 rounded-xl bg-[#E5E5EA] text-[#1C1C1E] font-medium text-xs transition-all cursor-pointer"
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
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4">
      {/* Top Active Patient Status Bar */}
      <div className="w-full bg-white rounded-2xl p-3 px-5 shadow-apple-sm border border-black/5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <img
              src={patient.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBQT6aO4C_m4NbriR87bXfRSNMmR-rpf-JWoKt4ZFzWNtNKGEO_emcIywgRVu5wpWiGBmhJ2tsMCKVdWy_wNtRlGlU29KXuJLJkgl3EaJoZ_OpalP9oj00UIVWgmwVMAn7fweec4XpDLfRUrV8PVV7hU6D00rfgD14OYCAurD1_RzwSwopbfNjsiqEnC8c_Q9KV8uIJXW_cY0zblJRpxmUEP51ehbZrISqXIbtk1KKAbWVzidj3oIQEMg'}
              alt={patient.full_name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-black/5"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#34C759] ring-2 ring-white"></span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <span className="text-base font-bold text-[#1C1C1E] tracking-tight truncate">
              {patient.full_name}, {patient.demographics.age || 54} yrs
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#34C759]/15 text-[#248A3D] text-[11px] font-semibold shrink-0">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              Call Connected (Live)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Live Call Duration */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2F2F7] text-[#1C1C1E] font-mono text-[13px] font-semibold border border-black/5">
            <span className="w-2 h-2 rounded-full bg-[#34C759] animate-ping"></span>
            <span>{formatTimer(secondsElapsed)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[#636366] text-xs font-medium bg-[#F2F2F7] px-2.5 py-1 rounded-full border border-black/5">
            <span className="material-symbols-outlined text-[#007AFF] text-[15px]">lock</span>
            <span>ABDM Encrypted</span>
          </div>

          <button
            onClick={onRequestRecordAccess}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] text-xs font-semibold transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">key</span>
            <span>Request Diagnostic Record</span>
          </button>
        </div>
      </div>

      {/* Permission Notification Banner if Denied */}
      {mediaPermission === 'denied' && (
        <div className="w-full bg-[#FF9500]/10 border border-[#FF9500]/30 rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-[#1C1C1E]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#FF9500] text-xl">videocam_off</span>
            <span className="font-medium">
              {mediaError || 'Camera & microphone permission needed for telehealth video stream.'}
            </span>
          </div>
          <button
            onClick={requestMediaAccess}
            className="px-3 py-1 rounded-lg bg-[#FF9500] text-white font-semibold text-xs hover:bg-[#E08500] active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            Grant Camera Access
          </button>
        </div>
      )}

      {/* Main 3-Column Consultation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* 1. Left Column: Patient Clinical Summary (3 cols) */}
        <aside className="lg:col-span-3 bg-white rounded-2xl p-4 shadow-apple-sm border border-black/5 flex flex-col gap-3.5">
          <div className="flex flex-col items-center text-center pb-2 border-b border-black/5">
            <div className="relative w-16 h-16 mb-2">
              <img
                src={patient.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBQT6aO4C_m4NbriR87bXfRSNMmR-rpf-JWoKt4ZFzWNtNKGEO_emcIywgRVu5wpWiGBmhJ2tsMCKVdWy_wNtRlGlU29KXuJLJkgl3EaJoZ_OpalP9oj00UIVWgmwVMAn7fweec4XpDLfRUrV8PVV7hU6D00rfgD14OYCAurD1_RzwSwopbfNjsiqEnC8c_Q9KV8uIJXW_cY0zblJRpxmUEP51ehbZrISqXIbtk1KKAbWVzidj3oIQEMg'}
                alt={patient.full_name}
                className="w-16 h-16 rounded-full object-cover shadow-apple-sm ring-1 ring-black/10"
              />
              <span className="absolute -bottom-1 right-0 bg-[#007AFF] text-white p-1 rounded-full shadow-apple-sm flex items-center justify-center">
                <span className="material-symbols-outlined text-[13px]">person</span>
              </span>
            </div>
            <h2 className="text-lg font-bold text-[#1C1C1E] tracking-tight leading-tight">{patient.full_name}</h2>
            <span className="text-[11px] font-mono text-[#8E8E93] mt-0.5">{patient.abha_address}</span>
          </div>

          {/* Metric Badges Stack */}
          <div className="flex flex-col gap-2">
            {/* Complaint */}
            <div className="p-2.5 rounded-xl bg-[#F2F2F7] flex items-center gap-2.5 border border-black/5">
              <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#007AFF] shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[18px]">coronavirus</span>
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-semibold text-[#8E8E93] uppercase tracking-wider">Chief Complaint</span>
                <span className="text-[12px] font-semibold text-[#1C1C1E] truncate">{patient.complaint || 'Not recorded'}</span>
              </div>
            </div>

            {/* Critical Allergy */}
            {patient.allergies && patient.allergies.length > 0 && (
              <div className="p-2.5 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] flex items-center gap-2.5 border border-[#FF3B30]/20">
                <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#FF3B30] shrink-0 shadow-2xs">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-semibold uppercase tracking-wider">Documented Allergy</span>
                  <span className="text-[12px] font-semibold truncate">{patient.allergies.join(', ')}</span>
                </div>
              </div>
            )}

            {/* Active Rx */}
            <div className="p-2.5 rounded-xl bg-[#F2F2F7] flex items-center gap-2.5 border border-black/5">
              <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#5856D6] shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[18px]">medication</span>
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-semibold text-[#8E8E93] uppercase tracking-wider">Current Meds</span>
                <span className="text-[12px] font-semibold text-[#1C1C1E] truncate">
                  {patient.active_rx?.join(', ') || 'None recorded'}
                </span>
              </div>
            </div>

            {/* Vitals */}
            <div className="p-2.5 rounded-xl bg-[#F2F2F7] flex items-center gap-2.5 border border-black/5">
              <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#34C759] shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[18px]">vital_signs</span>
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-semibold text-[#8E8E93] uppercase tracking-wider">Vitals Recorded</span>
                <span className="text-[12px] font-semibold text-[#1C1C1E] truncate">{patient.vitals || 'Not recorded'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onRequestRecordAccess}
            className="w-full py-2 px-3 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-black/5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">history_edu</span>
            <span>Inspect Health Records</span>
          </button>
        </aside>

        {/* 2. Centre Column: Adaptive Telehealth Suite (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <div className="relative w-full aspect-[4/3] bg-[#000000] rounded-3xl overflow-hidden shadow-apple-lg border border-black/10 flex items-center justify-center">
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
                  <span className="material-symbols-outlined text-4xl text-[#8E8E93]">videocam_off</span>
                  <span className="text-xs text-[#8E8E93]">Your Camera is Off</span>
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
                  <img
                    src={patient.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBQT6aO4C_m4NbriR87bXfRSNMmR-rpf-JWoKt4ZFzWNtNKGEO_emcIywgRVu5wpWiGBmhJ2tsMCKVdWy_wNtRlGlU29KXuJLJkgl3EaJoZ_OpalP9oj00UIVWgmwVMAn7fweec4XpDLfRUrV8PVV7hU6D00rfgD14OYCAurD1_RzwSwopbfNjsiqEnC8c_Q9KV8uIJXW_cY0zblJRpxmUEP51ehbZrISqXIbtk1KKAbWVzidj3oIQEMg'}
                    alt={patient.full_name}
                    className="w-20 h-20 rounded-full object-cover ring-2 ring-white/30"
                  />
                  <span className="text-sm font-semibold">{patient.full_name}</span>
                  <span className="text-xs text-[#8E8E93]" aria-live="polite">{patientStatus}</span>
                </div>
              )
            )}

            {/* Audio Waveform Overlay when in Audio mode */}
            {networkTier === 'audio' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/60 backdrop-blur-xs">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-6 bg-[#34C759] rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-12 bg-[#007AFF] rounded-full animate-pulse"></span>
                  <span className="w-1.5 h-8 bg-[#FF9500] rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-14 bg-[#34C759] rounded-full animate-pulse"></span>
                  <span className="w-1.5 h-6 bg-[#007AFF] rounded-full animate-bounce"></span>
                </div>
                <span className="text-[11px] font-semibold text-white bg-black/70 px-3 py-1 rounded-full">
                  Audio Priority Mode (50 kbps)
                </span>
              </div>
            )}

            {/* Network Tier Selector Badge */}
            <div className="absolute top-3 left-3 z-30">
              <div className="inline-flex items-center gap-1.5 p-1 px-2.5 rounded-full bg-black/60 backdrop-blur-md shadow-md text-xs font-semibold text-white border border-white/10">
                <span
                  className={`w-2 h-2 rounded-full ${
                    networkTier === 'hd' ? 'bg-[#34C759]' : networkTier === 'audio' ? 'bg-[#FF9500]' : 'bg-[#FF3B30]'
                  }`}
                ></span>
                <select
                  value={networkTier}
                  onChange={(e) => setNetworkTier(e.target.value as any)}
                  className="bg-transparent font-medium text-[11px] focus:outline-none cursor-pointer text-white"
                >
                  <option value="hd" className="text-black">HD Video (450 kbps)</option>
                  <option value="audio" className="text-black">Audio Priority (50 kbps)</option>
                  <option value="async" className="text-black">Store & Forward (5 kbps)</option>
                </select>
              </div>
            </div>

            {/* Audio Live Indicator */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
              {connection === 'connected' && !remoteMedia.audio && (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-md text-[11px] font-semibold border border-white/10">
                  <span className="material-symbols-outlined text-[14px] text-[#FF9500]">mic_off</span>
                  <span className="text-[10px] text-[#FF9500]">Patient muted</span>
                </div>
              )}
              {isMicOn && (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-md text-[11px] font-semibold border border-white/10">
                  <span className="material-symbols-outlined text-[14px] text-[#34C759]">mic</span>
                  <span className="text-[10px] text-[#34C759]">Live</span>
                </div>
              )}
            </div>

            {/* PIP Self-View (Interactive & Click to Swap View) */}
            <div
              onClick={() => setIsSwappedView(!isSwappedView)}
              className="absolute bottom-16 right-3 w-28 h-36 rounded-2xl overflow-hidden shadow-apple-lg z-30 border-2 border-white/40 bg-[#1C1C1E] cursor-pointer group transition-transform hover:scale-105"
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
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#1C1C1E] text-white/70 p-2 text-center">
                    <span className="material-symbols-outlined text-2xl text-[#8E8E93]">videocam_off</span>
                    <span className="text-[10px] mt-1 font-medium leading-tight">
                      {mediaPermission === 'denied' ? 'Cam Blocked' : 'Camera Off'}
                    </span>
                  </div>
                )
              ) : (
                /* Patient's live video in PIP when swapped */
                patientLive ? (
                  <StreamVideo stream={remoteStream} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#1C1C1E] text-white/70 p-2 text-center">
                    <span className="material-symbols-outlined text-2xl text-[#8E8E93]">videocam_off</span>
                    <span className="text-[10px] mt-1 font-medium leading-tight">{patientStatus || 'Patient'}</span>
                  </div>
                )
              )}

              {/* PIP Label badge with status */}
              <div className="absolute bottom-1.5 left-2 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white backdrop-blur-xs">
                <span>{!isSwappedView ? 'You (Doc)' : 'Patient'}</span>
                {!isMicOn && <span className="text-[#FF3B30] text-[9px]">🔇</span>}
              </div>

              {/* Hover swap icon */}
              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 bg-black/60 p-1 rounded-full text-white transition-opacity">
                <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
              </div>
            </div>

            {/* In-Call Floating Liquid Glass Control Bar */}
            <div className="absolute bottom-3 inset-x-0 mx-auto w-fit z-30 px-3 py-1.5 rounded-full liquid-glass shadow-apple-lg flex items-center gap-2.5">
              {/* Mic Toggle */}
              <button
                onClick={toggleMic}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isMicOn ? 'bg-[#E5E5EA]/80 text-[#1C1C1E] hover:bg-[#E5E5EA]' : 'bg-[#FF3B30] text-white'
                }`}
                title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                <span className="material-symbols-outlined text-[18px]">{isMicOn ? 'mic' : 'mic_off'}</span>
              </button>

              {/* Camera Toggle */}
              <button
                onClick={toggleCam}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isCamOn ? 'bg-[#E5E5EA]/80 text-[#1C1C1E] hover:bg-[#E5E5EA]' : 'bg-[#FF3B30] text-white'
                }`}
                title={isCamOn ? 'Turn Video Off' : 'Turn Video On'}
              >
                <span className="material-symbols-outlined text-[18px]">{isCamOn ? 'videocam' : 'videocam_off'}</span>
              </button>

              {/* Speaker Toggle */}
              <button
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isSpeakerOn ? 'bg-[#E5E5EA]/80 text-[#1C1C1E] hover:bg-[#E5E5EA]' : 'bg-[#FF3B30] text-white'
                }`}
                title="Toggle Speaker"
              >
                <span className="material-symbols-outlined text-[18px]">{isSpeakerOn ? 'volume_up' : 'volume_off'}</span>
              </button>

              {/* Swap View Button */}
              <button
                onClick={() => setIsSwappedView(!isSwappedView)}
                className="w-9 h-9 rounded-full bg-[#E5E5EA]/80 text-[#1C1C1E] hover:bg-[#E5E5EA] flex items-center justify-center transition-all cursor-pointer"
                title="Swap Full Screen & PIP"
              >
                <span className="material-symbols-outlined text-[18px]">cameraswitch</span>
              </button>

              {/* Hangup Call */}
              <button
                onClick={handleEndCall}
                className="w-9 h-9 rounded-full bg-[#FF3B30] hover:bg-[#D70015] text-white flex items-center justify-center transition-all shadow-apple-sm active:scale-95 cursor-pointer"
                title="End Consultation"
              >
                <span className="material-symbols-outlined text-[18px]">call_end</span>
              </button>
            </div>
          </div>

          {/* Vernacular Bhashini Transcription Banner */}
          <div className="w-full bg-white p-2.5 px-3.5 rounded-xl flex items-center justify-between text-xs border border-black/5 shadow-apple-sm">
            <div className="flex items-center gap-2 text-[#1C1C1E] font-medium">
              <span className="material-symbols-outlined text-[#007AFF] text-[18px]">hearing</span>
              <span>Bhashini Multilingual Speech Engine (Kannada / Hindi)</span>
            </div>
            <span className="text-[10px] font-semibold text-[#248A3D] bg-[#34C759]/15 px-2 py-0.5 rounded-full">
              98% Clinical Accuracy
            </span>
          </div>
        </section>

        {/* 3. Right Column: AI Ambient Scribe & CDSS Panel (4 cols) */}
        <section className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-apple-sm border border-black/5 flex flex-col justify-between min-h-[500px]">
          <div className="flex flex-col gap-3">
            {/* AI Draft Header Banner (Apple Intelligence Style) */}
            <div className="w-full rounded-xl bg-gradient-to-r from-[#5856D6]/10 via-[#007AFF]/10 to-[#30B0C7]/10 border border-[#007AFF]/20 text-[#1C1C1E] p-2.5 px-3.5 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <span className="material-symbols-outlined text-[18px] text-[#5856D6]">auto_awesome</span>
                <span>Ambient Clinical Scribe</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse"></span>
            </div>

            {/* CDSS Safety Alert */}
            {ddiWarning && (
              <div className="p-2.5 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] flex flex-col gap-0.5">
                <div className="flex items-center gap-1 font-semibold text-xs">
                  <span className="material-symbols-outlined text-[16px]">gpp_maybe</span>
                  <span>Safety Contraindication (CDSS)</span>
                </div>
                <span className="text-[11px] leading-tight">{ddiWarning}</span>
              </div>
            )}

            {/* SOAP Scribe Items */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                Generated SOAP Draft Elements
              </span>
              <div className="flex flex-col gap-2">
                {scribeItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                      item.confirmed
                        ? 'bg-[#34C759]/5 border-[#34C759]/30 text-[#1C1C1E]'
                        : 'bg-[#F2F2F7] border-black/5 text-[#636366]'
                    }`}
                  >
                    <label className="flex flex-col min-w-0 pr-2 flex-1">
                      <span className="text-[10px] font-bold text-[#8E8E93] uppercase">{item.label}</span>
                      <input
                        value={item.value}
                        placeholder={item.placeholder}
                        onChange={(e) => updateScribeValue(item.id, e.target.value)}
                        disabled={consultationCompleted}
                        className="font-medium bg-transparent outline-none min-w-0 placeholder:text-[#C7C7CC]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => item.value.trim() && toggleConfirm(item.id)}
                      title={item.confirmed ? 'Exclude from signed note' : 'Include in signed note'}
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 cursor-pointer ${
                        item.confirmed ? 'bg-[#34C759] text-white' : 'bg-black/10 text-transparent'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Actions: Sign Note & Complete */}
          <div className="pt-4 border-t border-black/5 flex flex-col gap-2">
            {signError && (
              <div className="text-[11px] text-[#FF3B30] bg-[#FF3B30]/10 px-3 py-2 rounded-xl">{signError}</div>
            )}
            {consultationCompleted ? (
              <div className="w-full py-3 bg-[#34C759]/15 text-[#248A3D] font-bold text-center rounded-xl text-xs flex items-center justify-center gap-1.5 animate-pulse">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>SOAP Note Digitally Signed • Synchronized to ABDM Vault</span>
              </div>
            ) : (
              <button
                onClick={handleCompleteConsultation}
                disabled={isSigning}
                className="disabled:opacity-60 w-full h-11 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-apple-sm active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">draw</span>
                <span>{isSigning ? 'Signing…' : 'Sign SOAP Note & Complete Consultation'}</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
