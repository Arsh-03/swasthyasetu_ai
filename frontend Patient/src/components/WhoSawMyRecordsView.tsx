import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing, type Tone } from '../theme/tokens';
import { patientApi, type ConsentHistoryItem } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../utils/translations';
import { GlassCard } from './glass';
import {
  AppText,
  Avatar,
  Badge,
  Card,
  DestructiveButton,
  IconTile,
  NavBar,
  ScreenScroll,
  ScreenHeader,
  SectionHeader,
  Well,
} from './ui';

type ConsentStatus = ConsentHistoryItem['status'];

const STATUS_LABEL: Record<ConsentStatus, TranslationKey> = {
  approved: 'statusActive',
  requested: 'statusRequested',
  expired: 'statusExpired',
  revoked: 'statusRevoked',
  declined: 'statusDeclined',
};

// Outcome pills, same colour logic as the Doctor audit ledger (success / pending / failure)
const STATUS_BADGE: Record<ConsentStatus, { key: TranslationKey; tone: Tone }> = {
  approved: { key: 'badgeActive', tone: 'green' },
  requested: { key: 'badgePending', tone: 'orange' },
  expired: { key: 'badgeExpired', tone: 'neutral' },
  revoked: { key: 'badgeRevoked', tone: 'red' },
  declined: { key: 'badgeDeclined', tone: 'red' },
};

const LOCALE = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' } as const;

const initialsOf = (name: string) =>
  name
    .replace(/^Dr\.?\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'D';

interface WhoSawMyRecordsViewProps {
  onBack: () => void;
  backLabel: string;
}

export const WhoSawMyRecordsView: React.FC<WhoSawMyRecordsViewProps> = ({ onBack, backLabel }) => {
  const { lang, t } = useLanguage();
  const [logs, setLogs] = useState<ConsentHistoryItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      patientApi
        .getConsentHistory()
        .then((rows) => {
          setLogs(rows);
          setStatus('ready');
        })
        .catch(() => setStatus('error')),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleRevoke = async (id: string) => {
    setRevokeError(null);
    try {
      await patientApi.revokeConsent(id);
      await load();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : t('couldNotRevoke'));
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(LOCALE[lang], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <NavBar backLabel={backLabel} onBack={onBack} />

      <ScreenHeader icon="verified-user" title={t('privacyReport')} subtitle={t('privacySubtitle')} />

      {/* Data & privacy notice */}
      <GlassCard contentStyle={styles.notice}>
        <IconTile icon="shield" tone="blue" />
        <View style={styles.flex}>
          <AppText variant="callout">{t('yourDataYourControl')}</AppText>
          <AppText variant="footnote" color="secondary">
            {t('privacyNotice')}
          </AppText>
        </View>
      </GlassCard>

      <View style={styles.section}>
        <SectionHeader title={t('doctorAccessLogs')} count={logs.length} />

        {revokeError && (
          <AppText variant="footnote" color="red" accessibilityRole="alert">
            {revokeError}
          </AppText>
        )}

        {logs.length === 0 &&
          (status === 'error' ? (
            <Pressable onPress={load} accessibilityRole="button" style={styles.empty}>
              <AppText variant="footnote" weight={600} color="blue" align="center">
                {t('accessHistoryError')} {t('retry')}
              </AppText>
            </Pressable>
          ) : (
            <AppText variant="footnote" color="tertiary" align="center" style={styles.empty}>
              {status === 'loading' ? t('loadingAccessHistory') : t('noAccessYet')}
            </AppText>
          ))}

        {logs.map((log) => {
          const badge = STATUS_BADGE[log.status] ?? STATUS_BADGE.expired;
          const remaining = log.active && log.remaining ? log.remaining : t(STATUS_LABEL[log.status] ?? 'statusExpired');
          return (
            <Card key={log.consent_id} style={styles.logCard}>
              {/* Actor & credentials */}
              <View style={styles.actorRow}>
                <Avatar initials={initialsOf(log.doctor)} size={40} />
                <View style={styles.flex}>
                  <AppText variant="callout">{log.doctor}</AppText>
                  <AppText variant="mono" color="tertiary">
                    {log.reg} • {log.facility}
                  </AppText>
                </View>
                <Badge
                  label={t(log.active ? 'badgeActive' : badge.key)}
                  tone={log.active ? 'green' : badge.tone}
                  dot
                />
              </View>

              {/* Resource & stated purpose */}
              <Well style={styles.scope}>
                <View style={styles.scopeRow}>
                  <AppText variant="eyebrow" color="tertiary" compact style={styles.scopeLabel}>
                    {t('scopeRecord')}
                  </AppText>
                  <AppText variant="footnote" weight={600} style={styles.flex}>
                    {log.record}
                  </AppText>
                </View>
                <View style={styles.scopeRow}>
                  <AppText variant="eyebrow" color="tertiary" compact style={styles.scopeLabel}>
                    {t('scopePurpose')}
                  </AppText>
                  <AppText variant="footnote" color="secondary" style={[styles.flex, styles.italic]}>
                    “{log.purpose}”
                  </AppText>
                </View>
              </Well>

              {/* Timestamp, remaining time and revoke */}
              <View style={styles.footer}>
                <View style={styles.flex}>
                  <AppText variant="mono" color="tertiary">
                    {formatTime(log.created_at)}
                  </AppText>
                  <AppText variant="caption" weight={600} color={log.active ? 'greenDeep' : 'secondary'}>
                    {remaining}
                  </AppText>
                </View>
                {log.active && (
                  <DestructiveButton
                    label={t('revokeAccess')}
                    icon="block"
                    size="sm"
                    onPress={() => handleRevoke(log.consent_id)}
                  />
                )}
              </View>
            </Card>
          );
        })}
      </View>
    </ScreenScroll>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  italic: {
    fontStyle: 'italic',
  },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  section: {
    gap: spacing.md,
  },
  empty: {
    paddingVertical: spacing.xxxl,
  },
  logCard: {
    gap: spacing.md,
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scope: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  scopeLabel: {
    width: 72,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
});
