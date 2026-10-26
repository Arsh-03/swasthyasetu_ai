// Meeting room for one appointment, like Meet / Zoom:
//   before:  pre-join lobby: camera preview, microphone level, device choice, the patient's status, Join
//   during:  video stage + controls (mic, camera, speaker, notes, AI minutes, side panel, end), floating notepad
//   after:   call summary, call again, sign the visit note
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { doctorApi, type Appointment } from '../../services/doctorApi';
import type { PatientSummary } from '../../services/api';
import { setPreferredDevices } from '../../services/call/callClient';
import { useCallTimer } from '../../services/call/useCallTimer';
import type { AiState } from '../../services/call/callTypes';
import { usePortal } from '../PortalContext';
import { hrefFor, navigate } from '../router';
import { useDevices, usePreview } from '../meeting/devices';
import { FloatingNotepad } from '../meeting/FloatingNotepad';
import { VisitNoteForm } from '../meeting/VisitNoteForm';
import { Conversation } from '../Conversation';
import { ReadingLine } from '../Readings';
import { AlertStack, AssistStrip } from '../meeting/LiveAssist';
import { Avatar, Button, Card, ErrorNote, Facts, Loading, PageHeader, Pill, SelectInput, Tabs, shortName } from '../ui';
import type { StringKey } from '../i18n';

const AI_STATE_KEY: Record<AiState, StringKey> = {
  off: 'aiOff', waiting_consent: 'aiWaitingConsent', recording: 'aiRecording', finishing: 'aiFinishing',
  declined: 'aiDeclined', withdrawn: 'aiWithdrawn', unavailable: 'aiUnavailable',
};

export function MeetingScreen({ appointmentId }: { appointmentId: string }) {
  const { t, consultation, openConsultation, call } = usePortal();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    (async () => {
      try {
        const apt = await doctorApi.appointment(appointmentId);
        if (!alive) return;
        setAppointment(apt);
        if (apt.status !== 'scheduled') return;
        // Already open (e.g. coming back to a running call): keep the same call room.
        if (consultation?.appointmentId === appointmentId) return;
        const opened = await doctorApi.openAppointment(appointmentId);
        if (!alive) return;
        setAppointment(opened.appointment);
        openConsultation(opened.patient, appointmentId);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : t('loadError'));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, attempt]);

  if (error) return <ErrorNote message={error} onRetry={() => setAttempt((n) => n + 1)} retryLabel={t('retry')} />;
  if (!appointment) return <Loading label={t('preparingRoom')} />;
  if (appointment.status !== 'scheduled' && consultation?.appointmentId !== appointmentId) {
    return (
      <Card className="p-8 max-w-xl mx-auto text-center flex flex-col items-center gap-3">
        <Icon name={appointment.status === 'completed' ? 'checkCircle' : 'info'} size={36} tone="muted" weight="duotone" />
        <p className="text-subhead font-semibold">{appointment.status === 'completed' ? t('meetingCompleted') : t('meetingCancelled')}</p>
        <div className="flex gap-2">
          {appointment.encounter_id && appointment.status === 'completed' && (
            <Button variant="primary" onClick={() => navigate({ page: 'visit', patientId: appointment.patient_id, encounterId: appointment.encounter_id! })}>
              {t('viewVisitSummary')}
            </Button>
          )}
          <Button onClick={() => navigate({ page: 'home' })}>{t('backHome')}</Button>
        </div>
      </Card>
    );
  }
  const patient = consultation?.appointmentId === appointmentId ? consultation.patient : null;
  if (!patient) return <Loading label={t('preparingRoom')} />;
  return <MeetingRoom appointment={appointment} patient={patient} key={patient.encounter_id} inCallAlready={call.callState === 'in_call'} />;
}

