import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing, type Tone } from '../theme/tokens';
import { patientApi, type ConsentHistoryItem } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../utils/translations';
import { formatTimestamp } from '../utils/dates';
import { localized } from '../utils/localized';
import { EmptyAccessLog } from './illustrations';
import {
  AppText,
  AudioListenButton,
  Avatar,
  Badge,
  Card,
  CriticalButton,
  Icon,
  type IconName,
  IconDisc,
  NavBar,
  ScreenScroll,
  ScreenHeader,
  SecondaryButton,
  SectionHeader,
  Well,
} from './ui';

type ConsentStatus = ConsentHistoryItem['status'];

/** Longer status line (used under the timestamp and in Listen). */
const STATUS_LABEL: Record<ConsentStatus, TranslationKey> = {
  approved: 'statusActive',
  requested: 'statusRequested',
  expired: 'statusExpired',
  revoked: 'statusRevoked',
  declined: 'statusDeclined',
};

/** One-word status badge: same colour logic as the Doctor audit ledger, plus an icon. */
const STATUS_BADGE: Record<ConsentStatus, { key: TranslationKey; tone: Tone; icon: IconName }> = {
  approved: { key: 'badgeActive', tone: 'success', icon: 'people' },
  requested: { key: 'badgePending', tone: 'warning', icon: 'hourglass' },
  expired: { key: 'badgeExpired', tone: 'neutral', icon: 'clock' },
  revoked: { key: 'badgeRevoked', tone: 'danger', icon: 'block' },
  declined: { key: 'badgeDeclined', tone: 'danger', icon: 'close' },
};

