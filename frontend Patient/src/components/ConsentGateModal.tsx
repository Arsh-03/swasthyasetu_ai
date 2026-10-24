import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import type { ConsentRequestData } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { GlassSheet } from './glass';
import {
  AppText,
  AudioListenButton,
  Badge,
  DestructiveButton,
  PrimaryButton,
  SheetHeader,
  TextField,
  Well,
} from './ui';

interface ConsentGateModalProps {
  visible: boolean;
  request: ConsentRequestData | null;
  onApprove: (otp: string) => Promise<void>;
  onDecline: () => void;
}

const formatCountdown = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Patient side of the Doctor's ConsentRequestModal: review the request, enter OTP, authorize or decline. */
export const ConsentGateModal: React.FC<ConsentGateModalProps> = ({ visible, request, onApprove, onDecline }) => {
  const { t } = useLanguage();
  const minutes = request?.duration_minutes || 60;
  const [otp, setOtp] = useState('123456');
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
      await onApprove(otp);
    } finally {
      setSubmitting(false);
    }
  };

  const practitioner = `${request?.practitioner_name || t('yourDoctor')}${
    request?.practitioner_reg ? ` (${request.practitioner_reg})` : ''
  }`;
  const record = request?.record_title || t('healthRecord');
  const purpose = request?.clinical_purpose || '—';
  const notice = t('consentNotice', { minutes });

  const rows: { label: string; value: string; tone?: 'green' }[] = [
    { label: t('practitioner'), value: practitioner },
    { label: t('recordSought'), value: record },
    { label: t('explicitPurpose'), value: purpose },
    { label: t('tokenValidity'), value: t('tokenValidityValue', { minutes }), tone: 'green' },
  ];

  // Non-dismissible: the patient must explicitly authorize or decline
  return (
    <GlassSheet visible={visible}>
      <SheetHeader
        icon="key"
        title={t('consentTitle')}
        subtitle={t('consentSubtitle')}
        right={
          <View accessible accessibilityLabel={`${t('timeRemaining')} ${formatCountdown(timeLeft)}`}>
            <Badge label={formatCountdown(timeLeft)} tone="orange" icon="timer" size="md" />
          </View>
        }
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Plain-language notice with audio read-out */}
        <View style={styles.noticeRow}>
          <AppText variant="footnote" color="secondary" style={styles.flex}>
            {notice}
          </AppText>
          <AudioListenButton
            text={() => [notice, ...rows.map((r) => `${r.label}: ${r.value}`)].join('. ')}
          />
        </View>

        {/* Request details */}
        <Well style={styles.details}>
          {rows.map((row) => (
            <View key={row.label} style={styles.detailRow}>
              <AppText variant="eyebrow" color="tertiary" compact>
                {row.label}
              </AppText>
              <AppText variant="subhead" weight={600} color={row.tone === 'green' ? 'greenDeep' : 'label'}>
                {row.value}
              </AppText>
            </View>
          ))}
        </Well>

        <TextField
          label={t('consentOtpLabel')}
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="123456"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          hint={t('consentOtpHint')}
          otp
        />

        <View style={styles.actions}>
          <DestructiveButton label={t('decline')} icon="close" onPress={onDecline} disabled={submitting} style={styles.decline} />
          <PrimaryButton
            label={t('authorizeAccess')}
            icon="verified-user"
            onPress={handleConfirm}
            loading={submitting}
            style={styles.approve}
          />
        </View>
      </ScrollView>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexShrink: 1,
  },
  body: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  details: {
    gap: spacing.md,
  },
  detailRow: {
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  decline: {
    flex: 1,
  },
  approve: {
    flex: 1.5,
  },
});
