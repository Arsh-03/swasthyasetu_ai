// Floating Picture-in-Picture (PiP) consultation call window:
// Automatically shifts into this mode when the doctor navigates to any other tab/page in the portal.
// Provides live video (or audio avatar), local video inset, and full call controls:
// Mic mute, Camera toggle, Speaker mute, Native OS PiP pop-out, Patient Records shortcut, Return to meeting, and Hang up.

import React, { useEffect, useRef, useState } from 'react';
import type { ConsultationCallApi } from '../../services/call/useConsultationCall';
import { useCallTimer } from '../../services/call/useCallTimer';
import type { PatientSummary } from '../../services/api';
import { navigate } from '../../portal/router';
import { usePortal } from '../../portal/PortalContext';
import { Icon } from '../ui/Icon';
import './ConsultationCall.css';

interface Props {
  call: ConsultationCallApi;
  title: string;
  patient?: PatientSummary | null;
  appointmentId?: string | null;
  onOpenRecords?: () => void;
  panel?: React.ReactNode;
  children?: React.ReactNode;
}

type PipSize = 'min' | 'normal' | 'expanded';

export const CallPipWindow: React.FC<Props> = ({
  call,
  title,
  patient,
  appointmentId,
  onOpenRecords,
  children,
}) => {
  const { t, speakerOn, setSpeakerOn } = usePortal();
  const [size, setSize] = useState<PipSize>('normal');
  const timer = useCallTimer(call.callStartedAt);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.setAttribute('autopictureinpicture', '');
      if (call.remoteStream) {
        remoteVideoRef.current.srcObject = call.remoteStream;
      }
    }
  }, [call.remoteStream, call.remoteHasVideo, call.callState]);

  useEffect(() => {
    if (localVideoRef.current && call.localStream) {
      localVideoRef.current.srcObject = call.localStream;
    }
  }, [call.localStream, call.camOff, call.callState]);

  // Native Browser PiP handler
  const handleNativePip = async () => {
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch {}
      return;
    }
    if (remoteVideoRef.current) {
      try {
        await remoteVideoRef.current.requestPictureInPicture();
      } catch {}
    }
  };

  // Records shortcut
  const handleViewRecords = () => {
    if (onOpenRecords) {
      onOpenRecords();
    }
    if (appointmentId) {
      // Navigate to meeting room and indicate records tab
      window.sessionStorage.setItem('open_meeting_tab', 'records');
      navigate({ page: 'meeting', appointmentId });
    } else if (patient) {
      navigate({ page: 'patient', patientId: patient.patient_id, tab: 'records' });
    }
  };

  const handleReturnToMeeting = () => {
    if (appointmentId) {
      navigate({ page: 'meeting', appointmentId });
    } else {
      window.location.hash = '#/home';
    }
  };

  return (
    <aside
      className={`cc-pip-container cc-pip-${size}`}
      aria-label={`Picture-in-Picture: ${title}`}
    >
      {/* Top Header Bar */}
      <div className="cc-pip-bar">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="cc-pip-title" title={title}>
          {title}
        </span>
        {timer && <span className="text-3xs font-mono font-bold text-teal-300">● {timer}</span>}
        {call.recordingSession && (
          <span className="text-3xs font-bold text-rose-400 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> REC
          </span>
        )}

        {/* Size & Min toggles */}
        <button
          type="button"
          onClick={() => setSize(size === 'min' ? 'normal' : 'min')}
          className="cc-icon-btn"
          aria-label={size === 'min' ? 'Expand PiP' : 'Minimize PiP'}
          title={size === 'min' ? 'Expand PiP' : 'Minimize PiP'}
        >
          <Icon name={size === 'min' ? 'expand' : 'collapse'} size={14} />
        </button>
        {size !== 'min' && (
          <button
            type="button"
            onClick={() => setSize(size === 'expanded' ? 'normal' : 'expanded')}
            className="cc-icon-btn"
            aria-label={size === 'expanded' ? 'Smaller' : 'Larger'}
            title={size === 'expanded' ? 'Smaller' : 'Larger'}
          >
            <Icon name={size === 'expanded' ? 'collapse' : 'expand'} size={14} />
          </button>
        )}
      </div>

      {/* Main Video / Audio Stage */}
      {size !== 'min' && (
        <div className="cc-pip-stage">
          {call.remoteHasVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              className="cc-pip-video"
              data-call-pip-target="true"
            />
          ) : (
            <div className="cc-pip-audio-fallback">
              <div className="w-16 h-16 rounded-full bg-teal-600/40 border border-teal-400 flex items-center justify-center text-white text-xl font-bold animate-pulse">
                {title ? title.slice(0, 2).toUpperCase() : 'PT'}
              </div>
              <p className="text-xs font-semibold text-white/90">{title}</p>
              <span className="text-3xs text-teal-300 font-mono">Audio Consultation Active</span>
            </div>
          )}

          {/* Self view inset if doctor has video */}
          {call.withVideo && !call.camOff && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="cc-pip-local"
              title="You"
            />
          )}

          {/* Floating badge for return */}
          <button
            type="button"
            onClick={handleReturnToMeeting}
            className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-black/60 hover:bg-black/80 text-white text-3xs font-semibold backdrop-blur flex items-center gap-1 transition-colors cursor-pointer"
            title={t('backToMeeting')}
          >
            <Icon name="expand" size={10} />
            <span>{t('backToMeeting')}</span>
          </button>
        </div>
      )}

      {/* PiP Action Controls */}
      <div className="cc-pip-controls">
        {/* Mic toggle */}
        <button
          type="button"
          onClick={call.toggleMic}
          aria-pressed={!call.micOff}
          title={call.micOff ? t('unmuteMic') : t('muteMic')}
          className={`cc-pip-ctrl-btn ${call.micOff ? 'off' : 'active'}`}
        >
          <Icon name={call.micOff ? 'micOff' : 'mic'} size={14} />
          <span>{call.micOff ? 'Muted' : 'Mic On'}</span>
        </button>

        {/* Camera toggle */}
        {call.withVideo && (
          <button
            type="button"
            onClick={call.toggleCam}
            aria-pressed={!call.camOff}
            title={call.camOff ? t('turnCameraOn') : t('turnCameraOff')}
            className={`cc-pip-ctrl-btn ${call.camOff ? 'off' : 'active'}`}
          >
            <Icon name={call.camOff ? 'videoOff' : 'video'} size={14} />
            <span>{call.camOff ? 'Cam Off' : 'Cam On'}</span>
          </button>
        )}

        {/* Speaker toggle */}
        {setSpeakerOn && (
          <button
            type="button"
            onClick={() => setSpeakerOn(!speakerOn)}
            aria-pressed={speakerOn}
            title={speakerOn ? t('muteSpeaker') : t('unmuteSpeaker')}
            className={`cc-pip-ctrl-btn ${!speakerOn ? 'off' : ''}`}
          >
            <Icon name={speakerOn ? 'speaker' : 'speakerOff'} size={14} />
          </button>
        )}

        {/* Native Browser PiP popout */}
        <button
          type="button"
          onClick={() => void handleNativePip()}
          title={t('enterPip')}
          className="cc-pip-ctrl-btn"
        >
          <Icon name="pip" size={14} />
        </button>

        {/* Patient records on call shortcut */}
        <button
          type="button"
          onClick={handleViewRecords}
          title={t('viewRecords')}
          className="cc-pip-ctrl-btn"
        >
          <Icon name="records" size={14} />
          <span>{t('tabRecords')}</span>
        </button>

        {/* End Call button */}
        <button
          type="button"
          onClick={call.endCall}
          title={t('endCall')}
          className="cc-pip-ctrl-btn danger"
        >
          <Icon name="callEnd" size={14} />
          <span>{t('endCall')}</span>
        </button>
      </div>

      {children && <div className="p-2 bg-slate-900 border-t border-white/10">{children}</div>}
    </aside>
  );
};

// Also export as CallWindow for backward compatibility
export const CallWindow = CallPipWindow;
export default CallPipWindow;
