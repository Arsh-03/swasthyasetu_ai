import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { colors, radii, spacing, tints, touch } from '../theme/tokens';
import { patientApi, type ChatMessage, type ChatThread, type ChatThreadSummary } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { formatClock, formatDate, formatTimestamp, localCalendarDate } from '../utils/dates';
import { haptic } from '../utils/haptics';
import { AppText, Card, Icon, NavBar, SecondaryButton, useChromeInsets } from './ui';

interface ChatViewProps {
  onBack: () => void;
  /** Bumped on every live chat event; the open conversation reloads. */
  chatEvent: number;
  /** The patient wrote emergency words: show the emergency sheet. */
  onEmergency: () => void;
  /** Chat is closed: start a new consultation request instead. */
  onRequestVisit: () => void;
  onUnreadChanged: () => void;
  /** Open this doctor's conversation directly (from My Doctors); back then returns there. */
  initialDoctorId?: string | null;
  backLabel?: string;
}

/**
 * Chat with the doctor. Open from booking until a few days after a visit (the doctor's setting).
 * Always shows "Emergency? Call 108": chat is never the emergency channel.
 */
export const ChatView: React.FC<ChatViewProps> = ({ onBack, chatEvent, onEmergency, onRequestVisit, onUnreadChanged, initialDoctorId, backLabel }) => {
  const { lang, t } = useLanguage();
  const insets = useChromeInsets();
  const [threads, setThreads] = useState<ChatThreadSummary[] | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(initialDoctorId ?? null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [original, setOriginal] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Which doctors the patient can chat with (usually one: open it straight away).
  useEffect(() => {
    patientApi
      .getChatThreads()
      .then((list) => {
        setThreads(list);
        setDoctorId((cur) => cur ?? (list.length === 1 ? list[0].other_id : null));
      })
      .catch(() => setError(t('chatLoadError')));
  }, [chatEvent, t]);

  useEffect(() => {
    if (!doctorId) return;
    let cancelled = false;
    patientApi
      .getChatThread(doctorId)
      .then((th) => {
        if (cancelled) return;
        setThread(th);
        setError(null);
        if (th.messages.some((m) => m.sender === 'doctor' && !m.read)) {
          patientApi.markChatRead(doctorId).catch(() => undefined);
          onUnreadChanged();
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('chatLoadError'));
      });
    return () => {
      cancelled = true;
    };
  }, [doctorId, chatEvent, onUnreadChanged, t]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !doctorId || sending) return;
    setSending(true);
    haptic.selection();
    try {
      const msg = await patientApi.sendChatMessage(doctorId, body, lang);
      setDraft('');
      setThread((th) => (th ? { ...th, messages: [...th.messages, msg] } : th));
      if (msg.emergency) onEmergency();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('chatSendError'));
    } finally {
      setSending(false);
    }
  };

  const emergencyStrip = (
    <Pressable
      onPress={() => Linking.openURL('tel:108').catch(() => undefined)}
      accessibilityRole="button"
      accessibilityLabel={t('chatEmergencyStrip')}
      style={({ pressed }) => [styles.emergency, pressed && { opacity: 0.8 }]}
    >
      <Icon name="emergency" size={18} color={colors.dangerDeep} />
      <AppText variant="footnote" color="dangerDeep" weight={600} style={styles.flex}>
        {t('chatEmergencyStrip')}
      </AppText>
      <Icon name="call" size={18} color={colors.dangerDeep} />
    </Pressable>
  );

  // Several doctors: pick one.
  if (!doctorId) {
    return (
      <ScrollView contentContainerStyle={[styles.listContent, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
        <NavBar backLabel={backLabel ?? t('home')} onBack={onBack} />
        <AppText variant="largeTitle" accessibilityRole="header">{t('tabChat')}</AppText>
        {emergencyStrip}
        {!threads && !error && <ActivityIndicator color={colors.primary} />}
        {error && <AppText color="dangerDeep">{error}</AppText>}
        {threads && threads.length === 0 && (
          <Card>
            <AppText variant="body">{t('chatNoDoctors')}</AppText>
            <SecondaryButton label={t('chatRequestVisit')} icon="doctor" onPress={onRequestVisit} style={styles.top} />
          </Card>
        )}
        {threads?.map((th) => (
          <Pressable key={th.other_id} onPress={() => setDoctorId(th.other_id)} accessibilityRole="button" style={styles.threadRow}>
            <Icon name="doctor" size={24} color={colors.primary} />
            <View style={styles.flex}>
              <AppText variant="headline">{th.name}</AppText>
              <AppText variant="footnote" color="inkMuted" numberOfLines={1}>{th.last_message?.body ?? th.subtitle ?? ''}</AppText>
            </View>
            {th.unread > 0 && <View style={styles.dot} />}
            <Icon name="chevronRight" size={20} color={colors.inkMuted} />
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  const st = thread?.status;
  let lastDay = '';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <NavBar
          backLabel={initialDoctorId ? backLabel ?? t('home') : threads && threads.length > 1 ? t('tabChat') : backLabel ?? t('home')}
          onBack={() => (!initialDoctorId && threads && threads.length > 1 ? setDoctorId(null) : onBack())}
        />
        <View style={styles.doctorRow}>
          <Icon name="doctor" size={26} color={colors.primary} />
          <View style={styles.flex}>
            <AppText variant="headline" numberOfLines={1}>{thread?.doctor.name ?? ''}</AppText>
            {st && (
              <AppText variant="footnote" color={st.open ? 'inkMuted' : 'warningDeep'}>
                {!st.open
                  ? t('chatClosed')
                  : !st.doctor_available_now && st.doctor_next_available
                  ? t('chatDoctorAway', { time: formatTimestamp(st.doctor_next_available, lang) })
                  : st.open_until
                  ? t('chatOpenUntil', { date: formatTimestamp(st.open_until, lang) })
                  : t('chatOpenNow')}
              </AppText>
            )}
          </View>
        </View>
        {emergencyStrip}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {!thread && !error && <ActivityIndicator color={colors.primary} />}
        {thread && thread.messages.length === 0 && (
          <AppText variant="subhead" color="inkMuted" align="center" style={styles.top}>{t('chatEmpty')}</AppText>
        )}
        {thread?.messages.map((m) => {
          const d = new Date(m.created_at);
          const day = formatDate(localCalendarDate(d), lang, { year: false });
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <View key={m.message_id}>
              {sep && <AppText variant="caption" color="inkMuted" align="center" style={styles.day}>{day}</AppText>}
              <Bubble
                m={m}
                showOriginal={original.has(m.message_id)}
                onToggle={() => setOriginal((s) => { const n = new Set(s); if (n.has(m.message_id)) n.delete(m.message_id); else n.add(m.message_id); return n; })}
              />
            </View>
          );
        })}
      </ScrollView>

      {error && <AppText variant="footnote" color="dangerDeep" style={styles.errorText}>{error}</AppText>}

      <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
        {st && !st.open ? (
          <View style={styles.closedBox}>
            <AppText variant="footnote" color="inkMuted">{t('chatClosedHint', { days: st.window_days })}</AppText>
            <SecondaryButton label={t('chatRequestVisit')} icon="doctor" size="sm" onPress={onRequestVisit} />
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('chatPlaceholder')}
              placeholderTextColor={colors.inkInset}
              multiline
              maxLength={2000}
              style={styles.input}
              accessibilityLabel={t('chatPlaceholder')}
            />
            <Pressable
              onPress={() => void send()}
              disabled={!draft.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel={t('chatSend')}
              style={({ pressed }) => [styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}
            >
              {sending ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="send" size={22} color={colors.onPrimary} />}
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const Bubble: React.FC<{ m: ChatMessage; showOriginal: boolean; onToggle: () => void }> = ({ m, showOriginal, onToggle }) => {
  const { t } = useLanguage();
  const mine = m.sender === 'patient';
  // Doctor messages are shown in the patient's language when a translation exists.
  const text = !mine && m.translation && !showOriginal ? m.translation : m.body;
  return (
    <View style={[styles.bubbleWrap, mine ? styles.right : styles.left]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs, m.urgent && styles.urgent]}>
        <AppText variant="body" color={mine ? 'onPrimary' : 'ink'}>{text}</AppText>
      </View>
      <View style={styles.metaRow}>
        <AppText variant="caption" color="inkMuted">
          {formatClock(new Date(m.created_at))}
          {mine ? ` · ${m.read ? t('chatSeen') : t('chatSent')}` : ''}
        </AppText>
        {!mine && m.translation ? (
          <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="button">
            <AppText variant="caption" color="primary" weight={600}>{showOriginal ? t('chatShowTranslation') : t('chatShowOriginal')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { marginTop: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  header: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  doctorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emergency: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touch.compact,
    paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: tints.danger, borderWidth: 1, borderColor: tints.dangerRing,
  },
  threadRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: touch.min,
    borderRadius: radii.lg, backgroundColor: colors.card,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.dangerDeep },
  messages: { padding: spacing.lg, gap: spacing.sm },
  day: { marginVertical: spacing.sm },
  bubbleWrap: { maxWidth: '85%', gap: 2 },
  left: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: radii.xs },
  theirs: { backgroundColor: colors.card, borderBottomLeftRadius: radii.xs, borderWidth: 1, borderColor: colors.hairline },
  urgent: { borderWidth: 2, borderColor: colors.danger },
  metaRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  errorText: { paddingHorizontal: spacing.lg },
  composer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, backgroundColor: colors.base },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1, minHeight: touch.min, maxHeight: 140, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderRadius: radii.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, color: colors.ink, fontSize: 17,
  },
  sendBtn: { width: touch.min, height: touch.min, borderRadius: touch.min / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  closedBox: { gap: spacing.sm },
});
