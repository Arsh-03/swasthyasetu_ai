// Things that must appear on any page: the ringing card and the patient's recording-consent dialog.

import React, { useState } from 'react';
import { PhoneCall, PhoneOff, Phone, ShieldCheck } from 'lucide-react';
import type { CallLanguage as Language } from '../../services/call/callTypes';
import { CONSENT_TEXT } from '../../services/call/consentText';
import './ConsultationCall.css';

interface IncomingProps {
  callerName: string;
  video: boolean;
  onAccept: (video: boolean) => void;
  onDecline: () => void;
}

export const IncomingCallCard: React.FC<IncomingProps> = ({ callerName, video, onAccept, onDecline }) => (
  <div className="cc-ring" role="alertdialog" aria-labelledby="cc-ring-title">
    <div className="cc-ring-icon" aria-hidden="true"><PhoneCall size={22} /></div>
    <div className="cc-ring-text">
      <div id="cc-ring-title" className="cc-ring-title">{callerName}</div>
      <div className="cc-ring-sub">Incoming {video ? 'video' : 'audio'} call…</div>
    </div>
    <div className="cc-ring-actions">
      {video && (
        <button type="button" className="cc-btn cc-accept" onClick={() => onAccept(true)}><PhoneCall size={16} /> Answer</button>
      )}
      <button type="button" className={`cc-btn ${video ? '' : 'cc-accept'}`} onClick={() => onAccept(false)}>
        <Phone size={16} /> {video ? 'Audio only' : 'Answer'}
      </button>
      <button type="button" className="cc-btn cc-end" onClick={onDecline}><PhoneOff size={16} /> Decline</button>
    </div>
  </div>
);

interface ConsentProps {
  doctorName: string;
  language: Language;
  onRespond: (accepted: boolean) => void;
}

export const RecordingConsentDialog: React.FC<ConsentProps> = ({ doctorName, language, onRespond }) => {
  const [lang, setLang] = useState<Language>(language);
  const copy = CONSENT_TEXT[lang];
  return (
    <div className="cc-modal-backdrop">
      <div className="cc-modal" role="dialog" aria-modal="true" aria-labelledby="cc-consent-title">
        <div className="cc-lang">
          {(['en', 'hi', 'kn'] as Language[]).map(l => (
            <button key={l} type="button" className={lang === l ? 'active' : ''} onClick={() => setLang(l)}>
              {l === 'en' ? 'English' : l === 'hi' ? 'हिन्दी' : 'ಕನ್ನಡ'}
            </button>
          ))}
        </div>
        <div className="cc-modal-heading"><ShieldCheck size={18} /> {copy.heading}</div>
        <h3 id="cc-consent-title">{copy.title(doctorName)}</h3>
        <ul className="cc-points">
          {copy.points.map(p => <li key={p.label}><strong>{p.label}:</strong> {p.text}</li>)}
        </ul>
        <div className="cc-modal-actions">
          <button type="button" className="cc-btn cc-deny" onClick={() => onRespond(false)}>{copy.deny}</button>
          <button type="button" className="cc-btn cc-allow" onClick={() => onRespond(true)}>{copy.allow}</button>
        </div>
      </div>
    </div>
  );
};
