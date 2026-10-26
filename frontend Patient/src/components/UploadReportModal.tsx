import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { patientApi, type HealthRecord, type UploadDocumentInput } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { pickHealthReportDocument } from '../utils/documentPicker';
import { GlassSheet } from './glass';
import {
  AppText,
  Badge,
  Card,
  Icon,
  PrimaryButton,
  SecondaryButton,
  SheetHeader,
  TextField,
  Well,
} from './ui';

interface UploadReportModalProps {
  visible: boolean;
  patientId: string;
  onClose: () => void;
  onUploadSuccess: (record: HealthRecord) => void;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export const UploadReportModal: React.FC<UploadReportModalProps> = ({
  visible,
  patientId,
  onClose,
  onUploadSuccess,
}) => {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<UploadDocumentInput | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [status, setStatus] = useState<UploadState>('idle');
  const [stepMessage, setStepMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedRecord, setUploadedRecord] = useState<HealthRecord | null>(null);

  const resetState = () => {
    setSelectedFile(null);
    setCustomTitle('');
    setStatus('idle');
    setStepMessage('');
    setErrorMessage(null);
    setUploadedRecord(null);
  };

  const handleClose = () => {
    if (status === 'uploading') return;
    resetState();
    onClose();
  };

  const handlePickFile = async () => {
    setErrorMessage(null);
    const file = await pickHealthReportDocument();
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setStatus('uploading');
    setErrorMessage(null);
    setStepMessage(t('uploadingAndReadingOcr'));

    try {
      setTimeout(() => {
        setStepMessage(t('generatingSummary'));
      }, 1400);

      const record = await patientApi.uploadHealthRecord(
        selectedFile,
        patientId,
        customTitle.trim() || undefined
      );

      setStepMessage(t('encryptingToVault'));
      setUploadedRecord(record);
      setStatus('success');
      onUploadSuccess(record);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || t('uploadFailed'));
    }
  };

  return (
    <GlassSheet visible={visible} onClose={handleClose} closeOnBackdrop={status !== 'uploading'}>
      <SheetHeader
        icon="document"
        title={t('uploadReport')}
        subtitle={t('uploadReportSubtitle')}
        onClose={handleClose}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {status === 'error' && errorMessage && (
          <Well style={styles.errorWell}>
            <View style={styles.errorRow} accessibilityRole="alert">
              <Icon name="error" size={20} color={colors.dangerDeep} active />
              <AppText variant="footnote" weight={600} color="dangerDeep" style={styles.flex}>
                {errorMessage}
              </AppText>
            </View>
          </Well>
        )}

        {status === 'success' && uploadedRecord ? (
          <View style={styles.successContainer}>
            <View style={styles.successBadgeRow}>
              <Icon name="checkCircle" size={24} color={colors.successDeep} active />
              <AppText variant="headline" color="successDeep">
                {t('uploadSuccess')}
              </AppText>
            </View>

            <Card style={styles.summaryCard}>
              <View style={styles.cardHeaderRow}>
                <Badge label={t('ocrVerified')} tone="primary" icon="sparkle" />
                <Badge label={t('fhirEncrypted')} tone="neutral" icon="lock" />
              </View>

              <AppText variant="title2" weight={700}>
                {typeof uploadedRecord.title === 'string'
                  ? uploadedRecord.title
                  : uploadedRecord.title?.en || 'Medical Report'}
              </AppText>

              {uploadedRecord.summary_findings && (
                <View style={styles.findingsBlock}>
                  <AppText variant="subhead" weight={600} color="ink">
                    {t('summaryFindings')}
                  </AppText>
                  <AppText variant="body" color="inkMuted" style={styles.findingsText}>
                    {uploadedRecord.summary_findings}
                  </AppText>
                </View>
              )}
            </Card>

            <PrimaryButton
              label={t('close')}
              icon="check"
              onPress={handleClose}
            />
          </View>
        ) : (
          <>
            {/* File selection block */}
            <Card style={styles.filePickerCard}>
              {selectedFile ? (
                <View style={styles.fileDetails}>
                  <View style={styles.fileIconBox}>
                    <Icon
                      name={selectedFile.type.includes('pdf') ? 'document' : 'lab'}
                      size={28}
                      color={colors.primary}
                      active
                    />
                  </View>
                  <View style={styles.fileInfo}>
                    <AppText variant="subhead" weight={600} numberOfLines={1}>
                      {selectedFile.name}
                    </AppText>
                    <AppText variant="footnote" color="inkMuted">
                      {selectedFile.type.includes('pdf') ? 'PDF Document' : 'Scanned Image'}
                    </AppText>
                  </View>
                  <SecondaryButton
                    label={t('changeReportFile')}
                    size="sm"
                    onPress={handlePickFile}
                    disabled={status === 'uploading'}
                  />
                </View>
              ) : (
                <View style={styles.emptyPicker}>
                  <View style={styles.emptyPickerIcon}>
                    <Icon name="upload" size={32} color={colors.primary} active />
                  </View>
                  <AppText variant="headline" align="center">
                    {t('selectReportFile')}
                  </AppText>
                  <AppText variant="footnote" color="inkMuted" align="center">
                    PDF, JPEG, or PNG supported (e.g. Lab reports, USG scans, Prescriptions)
                  </AppText>
                  <PrimaryButton
                    label={t('selectReportFile')}
                    icon="upload"
                    onPress={handlePickFile}
                  />
                </View>
              )}
            </Card>

            {selectedFile && (
              <>
                <TextField
                  label={t('customTitleOptional')}
                  placeholder="e.g. Ultrasound Whole Abdomen or CBC Report"
                  value={customTitle}
                  onChangeText={setCustomTitle}
                  icon="document"
                  editable={status !== 'uploading'}
                />

                <Well style={styles.infoWell}>
                  <View style={styles.infoRow}>
                    <Icon name="sparkle" size={20} color={colors.primary} active />
                    <View style={styles.flex}>
                      <AppText variant="subhead" weight={600} color="primary">
                        {t('ocrVerified')}
                      </AppText>
                      <AppText variant="footnote" color="inkMuted">
                        Paddle OCR will read every line and table in your document, extract diagnostic impressions, and generate an ABDM summary.
                      </AppText>
                    </View>
                  </View>
                </Well>

                {status === 'uploading' ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <AppText variant="subhead" weight={600} color="primary" align="center">
                      {stepMessage}
                    </AppText>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    <PrimaryButton
                      label={t('saveToLocker')}
                      icon="sparkle"
                      onPress={handleUpload}
                    />
                    <SecondaryButton
                      label={t('cancel')}
                      onPress={handleClose}
                    />
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 520,
  },
  body: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  filePickerCard: {
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  emptyPicker: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  emptyPickerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EBF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fileIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EBF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    gap: 2,
  },
  infoWell: {
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  errorWell: {
    padding: spacing.md,
    backgroundColor: '#FDE8E8',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  successContainer: {
    gap: spacing.lg,
  },
  successBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  summaryCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  findingsBlock: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  findingsText: {
    lineHeight: 20,
  },
});