function MeetingRoom({ appointment, patient, inCallAlready }: { appointment: Appointment; patient: PatientSummary; inCallAlready: boolean }) {
  const { call } = usePortal();
  const [joined, setJoined] = useState(inCallAlready);
  const [notesOpen, setNotesOpen] = useState(false);
  const inCall = call.callState === 'in_call' || call.callState === 'calling';
  // Once a call has run in this room, ending it shows the summary instead of the lobby.
  useEffect(() => { if (inCall) setJoined(true); }, [inCall]);
  // AI switched on: open the notepad, where the live suggestions appear.
  const recording = call.aiState === 'recording';
  useEffect(() => { if (recording) setNotesOpen(true); }, [recording]);

  return (
    <>
      {inCall ? (
        <InCall patient={patient} notesOpen={notesOpen} onToggleNotes={() => setNotesOpen((v) => !v)} endsAt={appointment.meeting?.ends_at} />
      ) : joined ? (
        <AfterCall appointment={appointment} patient={patient} onOpenNotes={() => setNotesOpen(true)} />
      ) : (
        <PreJoin appointment={appointment} patient={patient} onOpenNotes={() => setNotesOpen(true)} />
      )}
      <NotepadWindow open={notesOpen && !inCall} onClose={() => setNotesOpen(false)} patient={patient} />
      {!inCall && <AlertStack />}
    </>
  );
}

function NotepadWindow({ open, onClose, patient }: { open: boolean; onClose: () => void; patient: PatientSummary }) {
  const { t, notepad } = usePortal();
  return (
    <FloatingNotepad open={open} onClose={onClose} title={t('notesFor', { name: shortName(patient.full_name) })}
      minimizeLabel={t('minimize')} closeLabel={t('close')}>
      <AssistStrip />
      {notepad}
    </FloatingNotepad>
  );
}

// ------------------------------------------------------------------------------------------ Pre-join