const initialsOf = (name: string) =>
  name
    .replace(/^Dr\.?\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'D';

const minutesUntil = (iso: string | null) => {
  if (!iso) return null;
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  return mins > 0 ? mins : null;
};

/** `fetch` rejects with a TypeError when no response arrives (offline, server down). */
const isNetworkError = (err: unknown) => err instanceof TypeError;

interface ConsentCardProps {
  log: ConsentHistoryItem;
  onRevoked: (doctor: string) => void;
  /** Override for the Style Guide preview (defaults to the real API call). */
  revokeFn?: (consentId: string) => Promise<unknown>;
}

export const ConsentCard: React.FC<ConsentCardProps> = ({ log, onRevoked, revokeFn = (id) => patientApi.revokeConsent(id) }) => {
  const { lang, t } = useLanguage();
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  const status = STATUS_BADGE[log.status] ? log.status : 'expired';
  const badge = STATUS_BADGE[status];
  const active = log.active;
  const facility = localized(log.facility, lang) || t('abdmLinkedFacility');
  const record = localized(log.record, lang);
  const purpose = localized(log.purpose, lang);

  const mins = active ? minutesUntil(log.expires_at) : null;
  const timeLeft =
    mins !== null
      ? mins < 60
        ? t('minutesLeft', { minutes: mins })
        : t('hoursLeft', { hours: Math.floor(mins / 60) })
      : active
        ? localized(log.remaining, lang)
        : '';
  const statusLine = t(STATUS_LABEL[status]);

  const revoke = async () => {
    setError(null);
    setRevoking(true);
    try {
      await revokeFn(log.consent_id);
      onRevoked(log.doctor);
    } catch (err) {
      if (__DEV__) console.warn('[Privacy] revoke failed:', err);
      setError(isNetworkError(err) ? 'revokeNetworkError' : 'couldNotRevoke');
      setRevoking(false);
    }
  };

  return (
    <Card style={styles.logCard}>
      {/* Who */}
      <View style={styles.actorRow}>
        <Avatar initials={initialsOf(log.doctor)} size={40} />
        <View style={styles.flex}>
          <AppText variant="callout">{log.doctor}</AppText>
          <AppText variant="footnote" color="inkMuted">
            {[log.reg, facility].filter(Boolean).join(' • ')}
          </AppText>
        </View>
        <Badge label={t(badge.key)} tone={badge.tone} icon={badge.icon} />
      </View>

      {/* What and why */}
      <Well style={styles.scope}>
        <View style={styles.scopeRow}>
          <AppText variant="eyebrow" color="inkMuted" compact style={styles.scopeLabel}>
            {t('scopeRecord')}
          </AppText>
          <AppText variant="footnote" weight={600} style={styles.flex}>
            {record}
          </AppText>
        </View>
        <View style={styles.scopeRow}>
          <AppText variant="eyebrow" color="inkMuted" compact style={styles.scopeLabel}>
            {t('scopePurpose')}
          </AppText>
          <AppText variant="footnote" color="inkMuted" style={[styles.flex, styles.italic]}>
            “{purpose}”
          </AppText>
        </View>
      </Well>

      {/* When, how long, Listen */}
      <View style={styles.metaRow}>
        <View style={[styles.flex, styles.metaText]}>
          <AppText variant="mono" color="inkMuted">
            {formatTimestamp(log.created_at, lang)}
          </AppText>
          {active && timeLeft ? (
            <Badge label={timeLeft} tone="success" icon="clock" />
          ) : (
            <AppText variant="caption" weight={600} color="inkMuted">
              {statusLine}
            </AppText>
          )}
        </View>
        <AudioListenButton
          text={() =>
            t('listenConsent', {
              name: log.doctor,
              facility,
              status: statusLine,
              record,
              purpose,
              time: timeLeft,
            })
          }
        />
      </View>

      {active && (
        <View style={styles.actions}>
          {error && (
            <View style={styles.inline} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Icon
                name={error === 'revokeNetworkError' ? 'network' : 'error'}
                size={20}
                color={error === 'revokeNetworkError' ? colors.warningDeep : colors.dangerDeep}
                active
              />
              <AppText
                variant="footnote"
                weight={600}
                color={error === 'revokeNetworkError' ? 'warningDeep' : 'dangerDeep'}
                style={styles.shrink}
              >
                {t(error)}
              </AppText>
            </View>
          )}
          <CriticalButton tone="danger" icon="block" label={t('revokeAccess')} loading={revoking} onPress={revoke} />
        </View>
      )}
    </Card>
  );
};

interface WhoSawMyRecordsViewProps {
  onBack: () => void;
  backLabel: string;
  /** Called after a successful revoke (App shows a toast). */
  onRevoked?: (doctor: string) => void;
}

export const WhoSawMyRecordsView: React.FC<WhoSawMyRecordsViewProps> = ({ onBack, backLabel, onRevoked }) => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<ConsentHistoryItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    patientApi
      .getConsentHistory()
      .then((rows) => {
        if (cancelled) return;
        setLogs(rows);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  };

  // Refresh quietly (keeps the list on screen) so the revoked card moves to Past requests
  const handleRevoked = useCallback(
    (doctor: string) => {
      onRevoked?.(doctor);
      setReloadKey((k) => k + 1);
    },
    [onRevoked]
  );

  const active = logs.filter((l) => l.active);
  const past = logs.filter((l) => !l.active);

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <NavBar backLabel={backLabel} onBack={onBack} />

      <ScreenHeader
        icon="shieldCheck"
        title={t('privacyReport')}
        subtitle={t('privacySubtitle')}
        accessory={
          <>
            <Badge label={t('dpdpBadge')} tone="primary" icon="shieldCheck" />
            {status === 'ready' && active.length > 0 && (
              <Badge label={t('activeCount', { count: active.length })} tone="success" dot />
            )}
          </>
        }
      />

      {logs.length === 0 ? (
        // Loading / error / empty: raised panel so Retry never sits inside an inset
        <View style={styles.section}>
          <SectionHeader title={t('doctorAccessLogs')} />
          <Card>
            <View style={styles.empty} accessibilityLiveRegion="polite">
              <EmptyAccessLog width={150} />
              {status === 'loading' ? (
                <View style={styles.inline}>
                  <ActivityIndicator color={colors.primary} />
                  <AppText variant="subhead" weight={600}>
                    {t('loadingAccessHistory')}
                  </AppText>
                </View>
              ) : status === 'error' ? (
                <>
                  <View style={styles.inline} accessibilityRole="alert">
                    <Icon name="network" size={20} color={colors.warningDeep} active />
                    <AppText variant="subhead" weight={600} color="warningDeep" style={styles.shrink}>
                      {t('accessHistoryError')}
                    </AppText>
                  </View>
                  <SecondaryButton label={t('retry')} tone="primary" size="sm" onPress={retry} />
                </>
              ) : (
                <AppText variant="headline" align="center">
                  {t('noAccessYet')}
                </AppText>
              )}
            </View>
          </Card>
        </View>
      ) : (
        <>
          {active.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t('activeAccess')} count={active.length} />
              {active.map((log) => (
                <ConsentCard key={log.consent_id} log={log} onRevoked={handleRevoked} />
              ))}
            </View>
          )}
          {past.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t('pastRequests')} count={past.length} />
              {past.map((log) => (
                <ConsentCard key={log.consent_id} log={log} onRevoked={handleRevoked} />
              ))}
            </View>
          )}
        </>
      )}

      {/* Data & privacy notice */}
      <Card style={styles.notice}>
        <IconDisc icon="shield" tone="primary" />
        <View style={styles.flex}>
          <AppText variant="subhead" weight={600}>
            {t('yourDataYourControl')}
          </AppText>
          <AppText variant="footnote" color="inkMuted">
            {t('privacyNotice')}
          </AppText>
        </View>
      </Card>
    </ScreenScroll>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  shrink: {
    flexShrink: 1,
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
  section: {
    gap: spacing.md,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaText: {
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
});
