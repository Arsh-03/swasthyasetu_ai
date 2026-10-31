import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import type { ConsentRequestData } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { GlassSheet } from './glass';
import {
  AppText,
  AudioListenButton,
  Badge,
  CriticalButton,
  Groove,
  IconDisc,
  Well,
} from './ui';
import { cleanForSpeech, spokenDoctor, useScripts } from '../speech';

interface ConsentGateModalProps {
  visible: boolean;
  request: ConsentRequestData | null;
  onApprove: () => Promise<void>;
  onDecline: () => void;
}

const formatCountdown = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Patient side of the Doctor's ConsentRequestModal: concise, centered pop-up dialog. */
export const ConsentGateModal: React.FC<ConsentGateModalProps> = ({ visible, request, onApprove, onDecline }) => {
  const { t, lang } = useLanguage();
  const scripts = useScripts();
  const minutes = request?.duration_minutes || 60;
  const [timeLeft, setTimeLeft] = useState(minutes * 60);
  const [submitting, setSubmitting] = useState(false);

  // App.tsx keys this component by consent_id, so each request starts a fresh countdown
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onApprove();
    } finally {
      setSubmitting(false);
    }
  };

  const practitioner = request?.practitioner_name || request?.practitioner_reg || t('yourDoctor');
  const record = request?.record_title || t('healthRecord');
  const rawPurpose = request?.clinical_purpose || '—';
  const cleanPurpose = rawPurpose.replace(/^Clinical evaluation of:\s*/i, '');

  // Plain-language summary: who asks, for what, why, and for how long
  const summary = () =>
    scripts.consent.summary({
      doctor: spokenDoctor(practitioner, lang) || t('yourDoctor'),
      record: cleanForSpeech(record, lang),
      purpose: cleanForSpeech(cleanPurpose, lang),
      minutes,
    });

  const rows: { label: string; value: string }[] = [
    { label: t('practitioner'), value: practitioner },
    { label: t('recordSought'), value: record },
    { label: t('explicitPurpose'), value: cleanPurpose },
  ];

  // Non-dismissible: the patient must explicitly authorize or decline
  return (
    <GlassSheet visible={visible} placement="center">
      {/* Clean single-line aligned header */}
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <IconDisc icon="key" size={38} shape="square" />
          <AppText variant="headline" weight={700} compact numberOfLines={1} style={styles.headerTitle}>
            {t('consentTitle')}
          </AppText>
        </View>
        <View accessible accessibilityLabel={`${t('timeRemaining')} ${formatCountdown(timeLeft)}`}>
          <Badge
            label={formatCountdown(timeLeft)}
            tone="warning"
            icon="timer"
            size="md"
            speech={() => scripts.consent.timer(Math.floor(timeLeft / 60), timeLeft % 60)}
          />
        </View>
      </View>
      <Groove />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Balanced meta row: paired duration badge + audio listen pill */}
        <View style={styles.topRow}>
          <Badge
            label={t('tokenValidityValue', { minutes })}
            tone="success"
            icon="clock"
            size="md"
          />
          <AudioListenButton text={summary} />
        </View>

        {/* Structured request details with distinct italicized labels and bold content */}
        <Well style={styles.details}>
          {rows.map((row, index) => (
            <React.Fragment key={row.label}>
              {index > 0 && <View style={styles.rowDivider} />}
              <View style={styles.detailRow}>
                <AppText
                  variant="caption"
                  weight={500}
                  color="inkMuted"
                  compact
                  style={styles.fieldLabel}
                >
                  {row.label}
                </AppText>
                <AppText
                  variant="subhead"
                  weight={700}
                  color="ink"
                  style={styles.fieldValue}
                >
                  {row.value}
                </AppText>
              </View>
            </React.Fragment>
          ))}
        </Well>

        {/* Action buttons with no overflowing words */}
        <View style={styles.actions}>
          <CriticalButton
            tone="danger"
            label={t('decline')}
            icon="close"
            onPress={onDecline}
            speech={scripts.consent.decline}
            disabled={submitting}
            fullWidth={false}
            style={styles.decline}
          />
          <CriticalButton
            tone="success"
            label={t('authorizeAccess')}
            icon="shieldCheck"
            onPress={handleConfirm}
            speech={scripts.consent.approve(minutes)}
            loading={submitting}
            fullWidth={false}
            style={styles.approve}
          />
        </View>
      </ScrollView>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    gap: 10,
  },
  headerTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerTitle: {
    flexShrink: 1,
    letterSpacing: -0.2,
  },
  scroll: {
    flexShrink: 1,
  },
  body: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  details: {
    padding: spacing.md,
    gap: 0,
  },
  detailRow: {
    gap: 3,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontStyle: 'italic',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.xs,
  },
  decline: {
    flex: 1,
  },
  approve: {
    flex: 1.25,
  },
});