function PreJoin({ appointment, patient, onOpenNotes }: { appointment: Appointment; patient: PatientSummary; onOpenNotes: () => void }) {
  const { t, fmt, call, setSpeakerId } = usePortal();
  const devices = useDevices();
  const [camOn, setCamOn] = useState(() => localStorage.getItem('prejoin_cam') !== 'off');
  const [micOn, setMicOn] = useState(() => localStorage.getItem('prejoin_mic') !== 'off');
  const [joining, setJoining] = useState(false);
  const preview = usePreview(!joining, camOn, devices.choice, devices.refresh);
  const videoRef = useRef<HTMLVideoElement>(null);
  const desiredMic = useRef(micOn);
  desiredMic.current = micOn;

  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = preview.stream; }, [preview.stream]);
  useEffect(() => {
    try { localStorage.setItem('prejoin_cam', camOn ? 'on' : 'off'); localStorage.setItem('prejoin_mic', micOn ? 'on' : 'off'); } catch { /* */ }
  }, [camOn, micOn]);
  useEffect(() => { setSpeakerId(devices.choice.audioOutput); }, [devices.choice.audioOutput, setSpeakerId]);

  // Apply "join muted" once the call has its microphone.
  useEffect(() => {
    if (joining && call.localStream && !desiredMic.current && !call.micOff) call.toggleMic();
  }, [joining, call.localStream, call.micOff, call]);
  useEffect(() => { if (joining && call.callState === 'idle' && call.notice) setJoining(false); }, [joining, call.callState, call.notice]);

  const ready = call.connection === 'open';
  // Start the call (rings the patient's app, or admits a patient who asked to join).
  const join = async (video: boolean) => {
    setPreferredDevices({ audioInput: devices.choice.audioInput || undefined, videoInput: devices.choice.videoInput || undefined });
    call.setHostWaiting(false);
    setHostWaiting(null);
    setJoining(true); // stops the preview so the call can use the camera
    await new Promise((r) => setTimeout(r, 150));
    await call.startCall(video && camOn);
  };
  // Google Meet style: "Join meeting" admits a waiting patient, or waits in the room until they ask to join.
  const [hostWaiting, setHostWaiting] = useState<{ video: boolean } | null>(null);
  const enterMeeting = (video: boolean) => {
    if (call.waitingPatient) { void join(video); return; }
    setHostWaiting({ video });
    call.setHostWaiting(true);
  };
  const leaveWaiting = () => { setHostWaiting(null); call.setHostWaiting(false); };
  useEffect(() => {
    if (hostWaiting && call.waitingPatient) void join(hostWaiting.video);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostWaiting, call.waitingPatient]);
  useEffect(() => () => call.setHostWaiting(false), [call]);

  const startsIn = Math.round((new Date(appointment.scheduled_at).getTime() - Date.now()) / 60000);
  const level = micOn ? preview.level : 0;

  return (
    <>
      <PageHeader
        back={{ label: t('backHome'), href: '#/home' }}
        title={t('meetingWith', { name: shortName(patient.full_name) })}
        subtitle={`${fmt.dateTime(appointment.scheduled_at)} · ${t('minutesShort', { n: appointment.duration_minutes })}${startsIn > 0 ? ` · ${t('startsInMinutes', { n: startsIn })}` : ''}`}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="p-4 flex flex-col gap-4">
          <div className="relative aspect-video rounded-panel bg-night overflow-hidden flex items-center justify-center">
            {camOn && preview.stream && preview.stream.getVideoTracks().length > 0 ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
            ) : (
              <div className="flex flex-col items-center gap-3 text-ice">
                <Icon name={camOn ? 'hourglass' : 'videoOff'} size={36} weight="duotone" />
                <span className="text-sm">{preview.error === 'denied' ? t('permissionDenied') : preview.error ? t('noCamera') : camOn ? t('startingCamera') : t('cameraIsOff')}</span>
              </div>
            )}
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-3">
              <RoundButton icon={micOn ? 'mic' : 'micOff'} label={micOn ? t('muteMic') : t('unmuteMic')} off={!micOn} onClick={() => setMicOn(!micOn)} />
              <RoundButton icon={camOn ? 'video' : 'videoOff'} label={camOn ? t('turnCameraOff') : t('turnCameraOn')} off={!camOn} onClick={() => setCamOn(!camOn)} />
            </div>
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-glass-night text-white rounded-full px-3 py-1.5" aria-hidden>
              <Icon name={micOn ? 'mic' : 'micOff'} size={14} />
              <span className="flex items-end gap-0.5 h-3">
                {[0.15, 0.3, 0.5, 0.7, 0.9].map((th) => (
                  <span key={th} className={cx('w-1 rounded-full transition-colors', level > th ? 'bg-success' : 'bg-white/30')} style={{ height: `${30 + th * 70}%` }} />
                ))}
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <DevicePicker icon="mic" label={t('microphone')} value={devices.choice.audioInput} options={devices.microphones}
              onChange={(v) => devices.setChoice({ audioInput: v })} fallback={t('systemDefault')} />
            <DevicePicker icon="video" label={t('camera')} value={devices.choice.videoInput} options={devices.cameras}
              onChange={(v) => devices.setChoice({ videoInput: v })} fallback={t('systemDefault')} />
            {devices.canPickSpeaker ? (
              <DevicePicker icon="speaker" label={t('speaker')} value={devices.choice.audioOutput} options={devices.speakers}
                onChange={(v) => devices.setChoice({ audioOutput: v })} fallback={t('systemDefault')} />
            ) : (
              <div className="text-2xs text-ink-muted self-end pb-2">{t('speakerBrowserDefault')}</div>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={patient.full_name} src={patient.avatar_url} size={52} />
              <div className="min-w-0">
                <p className="text-subhead font-semibold text-ink truncate">{shortName(patient.full_name)}</p>
                <p className="text-xs text-ink-muted">
                  {[patient.demographics?.age && t('yearsOld', { n: patient.demographics.age }), patient.demographics?.gender].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            {hostWaiting ? (
              <div className="flex items-start gap-3 rounded-control px-3 py-2.5 bg-primary-tint">
                <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 bg-primary animate-pulse" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-primary">{t('hostWaitingTitle', { name: shortName(patient.full_name) })}</p>
                  <p className="text-xs text-ink-muted">{t('hostWaitingHint')}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={leaveWaiting}>{t('leaveMeeting')}</Button>
              </div>
            ) : call.waitingPatient ? (
              <div className="flex flex-col gap-2 rounded-control px-3 py-2.5 bg-success-tint">
                <p className="text-sm font-semibold text-success-deep flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" /> {t('askingToJoin', { name: shortName(call.waitingPatient.name) })}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" icon="check" onClick={() => void join(true)}>{t('admit')}</Button>
                  <Button size="sm" variant="ghost" onClick={call.denyEntry}>{t('deny')}</Button>
                </div>
              </div>
            ) : <PatientPresence />}
            <MeetingWindow appointment={appointment} />
            <Facts columns={2} items={[
              { label: t('reasonForVisit'), value: appointment.agenda || patient.complaint },
              { label: t('allergies'), value: (patient.allergies ?? []).join(', ') || t('noneRecorded') },
            ]} />
            {Object.values(patient.latest_readings ?? {}).map((r) => <ReadingLine key={r.reading_id} reading={r} compact />)}
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="lg" icon="video" disabled={!ready || joining || !!hostWaiting} onClick={() => enterMeeting(true)}>
                {joining ? t('joining') : call.waitingPatient ? t('admitAndJoin') : t('joinMeeting')}
              </Button>
              <Button size="lg" icon="call" disabled={!ready || joining || !!hostWaiting} onClick={() => enterMeeting(false)}>{t('joinAudioOnly')}</Button>
              <button type="button" disabled={!ready || joining} onClick={() => void join(true)}
                className="text-xs font-semibold text-primary hover:underline disabled:opacity-50 cursor-pointer">{t('ringPatientNow')}</button>
              {!ready && <p className="text-2xs text-ink-muted text-center">{call.connection === 'denied' ? t('roomDenied') : t('connectingRoom')}</p>}
              {call.notice && <p role="alert" className="text-xs text-warning-deep text-center">{call.notice}</p>}
            </div>
          </Card>
          <MeetingLinkCard appointment={appointment} />
          <PracticeCard onOpenNotes={onOpenNotes} />
          <div className="flex flex-wrap gap-2">
            <Button icon="notepad" onClick={onOpenNotes}>{t('openNotes')}</Button>
            <a href={hrefFor({ page: 'patient', patientId: patient.patient_id })} className="inline-flex items-center gap-2 h-10 px-4 rounded-control text-sm font-semibold text-primary hover:bg-primary-tint">
              <Icon name="person" size={18} /> {t('viewPatient')}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

/** Try the live assistant without a call: the demo conversation runs through the real pipeline. */
function PracticeCard({ onOpenNotes }: { onOpenNotes: () => void }) {
  const { t, call } = usePortal();
  const ready = call.connection === 'open';
  return (
    <Card className="p-4 flex flex-col gap-2">
      <p className="text-sm font-semibold text-ink flex items-center gap-2"><Icon name="aiAssist" size={18} tone="primary" weight="duotone" /> {t('practiceTitle')}</p>
      <p className="text-xs text-ink-muted">{t('practiceHint')}</p>
      {call.practice ? (
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="warning" dot label={t('practiceRunning')} />
          <Button size="sm" onClick={onOpenNotes}>{t('openNotes')}</Button>
          <Button size="sm" variant="ghost" onClick={call.stopPractice}>{t('practiceStop')}</Button>
        </div>
      ) : (
        <Button size="sm" icon="aiAssist" disabled={!ready} onClick={() => { call.startPractice(); onOpenNotes(); }}>{t('practiceStart')}</Button>
      )}
    </Card>
  );
}

/** The meeting's link and code, to copy or share (WhatsApp) with the patient. */
function MeetingLinkCard({ appointment }: { appointment: Appointment }) {
  const { t, fmt, toast } = usePortal();
  if (!appointment.meeting_code) return null;
  const base = (import.meta.env.VITE_PATIENT_APP_URL as string | undefined) || `${window.location.protocol}//${window.location.hostname}:8081`;
  const link = `${base}/?join=${appointment.meeting_code}`;
  const message = t('shareMessage', { when: fmt.dateTime(appointment.scheduled_at), link, code: appointment.meeting_code });
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast(t('linkCopied'), 'success'); } catch { toast(link, 'info'); }
  };
  return (
    <Card className="p-4 flex flex-col gap-2">
      <p className="text-sm font-semibold text-ink flex items-center gap-2"><Icon name="video" size={18} tone="primary" /> {t('meetingLink')}</p>
      <p className="font-mono text-lg font-semibold tracking-wide text-ink">{appointment.meeting_code}</p>
      <p className="text-xs text-ink-muted break-all">{link}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon="external" onClick={() => void copy()}>{t('copyLink')}</Button>
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control text-xs font-semibold bg-success-deep text-on-primary hover:bg-success-pressed">
          <Icon name="chat" size={14} /> {t('shareWhatsApp')}
        </a>
      </div>
    </Card>
  );
}

/** "10:30–10:50 · patients can join from 10:20" */
function MeetingWindow({ appointment }: { appointment: Appointment }) {
  const { t, fmt } = usePortal();
  const m = appointment.meeting;
  if (!m?.opens_at || !m.ends_at) return null;
  return (
    <p className="text-xs text-ink-muted flex items-center gap-1.5">
      <Icon name="clock" size={14} /> {fmt.time(appointment.scheduled_at)}–{fmt.time(m.ends_at)} · {t('patientsCanJoinFrom', { time: fmt.time(m.opens_at) })}
    </p>
  );
}

function PatientPresence() {
  const { t, call } = usePortal();
  const online = call.connection === 'open' && call.peerPresent;
  return (
    <div className={cx('flex items-start gap-3 rounded-control px-3 py-2.5', online ? 'bg-success-tint' : 'bg-ink-tint')}>
      <span className={cx('mt-1.5 w-2.5 h-2.5 rounded-full shrink-0', online ? 'bg-success animate-pulse' : 'bg-ink-muted')} />
      <div>
        <p className={cx('text-sm font-semibold', online ? 'text-success-deep' : 'text-ink')}>{online ? t('patientWaiting') : t('patientNotJoined')}</p>
        <p className="text-xs text-ink-muted">{online ? t('patientWaitingHint') : t('patientNotJoinedHint')}</p>
      </div>
    </div>
  );
}

/** "Ends in 5 min" / "Running over by 3 min" from the scheduled end. */
function EndsIn({ endsAt }: { endsAt?: string | null }) {
  const { t } = usePortal();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  if (!endsAt) return null;
  const mins = Math.round((new Date(endsAt).getTime() - now) / 60000);
  if (mins > 10) return null;
  return mins >= 0
    ? <span className="text-ice">· {t('endsInMinutes', { n: mins })}</span>
    : <span className="text-warning font-semibold">· {t('runningOver', { n: -mins })}</span>;
}

function DevicePicker({ icon, label, value, options, onChange, fallback }: {
  icon: IconName; label: string; value: string; options: MediaDeviceInfo[]; onChange: (v: string) => void; fallback: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-xs font-semibold text-ink flex items-center gap-1.5"><Icon name={icon} size={14} tone="muted" />{label}</span>
      <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{fallback}</option>
        {options.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `${label} ${i + 1}`}</option>)}
      </SelectInput>
    </label>
  );
}

