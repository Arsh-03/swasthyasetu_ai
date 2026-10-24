import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing, tints } from '../theme/tokens';
import { patientApi, type HealthRecord } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import {
  AppText,
  Badge,
  Card,
  Icon,
  type IconName,
  IconTile,
  NavBar,
  ScreenScroll,
  ScreenHeader,
  SecondaryButton,
  SectionHeader,
  SegmentedControl,
} from './ui';

interface LockerRecord {
  id: string;
  title: string;
  category: 'diagnostic' | 'lab';
  facility: string | null;
  date: string;
  icon: IconName;
  sharedWith: string | null;
  minutesLeft: number | null;
  size: string;
}

const formatSize = (bytes: number, mime: string) => {
  const size =
    bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const kind = mime.includes('dicom') ? 'DICOM' : mime.includes('json') ? 'FHIR JSON' : mime.includes('pdf') ? 'PDF' : mime;
  return `${size} • ${kind}`;
};

const minutesUntil = (iso: string | null) => {
  if (!iso) return null;
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  return mins > 0 ? mins : null;
};

const toLockerRecord = (r: HealthRecord): LockerRecord => {
  const isLab = r.category === 'lab';
  const left = minutesUntil(r.consent_expires_at);
  const shared = !!r.shared_with && left !== null;
  return {
    id: r.record_id,
    title: r.title,
    category: isLab ? 'lab' : 'diagnostic',
    facility: r.facility,
    date: r.date_str,
    icon: isLab ? 'science' : r.record_type.includes('discharge') ? 'description' : 'monitor-heart',
    sharedWith: shared ? r.shared_with : null,
    minutesLeft: shared ? left : null,
    size: formatSize(r.file_size_bytes, r.file_mime_type),
  };
};

interface RecordsLockerViewProps {
  patientId: string;
  onBack: () => void;
  onOpenAudit: () => void;
}

export const RecordsLockerView: React.FC<RecordsLockerViewProps> = ({ patientId, onBack, onOpenAudit }) => {
  const { t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<'all' | 'diagnostic' | 'lab'>('all');
  const [records, setRecords] = useState<LockerRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    patientApi
      .getPatientRecords(patientId)
      .then((rows) => {
        if (cancelled) return;
        setRecords(rows.map(toLockerRecord));
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const filteredRecords = activeFilter === 'all' ? records : records.filter((r) => r.category === activeFilter);
  const sharedCount = records.filter((r) => r.sharedWith).length;

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <NavBar
        backLabel={t('home')}
        onBack={onBack}
        right={<SecondaryButton label={t('privacyLog')} icon="verified-user" tone="blue" size="sm" onPress={onOpenAudit} />}
      />

      <ScreenHeader
        title={t('healthRecords')}
        subtitle={t('recordsSubtitle')}
        accessory={
          <>
            <Badge label={t('fhirEncrypted')} tone="blue" icon="shield" />
            <Badge label={t('sharedCount', { count: sharedCount })} tone="green" dot />
            <Badge label={t('lockedCount', { count: records.length - sharedCount })} tone="neutral" dot />
          </>
        }
      />

      <SegmentedControl
        options={[
          { value: 'all', label: t('filterAll') },
          { value: 'diagnostic', label: t('filterImaging') },
          { value: 'lab', label: t('filterLab') },
        ]}
        value={activeFilter}
        onChange={setActiveFilter}
      />

      <View style={styles.section}>
        <SectionHeader title={t('clinicalDocuments')} count={filteredRecords.length} />

        {filteredRecords.length === 0 && (
          <AppText variant="footnote" color="tertiary" align="center" style={styles.empty}>
            {status === 'loading' ? t('loadingRecords') : status === 'error' ? t('recordsError') : t('noRecordsInCategory')}
          </AppText>
        )}

        {filteredRecords.map((r) => {
          const shared = !!r.sharedWith;
          return (
            <Card key={r.id} style={[styles.recordCard, shared ? styles.recordShared : styles.recordLocked]}>
              {/* Eyebrow + status */}
              <View style={styles.eyebrowRow}>
                <AppText variant="eyebrow" color="tertiary" compact style={styles.flex}>
                  {r.category === 'lab' ? t('categoryLab') : t('categoryImaging')}
                </AppText>
                {shared ? (
                  <Badge label={t('sharedWith', { name: r.sharedWith ?? '' })} tone="green" icon="verified" />
                ) : (
                  <Badge label={t('encryptedVault')} tone="neutral" icon="lock" />
                )}
              </View>

              <View style={styles.titleRow}>
                <IconTile icon={r.icon} tone={shared ? 'green' : 'blue'} size={40} />
                <AppText variant="headline" style={styles.flex}>
                  {r.title}
                </AppText>
              </View>

              <View style={styles.metaRow}>
                <Icon name="apartment" size={14} color={colors.tertiary} />
                <AppText variant="footnote" weight={500} style={styles.metaFacility}>
                  {r.facility || t('abdmLinkedFacility')}
                </AppText>
                <AppText variant="footnote" color="tertiary">
                  • {r.date}
                </AppText>
              </View>

              <View style={styles.footer}>
                <AppText variant="mono" color="tertiary">
                  {r.size}
                </AppText>
                {r.minutesLeft !== null && (
                  <Badge label={t('minutesLeft', { minutes: r.minutesLeft })} tone="green" icon="schedule" />
                )}
              </View>
            </Card>
          );
        })}
      </View>

      {/* Security banner */}
      <View style={styles.trustBanner}>
        <IconTile icon="lock" tone="blue" />
        <View style={styles.flex}>
          <AppText variant="subhead" weight={600}>
            {t('encryptionTitle')}
          </AppText>
          <AppText variant="footnote" color="secondary">
            {t('encryptionBody')}
          </AppText>
        </View>
      </View>
    </ScreenScroll>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
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
    paddingVertical: spacing.xxxl,
  },
  recordCard: {
    gap: spacing.md,
    padding: spacing.xl,
  },
  recordShared: {
    borderColor: tints.greenRing,
  },
  recordLocked: {
    backgroundColor: colors.cardMuted,
    borderColor: colors.border,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaFacility: {
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: tints.blueSubtle,
    borderWidth: 1,
    borderColor: tints.blueRing,
  },
});
