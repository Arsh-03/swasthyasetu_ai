import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { patientApi, type HealthRecord } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDateLabel } from '../utils/dates';
import { localized, type LocalizedText } from '../utils/localized';
import { EmptyRecords } from './illustrations';
import {
  AppText,
  Badge,
  Card,
  Icon,
  type IconName,
  IconDisc,
  LIST_ROW_TEXT_INSET,
  ListRow,
  NavBar,
  NeuList,
  PrimaryButton,
  ScreenScroll,
  ScreenHeader,
  SecondaryButton,
  SectionHeader,
  SegmentedControl,
} from './ui';
import { UploadReportModal } from './UploadReportModal';

interface LockerRecord {
  id: string;
  title: LocalizedText;
  category: 'diagnostic' | 'lab';
  facility: LocalizedText | null;
  /** Backend date label ("14 Sep 2026"), localised at render. */
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
    icon: isLab ? 'lab' : r.record_type.includes('discharge') ? 'document' : 'heartbeat',
    sharedWith: shared ? r.shared_with : null,
    minutesLeft: shared ? left : null,
    size: formatSize(r.file_size_bytes, r.file_mime_type),
  };
};

type Filter = 'all' | 'diagnostic' | 'lab';

interface RecordsLockerViewProps {
  patientId: string;
  onBack: () => void;
  onOpenAudit: () => void;
}

export const RecordsLockerView: React.FC<RecordsLockerViewProps> = ({ patientId, onBack, onOpenAudit }) => {
  const { lang, t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [records, setRecords] = useState<LockerRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);

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
  }, [patientId, reloadKey]);

  const filteredRecords = activeFilter === 'all' ? records : records.filter((r) => r.category === activeFilter);
  const sharedCount = records.filter((r) => r.sharedWith).length;

  const retry = () => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  };

  const timeLeft = (minutes: number) =>
    minutes < 60 ? t('minutesLeft', { minutes }) : t('hoursLeft', { hours: Math.floor(minutes / 60) });

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <NavBar
        backLabel={t('home')}
        onBack={onBack}
        right={<SecondaryButton label={t('privacyLog')} icon="shieldCheck" tone="primary" size="sm" onPress={onOpenAudit} />}
      />

      <ScreenHeader
        icon="records"
        title={t('healthRecords')}
        subtitle={t('recordsSubtitle')}
        accessory={
          status === 'ready' ? (
            <>
              <Badge label={t('fhirEncrypted')} tone="primary" icon="shield" />
              <Badge label={t('sharedCount', { count: sharedCount })} tone="success" dot />
              <Badge label={t('lockedCount', { count: records.length - sharedCount })} tone="neutral" dot />
            </>
          ) : (
            <Badge label={t('fhirEncrypted')} tone="primary" icon="shield" />
          )
        }
      />

      <SegmentedControl
        options={[
          { value: 'all', label: t('filterAll') },
          { value: 'diagnostic', label: t('filterImaging') },
          { value: 'lab', label: t('segLab') },
        ]}
        value={activeFilter}
        onChange={setActiveFilter}
        accessibilityLabel={t('filterRecords')}
      />

      <View style={styles.section}>
        <SectionHeader
          title={t('clinicalDocuments')}
          count={status === 'ready' ? filteredRecords.length : undefined}
          right={
            <PrimaryButton
              label={t('uploadReport')}
              icon="upload"
              size="sm"
              onPress={() => setUploadModalVisible(true)}
            />
          }
        />

        {filteredRecords.length === 0 ? (
          // Empty / loading / error: raised panel so the retry button never sits inside an inset
          <Card>
            <View style={styles.empty} accessibilityLiveRegion="polite">
              <EmptyRecords width={150} />
              {status === 'loading' ? (
                <View style={styles.inline}>
                  <ActivityIndicator color={colors.primary} />
                  <AppText variant="subhead" weight={600}>
                    {t('loadingRecords')}
                  </AppText>
                </View>
              ) : status === 'error' ? (
                <>
                  <View style={styles.inline} accessibilityRole="alert">
                    <Icon name="network" size={20} color={colors.warningDeep} active />
                    <AppText variant="subhead" weight={600} color="warningDeep" style={styles.shrink}>
                      {t('recordsError')}
                    </AppText>
                  </View>
                  <SecondaryButton label={t('retry')} tone="primary" size="sm" onPress={retry} />
                </>
              ) : (
                <>
                  <AppText variant="headline" align="center">
                    {records.length === 0 ? t('noRecordsYet') : t('noRecordsInCategory')}
                  </AppText>
                  <PrimaryButton
                    label={t('uploadReport')}
                    icon="upload"
                    size="sm"
                    onPress={() => setUploadModalVisible(true)}
                  />
                </>
              )}
            </View>
          </Card>
        ) : (
          // Read-only list: one inset tray, rows separated by grooves
          <NeuList variant="tray" grooveInset={LIST_ROW_TEXT_INSET}>
            {filteredRecords.map((r) => {
              const shared = !!r.sharedWith;
              const title = localized(r.title, lang);
              return (
                <ListRow
                  key={r.id}
                  icon={r.icon}
                  iconTone={shared ? 'success' : 'primary'}
                  title={title}
                  subtitle={`${r.category === 'lab' ? t('categoryLab') : t('categoryImaging')} • ${formatDateLabel(r.date, lang)}`}
                >
                  <View style={styles.meta}>
                    <Icon name="building" size={14} color={colors.inkMuted} />
                    <AppText variant="footnote" color="inkMuted" style={styles.shrink}>
                      {localized(r.facility, lang) || t('abdmLinkedFacility')}
                    </AppText>
                  </View>

                  <View style={styles.badges}>
                    {shared ? (
                      <Badge label={t('statusShared')} tone="success" icon="people" />
                    ) : (
                      <Badge label={t('statusLocked')} tone="neutral" icon="lock" />
                    )}
                    {r.minutesLeft !== null && <Badge label={timeLeft(r.minutesLeft)} tone="success" icon="clock" />}
                  </View>

                  {shared && (
                    <AppText variant="footnote" weight={600} color="successDeep">
                      {t('canView', { name: r.sharedWith ?? '' })}
                    </AppText>
                  )}

                  <AppText variant="mono" color="inkMuted">
                    {r.size}
                  </AppText>
                </ListRow>
              );
            })}
          </NeuList>
        )}
      </View>

      {/* Security note */}
      <Card style={styles.trust}>
        <IconDisc icon="lock" tone="primary" />
        <View style={styles.flex}>
          <AppText variant="subhead" weight={600}>
            {t('encryptionTitle')}
          </AppText>
          <AppText variant="footnote" color="inkMuted">
            {t('encryptionBody')}
          </AppText>
        </View>
      </Card>

      <UploadReportModal
        visible={uploadModalVisible}
        patientId={patientId}
        onClose={() => setUploadModalVisible(false)}
        onUploadSuccess={(newRec) => {
          setRecords((prev) => [toLockerRecord(newRec), ...prev]);
        }}
      />
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
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
