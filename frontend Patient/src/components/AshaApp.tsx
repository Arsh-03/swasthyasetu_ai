import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, tints } from '../theme/tokens';
import { patientApi, type AshaPatient, type AshaReadingItem, type AshaTask, type AshaVisit, type PatientUser, type ReadingKind } from '../services/api';
import { assess, newClientId, outbox, type Level } from '../services/asha';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../utils/translations';
import { formatTimestamp } from '../utils/dates';
import { haptic } from '../utils/haptics';
import { AppText, Badge, Card, Icon, PrimaryButton, SecondaryButton, SegmentedControl, TextField } from './ui';
import { Speakable } from '../speech';

/**
 * ASHA worker app (same app, health-worker sign-in): doctors' requests for home-visit readings,
 * the patient's one-time consent, the readings form, and an immediate result (urgent = call 108 / refer).
 * Visits are kept on the phone and sent when there is network.
 */

const KIND_LABEL: Record<ReadingKind, TranslationKey> = {
  heart_rate: 'heartRate', blood_pressure: 'ashaBp', blood_sugar: 'ashaSugar', temperature: 'ashaTemp', weight: 'ashaWeight',
};

type Screen = { name: 'home' } | { name: 'visit'; patientId: string; taskId?: string | null };

export const AshaApp: React.FC<{ user: PatientUser & { worker_code?: string; area?: string }; onLogout: () => void }> = ({ user, onLogout }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [waiting, setWaiting] = useState(0);
  const [syncError, setSyncError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const sync = useCallback(async () => {
    const r = await outbox.flush();
    setWaiting(r.waiting);
    setSyncError(r.error);
    if (r.sent) setRefreshKey((k) => k + 1);
  }, []);
  useEffect(() => {
    void sync();
    const id = setInterval(() => void sync(), 20000);
    return () => clearInterval(id);
  }, [sync]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Icon name="people" size={26} color={colors.primary} />
        <View style={styles.flex}>
          <AppText variant="headline" numberOfLines={1}>{user.full_name}</AppText>
          <AppText variant="caption" color="inkMuted" numberOfLines={1}>{t('ashaRole')} · {user.worker_code} · {user.area}</AppText>
        </View>
        <Speakable atomic onPress={onLogout} accessibilityRole="button" accessibilityLabel={t('signOut')} hitSlop={8}>
          <Icon name="signOut" size={22} color={colors.dangerDeep} />
        </Speakable>
      </View>
      {(waiting > 0 || syncError) && (
        <Speakable atomic onPress={() => void sync()} style={styles.syncBar} accessibilityRole="button">
          <Icon name="network" size={16} color={colors.warningDeep} />
          <AppText variant="footnote" color="warningDeep" style={styles.flex}>{t('ashaWaitingToSend', { n: waiting })}</AppText>
          <AppText variant="footnote" weight={700} color="primary">{t('ashaRetry')}</AppText>
        </Speakable>
      )}
      {screen.name === 'home' ? (
        <AshaHome refreshKey={refreshKey} onOpen={(patientId, taskId) => setScreen({ name: 'visit', patientId, taskId })} />
      ) : (
        <AshaVisitScreen
          patientId={screen.patientId}
          taskId={screen.taskId}
          onBack={() => { setScreen({ name: 'home' }); setRefreshKey((k) => k + 1); }}
          onSaved={() => void sync()}
        />
      )}
    </View>
  );
};

// ------------------------------------------------------------------------------------------ Home: requests + search
const AshaHome: React.FC<{ refreshKey: number; onOpen: (patientId: string, taskId?: string | null) => void }> = ({ refreshKey, onOpen }) => {
  const { lang, t } = useLanguage();
  const [tasks, setTasks] = useState<AshaTask[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<AshaPatient[]>([]);

  useEffect(() => {
    patientApi.ashaTasks().then((r) => { setTasks(r); setOffline(false); }).catch(() => { setTasks((cur) => cur ?? []); setOffline(true); });
  }, [refreshKey]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) { setFound([]); return; }
    const id = setTimeout(() => patientApi.ashaFindPatients(term).then(setFound).catch(() => setFound([])), 300);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppText variant="largeTitle" accessibilityRole="header">{t('ashaTasksTitle')}</AppText>
      {offline && <AppText variant="footnote" color="warningDeep">{t('ashaOffline')}</AppText>}
      {!tasks && <ActivityIndicator color={colors.primary} />}
      {tasks && tasks.length === 0 && <Card><AppText variant="body" color="inkMuted">{t('ashaNoTasks')}</AppText></Card>}
      {tasks?.map((task) => (
        <Speakable key={task.task_id} onPress={() => onOpen(task.patient_id, task.task_id)} accessibilityRole="button">
          <Card style={styles.taskCard}>
            <View style={styles.row}>
              <AppText variant="headline" style={styles.flex} numberOfLines={1}>{task.patient?.full_name}</AppText>
              <Icon name="chevronRight" size={20} color={colors.inkMuted} />
            </View>
            <AppText variant="footnote" color="inkMuted">
              {[task.patient?.age && `${task.patient.age} ${t('ashaYears')}`, task.patient?.gender, task.patient?.district].filter(Boolean).join(' · ')}
            </AppText>
            <View style={styles.chips}>
              {task.kinds.map((k) => <Badge key={k} label={t(KIND_LABEL[k])} tone="primary" size="sm" />)}
              {task.consent ? <Badge label={t('ashaConsentOk')} tone="success" icon="check" size="sm" /> : <Badge label={t('ashaConsentNeeded')} tone="warning" size="sm" />}
            </View>
            {task.note ? <AppText variant="subhead">“{task.note}”</AppText> : null}
            <AppText variant="caption" color="inkMuted">
              {task.doctor_name} · {t('ashaDue')} {task.due_at ? formatTimestamp(task.due_at, lang) : '—'}
            </AppText>
          </Card>
        </Speakable>
      ))}

      <AppText variant="title" style={styles.top}>{t('ashaOtherPatient')}</AppText>
      <TextField label={t('ashaSearch')} icon="person" value={q} onChangeText={setQ} hint={t('ashaSearchHint')} autoCorrect={false} />
      {found.map((p) => (
        <Speakable key={p.patient_id} onPress={() => onOpen(p.patient_id, null)} accessibilityRole="button" style={styles.foundRow}>
          <Icon name="person" size={22} color={colors.primary} />
          <View style={styles.flex}>
            <AppText variant="body" weight={600}>{p.full_name}</AppText>
            <AppText variant="caption" color="inkMuted">{[p.age && `${p.age} ${t('ashaYears')}`, p.district].filter(Boolean).join(' · ')}</AppText>
          </View>
          <Icon name="chevronRight" size={18} color={colors.inkMuted} />
        </Speakable>
      ))}
    </ScrollView>
  );
};

// ------------------------------------------------------------------------------------------ One visit
const AshaVisitScreen: React.FC<{ patientId: string; taskId?: string | null; onBack: () => void; onSaved: () => void }> = ({
  patientId, taskId, onBack, onSaved,
}) => {
  const { lang, t } = useLanguage();
  const [visit, setVisit] = useState<AshaVisit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'consent' | 'form' | 'result'>('form');
  const [result, setResult] = useState<{ items: AshaReadingItem[]; levels: { kind: ReadingKind; level: Level; reason: string }[] } | null>(null);

  useEffect(() => {
    patientApi.ashaVisit(patientId)
      .then((v) => { setVisit(v); setStep(v.consent.granted ? 'form' : 'consent'); })
      .catch(() => setError(t('ashaOffline')));
  }, [patientId, t]);

  const task = visit?.tasks.find((x) => x.task_id === taskId) ?? visit?.tasks[0] ?? null;

  const giveConsent = async (method: 'tap' | 'thumb' | 'verbal') => {
    try {
      await patientApi.ashaConsent(patientId, method);
      haptic.success();
      setStep('form');
    } catch {
      setError(t('ashaOffline'));
    }
  };

  const submit = async (items: AshaReadingItem[]) => {
    const entry = {
      client_id: newClientId(), patient_id: patientId, patient_name: visit?.patient.full_name ?? '',
      task_id: task?.task_id ?? null, items, measured_at: new Date().toISOString(),
    };
    await outbox.add(entry);             // kept on the phone first; sent now or later
    onSaved();
    const levels = items.map((i) => ({ kind: i.kind, ...assess(i.kind, i.value, i.value2, String(i.details?.timing ?? '')) }));
    if (levels.some((l) => l.level === 'urgent')) haptic.warning(); else haptic.success();
    setResult({ items, levels });
    setStep('result');
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Speakable atomic onPress={onBack} accessibilityRole="button" style={styles.back} hitSlop={8}>
        <Icon name="chevronLeft" size={24} color={colors.primary} />
        <AppText variant="body" color="primary">{t('ashaTasksTitle')}</AppText>
      </Speakable>
      {!visit && !error && <ActivityIndicator color={colors.primary} />}
      {error && <AppText variant="subhead" color="dangerDeep">{error}</AppText>}
      {visit && (
        <>
          <View>
            <AppText variant="largeTitle">{visit.patient.full_name}</AppText>
            <AppText variant="footnote" color="inkMuted">
              {[visit.patient.age && `${visit.patient.age} ${t('ashaYears')}`, visit.patient.gender, visit.patient.district, ...visit.patient.conditions].filter(Boolean).join(' · ')}
            </AppText>
          </View>
          {task && (
            <Card style={styles.small}>
              <AppText variant="subhead" weight={700}>{t('ashaDoctorAsked', { name: task.doctor_name ?? '' })}</AppText>
              <AppText variant="body">{task.kinds.map((k) => t(KIND_LABEL[k])).join(', ')}{task.note ? ` · “${task.note}”` : ''}</AppText>
            </Card>
          )}

          {step === 'consent' && <ConsentStep name={visit.patient.full_name} onConsent={giveConsent} />}
          {step === 'form' && <ReadingsForm requested={task?.kinds ?? ['blood_pressure']} onSubmit={submit} />}
          {step === 'result' && result && (
            <ResultStep result={result} onDone={onBack} onAnother={() => { setResult(null); setStep('form'); }} />
          )}

          {visit.my_readings.length > 0 && step !== 'result' && (
            <Card style={styles.small}>
              <AppText variant="headline">{t('ashaEarlier')}</AppText>
              {visit.my_readings.slice(0, 5).map((r) => (
                <View key={r.reading_id} style={styles.row}>
                  <AppText variant="body" weight={600} style={styles.flex}>{t(KIND_LABEL[r.kind as ReadingKind] ?? 'ashaBp')} {r.display} {r.unit}</AppText>
                  <AppText variant="caption" color="inkMuted">{formatTimestamp(r.created_at, lang)}</AppText>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
};

/** The patient agrees once (valid 90 days): tap, thumb impression, or verbal agreement noted by the ASHA worker. */
const ConsentStep: React.FC<{ name: string; onConsent: (m: 'tap' | 'thumb' | 'verbal') => void }> = ({ name, onConsent }) => {
  const { t } = useLanguage();
  return (
    <Card style={styles.consent}>
      <Icon name="shieldCheck" size={32} color={colors.primary} />
      <AppText variant="title">{t('ashaConsentTitle')}</AppText>
      <AppText variant="body">{t('ashaConsentBody', { name })}</AppText>
      <AppText variant="footnote" color="inkMuted">{t('ashaConsentHint')}</AppText>
      <PrimaryButton label={t('ashaConsentAgree')} icon="check" onPress={() => onConsent('tap')} />
      <SecondaryButton label={t('ashaConsentThumb')} onPress={() => onConsent('thumb')} />
      <SecondaryButton label={t('ashaConsentVerbal')} onPress={() => onConsent('verbal')} />
    </Card>
  );
};

const num = (s: string) => { const v = parseFloat(s.replace(',', '.')); return Number.isFinite(v) ? v : null; };

const ReadingsForm: React.FC<{ requested: ReadingKind[]; onSubmit: (items: AshaReadingItem[]) => void }> = ({ requested, onSubmit }) => {
  const { t } = useLanguage();
  const [sys1, setSys1] = useState(''); const [dia1, setDia1] = useState('');
  const [sys2, setSys2] = useState(''); const [dia2, setDia2] = useState('');
  const [pulse, setPulse] = useState('');
  const [sugar, setSugar] = useState(''); const [timing, setTiming] = useState<'fasting' | 'random' | 'after_food'>('random');
  const [temp, setTemp] = useState(''); const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const show = (k: ReadingKind) => requested.includes(k) || k === 'blood_pressure';
  const [more, setMore] = useState(false);

  const save = () => {
    const items: AshaReadingItem[] = [];
    const a = [num(sys1), num(dia1)]; const b = [num(sys2), num(dia2)];
    if (a[0] !== null || a[1] !== null) {
      if (a[0] === null || a[1] === null || a[0] <= a[1]) { setError(t('ashaBpCheck')); return; }
      // Two readings a minute apart are averaged, as the NCD guidelines advise.
      const both = b[0] !== null && b[1] !== null && b[0] > b[1];
      const sysAvg = both ? Math.round((a[0] + b[0]!) / 2) : a[0];
      const diaAvg = both ? Math.round((a[1] + b[1]!) / 2) : a[1];
      items.push({ kind: 'blood_pressure', value: sysAvg, value2: diaAvg,
        details: { readings_averaged: both ? 2 : 1, ...(num(pulse) ? { pulse: num(pulse) } : {}) } });
    }
    if (num(sugar) !== null) items.push({ kind: 'blood_sugar', value: num(sugar)!, details: { timing } });
    if (num(temp) !== null) items.push({ kind: 'temperature', value: num(temp)! });
    if (num(weight) !== null) items.push({ kind: 'weight', value: num(weight)! });
    if (items.length === 0) { setError(t('ashaNothing')); return; }
    setError(null);
    onSubmit(items);
  };

  return (
    <Card style={styles.form}>
      <AppText variant="title">{t('ashaReadings')}</AppText>
      {show('blood_pressure') && (
        <>
          <AppText variant="subhead" weight={700}>{t('ashaBp')} (mmHg)</AppText>
          <AppText variant="footnote" color="inkMuted">{t('ashaBpHowTo')}</AppText>
          <View style={styles.pair}>
            <View style={styles.flex}><TextField label={t('ashaTop')} icon="heartbeat" keyboardType="numeric" value={sys1} onChangeText={setSys1} maxLength={3} /></View>
            <View style={styles.flex}><TextField label={t('ashaBottom')} icon="heartbeat" keyboardType="numeric" value={dia1} onChangeText={setDia1} maxLength={3} /></View>
          </View>
          <AppText variant="footnote" color="inkMuted">{t('ashaSecondReading')}</AppText>
          <View style={styles.pair}>
            <View style={styles.flex}><TextField label={t('ashaTop')} icon="heartbeat" keyboardType="numeric" value={sys2} onChangeText={setSys2} maxLength={3} /></View>
            <View style={styles.flex}><TextField label={t('ashaBottom')} icon="heartbeat" keyboardType="numeric" value={dia2} onChangeText={setDia2} maxLength={3} /></View>
          </View>
          <TextField label={t('ashaPulse')} icon="heartbeat" keyboardType="numeric" value={pulse} onChangeText={setPulse} maxLength={3} />
        </>
      )}
      {(show('blood_sugar') || more) && (
        <>
          <AppText variant="subhead" weight={700}>{t('ashaSugar')} (mg/dL)</AppText>
          <SegmentedControl
            value={timing}
            onChange={setTiming}
            options={[{ value: 'fasting', label: t('ashaFasting') }, { value: 'random', label: t('ashaRandom') }, { value: 'after_food', label: t('ashaAfterFood') }]}
          />
          <TextField label={t('ashaSugar')} icon="lab" keyboardType="numeric" value={sugar} onChangeText={setSugar} maxLength={3} />
        </>
      )}
      {(show('temperature') || more) && (
        <TextField label={`${t('ashaTemp')} (°F)`} icon="fever" keyboardType="decimal-pad" value={temp} onChangeText={setTemp} maxLength={5} />
      )}
      {(show('weight') || more) && (
        <TextField label={`${t('ashaWeight')} (kg)`} icon="person" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} maxLength={5} />
      )}
      {!more && <SecondaryButton label={t('ashaMore')} size="sm" onPress={() => setMore(true)} />}
      {error && <AppText variant="subhead" color="dangerDeep">{error}</AppText>}
      <PrimaryButton label={t('ashaSave')} icon="check" onPress={save} />
    </Card>
  );
};

const LEVEL_TONE: Record<Level, 'success' | 'warning' | 'danger'> = { normal: 'success', high: 'warning', low: 'warning', urgent: 'danger' };

const ResultStep: React.FC<{
  result: { items: AshaReadingItem[]; levels: { kind: ReadingKind; level: Level; reason: string }[] };
  onDone: () => void; onAnother: () => void;
}> = ({ result, onDone, onAnother }) => {
  const { t } = useLanguage();
  const urgent = result.levels.some((l) => l.level === 'urgent');
  return (
    <>
      {urgent && (
        <View style={styles.urgent}>
          <Icon name="emergency" size={32} color={colors.dangerDeep} />
          <AppText variant="title" color="dangerDeep">{t('ashaUrgentTitle')}</AppText>
          <AppText variant="body">{t('ashaUrgentBody')}</AppText>
          <PrimaryButton label={t('dial108')} icon="call" onPress={() => Linking.openURL('tel:108').catch(() => undefined)} />
        </View>
      )}
      <Card style={styles.small}>
        <AppText variant="headline">{t('ashaSavedTitle')}</AppText>
        {result.items.map((i, n) => {
          const lv = result.levels[n];
          return (
            <View key={i.kind} style={styles.row}>
              <AppText variant="body" weight={600} style={styles.flex}>
                {t(KIND_LABEL[i.kind])}: {i.kind === 'blood_pressure' ? `${i.value}/${i.value2}` : i.value}
              </AppText>
              <Badge label={lv.level === 'normal' ? t('ashaNormal') : t(`ashaLvl_${lv.reason}` as TranslationKey)} tone={LEVEL_TONE[lv.level]} size="sm" />
            </View>
          );
        })}
        <AppText variant="footnote" color="inkMuted">{t('ashaSentNote')}</AppText>
      </Card>
      <PrimaryButton label={t('ashaDone')} onPress={onDone} />
      <SecondaryButton label={t('ashaMeasureAgain')} onPress={onAnother} />
    </>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  flex: { flex: 1 },
  top: { marginTop: spacing.md },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator, backgroundColor: colors.card },
  syncBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: tints.warning },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  taskCard: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  foundRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.card },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  small: { gap: spacing.sm },
  consent: { gap: spacing.md },
  form: { gap: spacing.md },
  pair: { flexDirection: 'row', gap: spacing.sm },
  urgent: { gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: tints.danger, borderWidth: 2, borderColor: colors.danger },
});
