// Floating consultation window: opens when a call starts, so the call (and, for the doctor, the notepad)
// stay at hand on every tab. Three sizes; switching size never remounts what's inside.

import React, { useState } from 'react';
import { Maximize2, Minimize2, ChevronDown, PhoneOff, Mic, MicOff } from 'lucide-react';
import type { ConsultationCallApi } from '../../services/call/useConsultationCall';
import { useCallTimer } from '../../services/call/useCallTimer';
import './ConsultationCall.css';

type Size = 'min' | 'small' | 'large';

interface Props {
  call: ConsultationCallApi;
  title: string;
  /** The call panel. */
  panel: React.ReactNode;
  /** Optional extra content under the call (the doctor's notepad). */
  children?: React.ReactNode;
}

export const CallWindow: React.FC<Props> = ({ call, title, panel, children }) => {
  const [size, setSize] = useState<Size>('small');
  const timer = useCallTimer(call.callStartedAt);

  return (
    <section className={`cc-window cc-window-${size} ${children ? 'cc-window-has-extra' : ''}`} aria-label={title}>
      <div className="cc-window-bar">
        <strong className="cc-window-title">{title}</strong>
        {timer && <span className="cc-timer">● {timer}</span>}
        {call.recordingSession && <span className="cc-rec"><span className="cc-rec-dot" /> REC</span>}
        <span className="cc-window-spacer" />
        {size === 'min' && (
          <>
            <button type="button" className="cc-icon-btn" onClick={call.toggleMic} aria-label={call.micOff ? 'Unmute' : 'Mute'}>
              {call.micOff ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button type="button" className="cc-icon-btn cc-icon-end" onClick={call.endCall} aria-label="End call"><PhoneOff size={16} /></button>
          </>
        )}
        {size !== 'min' && (
          <button type="button" className="cc-icon-btn" onClick={() => setSize('min')} aria-label="Minimise"><ChevronDown size={16} /></button>
        )}
        <button type="button" className="cc-icon-btn" onClick={() => setSize(size === 'large' ? 'small' : 'large')}
          aria-label={size === 'large' ? 'Make smaller' : 'Make larger'}>
          {size === 'large' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      {/* Hidden (not removed) when minimised, so video and the notepad keep their state. */}
      <div className="cc-window-body" hidden={size === 'min'}>
        <div className="cc-window-call">{panel}</div>
        {children && <div className="cc-window-extra">{children}</div>}
      </div>
    </section>
  );
};
