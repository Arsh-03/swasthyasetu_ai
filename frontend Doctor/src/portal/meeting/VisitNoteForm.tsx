// Visit note: the five fields the doctor signs to finish the consultation (the signed note becomes the
// visit summary and the patient's care plan). They fill themselves from the notepad (CareBridge note format),
// so the doctor reviews instead of typing everything again; every Rx line goes to the patient's medicine plan.
import { useCallback, useEffect, useState } from 'react';
import { api, type PatientSummary } from '../../services/api';
import { authFetch } from '../../services/backend';
import { Icon } from '../../components/ui/Icon';
import { usePortal } from '../PortalContext';
import { Button, Field, TextArea, TextInput } from '../ui';

type NoteField = 'complaint' | 'diagnosis' | 'medicine' | 'advice' | 'follow_up';

export function VisitNoteForm({ patient, onSigned, compact = false }: {
  patient: PatientSummary; onSigned?: () => void; compact?: boolean;
}) {
  const { t, doctor, toast, refresh } = usePortal();
  const [values, setValues] = useState<Record<NoteField, string>>({
    complaint: patient.complaint || '', diagnosis: '', medicine: '', advice: '', follow_up: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const set = (k: NoteField) => (v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const [fromNotes, setFromNotes] = useState<{ medicines: number } | null>(null);

  const fillFromNotes = useCallback(async (overwrite: boolean) => {
    if (!patient.encounter_id) return;
    try {
      const res = await authFetch(`/api/v1/doctor/encounters/${encodeURIComponent(patient.encounter_id)}/structured`);
      if (!res.ok) return;
      const d = await res.json() as { structured: { prescription: unknown[] }; prefill: { subjective: string; assessment: string; plan: Record<string, string> } };
      const from: Record<NoteField, string> = {
        complaint: d.prefill.subjective, diagnosis: d.prefill.assessment, medicine: d.prefill.plan.medicine ?? '',
        advice: d.prefill.plan.advice ?? '', follow_up: d.prefill.plan.follow_up ?? '',
      };
      setValues(prev => {
        const next = { ...prev };
        (Object.keys(from) as NoteField[]).forEach(k => { if (from[k] && (overwrite || !prev[k].trim())) next[k] = from[k]; });
        return next;
      });
      setFromNotes({ medicines: d.structured.prescription.length });
    } catch { /* the form still works by hand */ }
  }, [patient.encounter_id]);

  useEffect(() => { void fillFromNotes(false); }, [fillFromNotes]);
  const allergyWarning = (patient.allergies ?? []).length > 0;

  const sign = async () => {
    if (!patient.encounter_id) return;
    if (!values.diagnosis.trim()) { setError(t('diagnosisRequired')); return; }
    setBusy(true);
    setError(null);
    try {
      await api.signSoapNote(patient.encounter_id, {
        subjective: values.complaint.trim(),
        objective: patient.vitals || '',
        assessment: values.diagnosis.trim(),
        plan: { medicine: values.medicine.trim(), advice: values.advice.trim(), follow_up: values.follow_up.trim() },
        doctor_signature_name: doctor?.display_name || '',
        ddi_acknowledged: allergyWarning,
      });
      setSigned(true);
      toast(t('noteSigned'), 'success');
      refresh();
      onSigned?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveError'));
    } finally {
      setBusy(false);
    }
  };

  if (signed) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-6">
        <Icon name="verified" size={36} tone="success" weight="duotone" />
        <p className="text-sm font-semibold text-ink">{t('noteSigned')}</p>
        <p className="text-xs text-ink-muted">{t('noteSignedHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-control bg-ink-tint px-3 py-2 text-xs text-ink-muted">
        <Icon name="aiAssist" size={15} />
        <span className="flex-1">{fromNotes
          ? `Filled from your notes${fromNotes.medicines ? ` · ${fromNotes.medicines} medicine(s) will go to the patient's plan` : ''}. Check and sign.`
          : 'Write in the notepad; these fields fill from it.'}</span>
        <button type="button" className="font-semibold text-primary hover:underline cursor-pointer" onClick={() => void fillFromNotes(true)}>Fill from notes</button>
      </div>
      {allergyWarning && (
        <p className="flex items-start gap-2 rounded-control bg-danger-tint text-danger-deep px-3 py-2 text-xs">
          <Icon name="drugAlert" size={16} className="mt-0.5" />
          <span><strong>{t('allergies')}:</strong> {(patient.allergies ?? []).join(', ')}</span>
        </p>
      )}
      <Field label={t('fieldComplaint')}>{(id) => <TextInput id={id} value={values.complaint} onChange={(e) => set('complaint')(e.target.value)} />}</Field>
      <Field label={`${t('fieldDiagnosis')} *`}>{(id) => <TextInput id={id} value={values.diagnosis} onChange={(e) => set('diagnosis')(e.target.value)} placeholder={t('fieldDiagnosisHint')} />}</Field>
      <Field label={t('fieldMedicine')}>{(id) => <TextArea id={id} rows={compact ? 2 : 3} value={values.medicine} onChange={(e) => set('medicine')(e.target.value)} placeholder={t('fieldMedicineHint')} />}</Field>
      <Field label={t('fieldAdvice')}>{(id) => <TextArea id={id} rows={2} value={values.advice} onChange={(e) => set('advice')(e.target.value)} />}</Field>
      <Field label={t('fieldFollowUp')}>{(id) => <TextInput id={id} value={values.follow_up} onChange={(e) => set('follow_up')(e.target.value)} placeholder={t('fieldFollowUpHint')} />}</Field>
      {error && <p role="alert" className="text-xs text-danger-deep">{error}</p>}
      <Button variant="primary" icon="sign" onClick={sign} disabled={busy || !patient.encounter_id}>
        {busy ? t('signing') : t('signAndFinish')}
      </Button>
    </div>
  );
}