function RoundButton({ icon, label, onClick, off, danger, active, disabled }: {
  icon: IconName; label: string; onClick: () => void; off?: boolean; danger?: boolean; active?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active ?? (off !== undefined ? !off : undefined)}
      disabled={disabled}
      className={cx(
        'w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        danger ? 'w-14 bg-danger-deep hover:bg-danger-pressed text-white'
          : off ? 'bg-white text-danger-deep hover:bg-ice'
          : active ? 'bg-primary text-white hover:bg-primary-deep'
          : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur',
      )}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}

// ------------------------------------------------------------------------------------------ In call

function InCall({ patient, notesOpen, onToggleNotes, endsAt }: { patient: PatientSummary; notesOpen: boolean; onToggleNotes: () => void; endsAt?: string | null }) {
  const { t, call, speakerOn, setSpeakerOn, notepad } = usePortal();
  const [panel, setPanel] = useState<'notes' | 'patient' | 'note' | 'chat' | null>(() =>
    notesOpen ? 'notes' : window.innerWidth >= 1280 ? 'patient' : null);
  // "Show notes" (or AI switched on) opens the notes tab; hiding them closes the panel.
  useEffect(() => { setPanel((p) => (notesOpen ? 'notes' : p === 'notes' ? null : p)); }, [notesOpen]);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const selfRef = useRef<HTMLVideoElement>(null);
  const timer = useCallTimer(call.callStartedAt);
  const calling = call.callState === 'calling';

  useEffect(() => { if (remoteRef.current) remoteRef.current.srcObject = call.remoteStream; }, [call.remoteStream, call.remoteHasVideo]);
  useEffect(() => { if (selfRef.current) selfRef.current.srcObject = call.localStream; }, [call.localStream, call.camOff]);

  const q = call.quality;
  const weak = !!q && (q.limitedBy === 'cpu' || (q.networkMs ?? 0) > 300 || (q.audioDelayMs ?? 0) > 250);
  const aiBusy = call.aiState === 'waiting_consent' || call.aiState === 'finishing';

  return (
    <div className="flex gap-4 h-[calc(100vh-8.5rem)] min-h-[480px] relative">
      <div className="flex-1 min-w-0 relative rounded-hero bg-night overflow-hidden">
        {call.remoteHasVideo && !calling ? (
          <video ref={remoteRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
            <div className={cx('rounded-full p-1', calling && 'animate-pulse ring-4 ring-white/20')}>
              <Avatar name={patient.full_name} src={patient.avatar_url} size={112} />
            </div>
            <p className="text-xl font-semibold">{shortName(patient.full_name)}</p>
            <p className="text-sm text-ice">{calling ? t('ringingPatient') : t('audioOnlyCall')}</p>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 p-4 flex items-start justify-between gap-3 bg-gradient-to-b from-night/80 to-transparent">
          <div className="text-white min-w-0">
            <p className="text-subhead font-semibold truncate">{shortName(patient.full_name)}</p>
            <p className="text-xs text-ice flex items-center gap-2">
              {timer && <span className="font-mono">{timer}</span>}
              <EndsIn endsAt={endsAt} />
              {q && <span className="inline-flex items-center gap-1"><Icon name="online" size={12} />{weak ? t('weakConnection') : t('goodConnection')}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {call.recordingSession && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-deep text-white text-2xs font-bold px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> {t('recordingAudio')}
              </span>
            )}
          </div>
        </div>

        {/* Self view */}
        <div className="absolute right-4 bottom-24 w-36 sm:w-48 aspect-video rounded-control overflow-hidden bg-black/40 border border-white/20 shadow-lg">
          {call.withVideo && !call.camOff ? (
            <video ref={selfRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ice"><Icon name="videoOff" size={22} /></div>
          )}
          <span className="absolute bottom-1 left-1.5 text-3xs text-white/90">{t('you')}</span>
        </div>

        {panel !== 'notes' && <AlertStack />}

        {call.notice && !calling && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-glass-night text-white text-xs rounded-full px-4 py-2">{call.notice}</div>
        )}

        {/* Controls */}
        <div className="absolute bottom-4 inset-x-0 flex justify-center px-3">
          <div className="flex items-center gap-2 sm:gap-3 rounded-full bg-glass-night backdrop-blur px-3 py-2 border border-white/10">
            <RoundButton icon={call.micOff ? 'micOff' : 'mic'} label={call.micOff ? t('unmuteMic') : t('muteMic')} off={call.micOff} onClick={call.toggleMic} />
            {call.withVideo && (
              <RoundButton icon={call.camOff ? 'videoOff' : 'video'} label={call.camOff ? t('turnCameraOn') : t('turnCameraOff')} off={call.camOff} onClick={call.toggleCam} />
            )}
            <RoundButton icon={speakerOn ? 'speaker' : 'speakerOff'} label={speakerOn ? t('muteSpeaker') : t('unmuteSpeaker')} off={!speakerOn} onClick={() => setSpeakerOn(!speakerOn)} />
            <span className="w-px h-8 bg-white/15 mx-1" aria-hidden />
            <RoundButton icon="notepad" label={notesOpen ? t('hideNotes') : t('showNotes')} active={notesOpen} onClick={onToggleNotes} />
            <RoundButton icon="aiAssist" label={call.aiOn ? t('aiTurnOff') : t('aiTurnOn')} active={call.aiOn}
              disabled={calling || !call.speechAvailable} onClick={call.toggleAi} />
            <RoundButton icon="clinicalNotes" label={t('patientAndNote')} active={panel !== null && panel !== 'notes'} onClick={() => setPanel(panel && panel !== 'notes' ? null : 'patient')} />
            <span className="w-px h-8 bg-white/15 mx-1" aria-hidden />
            <RoundButton icon="callEnd" label={calling ? t('cancelCall') : t('endCall')} danger onClick={call.endCall} />
          </div>
        </div>

        {(call.aiOn || aiBusy || call.aiDetail) && (
          <div className="absolute bottom-24 left-4 max-w-xs bg-glass-night text-white text-xs rounded-control px-3 py-2 border border-white/10">
            <p className="font-semibold flex items-center gap-1.5"><Icon name="aiAssist" size={14} /> {t('aiMinutes')}</p>
            <p className="text-ice mt-0.5">{t(AI_STATE_KEY[call.aiState])}</p>
            {call.aiDetail && <p className="text-warning mt-0.5">{call.aiDetail}</p>}
          </div>
        )}
      </div>

      {panel && (
        <aside className={cx('absolute inset-y-0 right-0 z-10 bg-card rounded-panel border border-hairline shadow-lg flex flex-col lg:static shrink-0',
          panel === 'notes' ? 'w-full lg:w-1/2 lg:min-w-[520px]' : 'w-[min(380px,100%)] lg:w-[380px]')}>
          <div className="flex items-center justify-between pr-2">
            <div className="flex-1">
              <Tabs label={t('patientAndNote')} value={panel} onChange={(p) => { setPanel(p); if (p !== 'notes' && notesOpen) onToggleNotes(); if (p === 'notes' && !notesOpen) onToggleNotes(); }}
                tabs={[{ id: 'notes', label: t('tabNotes') }, { id: 'patient', label: t('tabPatient') }, { id: 'note', label: t('tabVisitNote') }, { id: 'chat', label: t('tabChat') }]} />
            </div>
            <button type="button" onClick={() => { setPanel(null); if (notesOpen) onToggleNotes(); }} aria-label={t('close')}
              className="w-9 h-9 rounded-tight flex items-center justify-center text-ink-muted hover:bg-ink-tint cursor-pointer">
              <Icon name="close" size={18} />
            </button>
          </div>
          {panel === 'notes' ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              <AlertStack inline />
              <AssistStrip />
              {notepad}
            </div>
          ) : panel === 'chat' ? (
            <div className="flex-1 min-h-0 flex flex-col"><Conversation patientId={patient.patient_id} showHeader={false} compact /></div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              {panel === 'patient' ? <PatientSidePanel patient={patient} /> : <VisitNoteForm patient={patient} compact />}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function PatientSidePanel({ patient }: { patient: PatientSummary }) {
  const { t, requestRecords } = usePortal();
  const d = patient.demographics || {};
  return (
    <div className="flex flex-col gap-4">
      <Facts columns={2} items={[
        { label: t('age'), value: d.age ? t('yearsOld', { n: d.age }) : '' },
        { label: t('gender'), value: d.gender },
        { label: t('district'), value: d.district },
        { label: t('language'), value: patient.preferred_language?.toUpperCase() },
      ]} />
      <Facts columns={2} items={[
        { label: t('reasonForVisit'), value: patient.complaint },
        { label: t('vitals'), value: patient.vitals },
      ]} />
      {Object.values(patient.latest_readings ?? {}).map((r) => <ReadingLine key={r.reading_id} reading={r} compact />)}
      <div>
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">{t('allergies')}</p>
        <div className="flex flex-wrap gap-1.5">
          {(patient.allergies ?? []).length ? patient.allergies!.map((a) => <Pill key={a} tone="danger" icon="drugAlert" label={a} />) : <span className="text-sm text-ink-muted">{t('noneRecorded')}</span>}
        </div>
      </div>
      <div>
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">{t('currentMedicines')}</p>
        {(patient.active_rx ?? []).length ? (
          <ul className="text-sm text-ink list-disc pl-5 space-y-0.5">{patient.active_rx!.map((m) => <li key={m}>{m}</li>)}</ul>
        ) : <span className="text-sm text-ink-muted">{t('noneRecorded')}</span>}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" icon="lock" onClick={() => requestRecords(patient)}>{t('requestRecords')}</Button>
        <a href={hrefFor({ page: 'patient', patientId: patient.patient_id })} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control text-xs font-semibold text-primary hover:bg-primary-tint">
          <Icon name="external" size={14} /> {t('openFullProfile')}
        </a>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ After the call

function AfterCall({ appointment, patient, onOpenNotes }: { appointment: Appointment; patient: PatientSummary; onOpenNotes: () => void }) {
  const { t, call } = usePortal();
  const [signed, setSigned] = useState(false);
  const reason = call.endReason;
  const title = reason === 'declined' ? t('callDeclined') : reason === 'no_answer' ? t('callNoAnswer')
    : reason === 'unavailable' ? t('callUnavailable') : t('callEnded');

  return (
    <>
      <PageHeader back={{ label: t('backHome'), href: '#/home' }} title={title} subtitle={shortName(patient.full_name)} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="p-5 flex flex-col gap-4 h-fit">
          <div className="flex items-center gap-3">
            <Avatar name={patient.full_name} src={patient.avatar_url} size={48} />
            <div>
              <p className="text-subhead font-semibold">{shortName(patient.full_name)}</p>
              <p className="text-xs text-ink-muted">{appointment.agenda || patient.complaint}</p>
            </div>
          </div>
          {call.notice && <p className="text-xs text-ink-muted">{call.notice}</p>}
          {call.aiState === 'finishing' && (
            <p className="flex items-center gap-2 text-xs text-primary"><Icon name="aiAssist" size={16} /> {t('aiFinishing')}</p>
          )}
          {!signed && (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon="video" disabled={call.connection !== 'open'} onClick={() => void call.startCall(true)}>
                {reason === 'ended' ? t('rejoinCall') : t('callAgain')}
              </Button>
              <Button icon="call" disabled={call.connection !== 'open'} onClick={() => void call.startCall(false)}>{t('joinAudioOnly')}</Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
            <Button icon="notepad" onClick={onOpenNotes}>{t('openNotes')}</Button>
            <Button variant="ghost" onClick={() => navigate({ page: 'home' })}>{t('backHome')}</Button>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-subhead font-semibold mb-1">{t('finishVisit')}</h3>
          <p className="text-xs text-ink-muted mb-4">{t('finishVisitHint')}</p>
          <VisitNoteForm patient={patient} onSigned={() => setSigned(true)} />
          {signed && patient.encounter_id && (
            <div className="flex justify-center mt-2">
              <Button variant="primary" onClick={() => navigate({ page: 'visit', patientId: patient.patient_id, encounterId: patient.encounter_id! })}>
                {t('viewVisitSummary')}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
