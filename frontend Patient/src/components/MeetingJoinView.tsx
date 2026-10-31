import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { patientApi, type MeetingInfo } from '../services/api';
import type { ConsultationCallApi } from '../services/call/useConsultationCall';
import { useLanguage } from '../i18n/LanguageContext';
import { formatClock, formatTimestamp } from '../utils/dates';
import { AppText, Card, Icon, NavBar, PrimaryButton, ScreenScroll, SecondaryButton, TextField } from './ui';
import { useScripts } from '../speech';

/**
 * Join a consultation like a Google Meet: by its link or code. Joining opens 10 minutes before the start;
 * "Ask to join" puts the patient in the waiting room until the doctor admits them (then the call starts).
 */
export const MeetingJoinView: React.FC<{
  code: string | null;
  call: ConsultationCallApi;
  callRoomEncounterId: string | null;
  onRoom: (room: { encounter_id: string; doctor_name?: string }) => void;
  onBack: () => void;
  /** Outside the join window: the usual symptom intake + call request. */
  onRequestCall: () => void;
}> = ({ code: initialCode, call, callRoomEncounterId, onRoom, onBack, onRequestCall }) => {
  const { lang, t } = useLanguage();
  const scripts = useScripts();
  const [code, setCode] = useState(initialCode ?? '');
  const [typed, setTyped] = useState('');
  const [info, setInfo] = useState<MeetingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [asking, setAsking] = useState<{ video: boolean; encounterId: string } | null>(null);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (!code) return;
    setError(null);
    patientApi.getMeeting(code).then(setInfo).catch(() => { setInfo(null); setError(t('meetNotFound')); });
  }, [code, now, t]);

  // Once this meeting's call room is connected, knock.
  useEffect(() => {
    if (asking && callRoomEncounterId === asking.encounterId && call.roomEncounterId === asking.encounterId
        && call.connection === 'open' && call.knockState === 'idle' && call.callState === 'idle') {
      call.knock(asking.video);
    }
  }, [asking, callRoomEncounterId, call]);

  const askToJoin = async (video: boolean) => {
    if (!info) return;
    setError(null);
    try {
      const r = await patientApi.joinMeeting(info.meeting_code);
      onRoom({ encounter_id: r.encounter_id, doctor_name: r.doctor_name });
      setAsking({ video, encounterId: r.encounter_id });
    } catch {
      setError(t('meetCantJoin'));
    }
  };
  const cancel = () => { call.cancelKnock(); setAsking(null); };

  const minsToOpen = info?.opens_at ? Math.ceil((new Date(info.opens_at).getTime() - now) / 60000) : 0;
  const waiting = asking && call.knockState === 'waiting';

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <NavBar backLabel={t('home')} onBack={() => { if (asking) cancel(); onBack(); }} />
      <AppText variant="largeTitle" accessibilityRole="header">{t('meetTitle')}</AppText>

      {!code && (
        <Card style={styles.gap}>
          <TextField label={t('meetCodeLabel')} icon="video" value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false}
            hint={t('meetCodeHint')} />
          <PrimaryButton
            label={t('meetFind')}
            speech={scripts.meet.find}
            onPress={() => setCode(typed.trim().toLowerCase())}
            disabled={typed.trim().length < 6}
          />
        </Card>
      )}

      {code && !info && !error && <ActivityIndicator color={colors.primary} />}
      {error && <AppText variant="subhead" color="dangerDeep">{error}</AppText>}

      {info && (
        <Card style={styles.gap}>
          <View style={styles.row}>
            <Icon name="doctor" size={28} color={colors.primary} />
            <View style={styles.flex}>
              <AppText variant="headline">{info.doctor_name}</AppText>
              <AppText variant="footnote" color="inkMuted">
                {info.scheduled_at ? `${formatTimestamp(info.scheduled_at, lang)} · ${info.duration_minutes} ${t('meetMin')}` : ''}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color="inkMuted">{t('meetCode')}: {info.meeting_code}</AppText>

          {info.state === 'early' && (
            <AppText variant="subhead">
              {t('meetOpensAt', { time: info.opens_at ? formatClock(new Date(info.opens_at)) : '' })}
              {minsToOpen > 0 ? ` (${minsToOpen < 60 ? t('meetInMin', { n: minsToOpen }) : t('meetInHours', { n: Math.round(minsToOpen / 60) })})` : ''}
            </AppText>
          )}
          {info.state === 'closed' && <AppText variant="subhead" color="warningDeep">{t('meetClosed')}</AppText>}
          {info.state === 'cancelled' && <AppText variant="subhead" color="warningDeep">{t('meetCancelled')}</AppText>}
          {info.state === 'completed' && <AppText variant="subhead" color="inkMuted">{t('meetCompleted')}</AppText>}

          {info.state === 'open' && !asking && (
            <>
              <PrimaryButton
                label={t('meetAskToJoin')}
                icon="video"
                speech={scripts.meet.askToJoin(true, info.doctor_name)}
                onPress={() => void askToJoin(true)}
              />
              <SecondaryButton
                label={t('meetAskAudio')}
                icon="call"
                speech={scripts.meet.askToJoin(false, info.doctor_name)}
                onPress={() => void askToJoin(false)}
              />
            </>
          )}
          {asking && call.knockState !== 'denied' && (
            <View style={styles.waiting}>
              <ActivityIndicator color={colors.primary} />
              <AppText variant="subhead" weight={600} align="center">
                {waiting ? t('meetWaitingForDoctor', { name: info.doctor_name }) : t('meetConnecting')}
              </AppText>
              <SecondaryButton label={t('meetCancel')} speech={scripts.meet.cancelKnock} onPress={cancel} />
            </View>
          )}
          {call.knockState === 'denied' && <AppText variant="subhead" color="dangerDeep">{t('meetDenied')}</AppText>}
          {info.state !== 'open' && info.state !== 'completed' && (
            <SecondaryButton label={t('meetRequestNow')} icon="call" onPress={onRequestCall} />
          )}
        </Card>
      )}
    </ScreenScroll>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  gap: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  waiting: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
});
