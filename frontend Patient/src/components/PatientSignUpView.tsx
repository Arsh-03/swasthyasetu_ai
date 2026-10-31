import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { ApiError, patientApi, type PatientUser, type UploadDocumentInput } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../utils/translations';
import { pickHealthReportDocument } from '../utils/documentPicker';
import { AppText, AudioListenButton, Badge, Icon, NeuPanel, PrimaryButton, SecondaryButton, SegmentedControl, TextField, Well } from './ui';
import { useScripts } from '../speech';

interface PatientSignUpViewProps {
  onSignUpSuccess: (user: PatientUser) => void;
  onBackToSignIn: () => void;
}

type Gender = 'male' | 'female' | 'other';

// Sign-in is OTP-based (demo OTP), and login always sends this demo password, so new
// accounts use it too. Swap for a real credential once OTP verification is live.
const DEMO_PASSWORD = 'password123';

const isValidMobile = (m: string) => /^[6-9]\d{9}$/.test(m);

/** "Ramesh.Gowda" → "ramesh.gowda@abdm"; empty → "<mobile>@abdm" so the account still has an ABHA handle. */
const normaliseAbha = (abha: string, mobile: string) => {
  const clean = abha.trim().toLowerCase();
  if (!clean) return `${mobile}@abdm`;
  return clean.includes('@') ? clean : `${clean}@abdm`;
};

/** Create-account form panel. Shown in place of the sign-in panel on the login screen. */
export const PatientSignUpView: React.FC<PatientSignUpViewProps> = ({ onSignUpSuccess, onBackToSignIn }) => {
  const { lang, t } = useLanguage();
  const scripts = useScripts();
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [abha, setAbha] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [district, setDistrict] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  // Optional report upload during signup
  const [reportFile, setReportFile] = useState<UploadDocumentInput | null>(null);
  const [analyzingReport, setAnalyzingReport] = useState(false);
  const [initialRecord, setInitialRecord] = useState<any | null>(null);
  const [reportOcrError, setReportOcrError] = useState<string | null>(null);

  const handlePickReport = async () => {
    setReportOcrError(null);
    const file = await pickHealthReportDocument();
    if (!file) return;
    setReportFile(file);
    setAnalyzingReport(true);
    try {
      const data = await patientApi.uploadInitialReport(file);
      setInitialRecord(data.record);
    } catch (err: any) {
      if (__DEV__) console.warn('OCR preview failed:', err);
      setReportOcrError(err?.message || 'Could not analyze with OCR, but file will be attached.');
    } finally {
      setAnalyzingReport(false);
    }
  };

  const handleRemoveReport = () => {
    setReportFile(null);
    setInitialRecord(null);
    setReportOcrError(null);
  };

  const handleSubmit = async () => {
    const name = fullName.trim();
    const phone = mobile.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    const ageNum = age.trim() ? Number(age) : NaN;

    if (!name) return setErrorKey('signUpInvalidName');
    if (!isValidMobile(phone)) return setErrorKey('signUpInvalidMobile');
    if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) return setErrorKey('signUpInvalidAge');

    setLoading(true);
    setErrorKey(null);
    try {
      const res = await patientApi.registerPatient({
        full_name: name,
        abha_address: normaliseAbha(abha, phone),
        mobile_number: phone,
        password: DEMO_PASSWORD,
        preferred_language: lang,
        age: ageNum,
        gender,
        district: district.trim() || '—',
        initial_record: initialRecord || undefined,
      });
      onSignUpSuccess(res.user);
    } catch (err) {
      if (__DEV__) console.warn('[Sign up] failed:', err);
      if (err instanceof TypeError) setErrorKey('loginNetworkError');
      else if (err instanceof ApiError && err.status === 400) setErrorKey('signUpAccountExists');
      else setErrorKey('signUpFailed');
    } finally {
      setLoading(false);
    }
  };

  const listenText = () => [t('createAccount'), t('createAccountSubtitle'), t('abhaOptionalHint')].join('. ');

  return (
    <NeuPanel radius={radii.xl} style={styles.panel}>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <AppText variant="largeTitle">{t('createAccount')}</AppText>
          <AppText variant="footnote" color="inkMuted">
            {t('createAccountSubtitle')}
          </AppText>
        </View>
        <AudioListenButton text={listenText} />
      </View>

      {errorKey && (
        <Well style={styles.error}>
          <View style={styles.errorRow} accessibilityRole="alert">
            <Icon
              name={errorKey === 'loginNetworkError' ? 'network' : 'error'}
              size={22}
              color={errorKey === 'loginNetworkError' ? colors.warningDeep : colors.dangerDeep}
              active
            />
            <AppText variant="footnote" weight={600} color={errorKey === 'loginNetworkError' ? 'warningDeep' : 'dangerDeep'} style={styles.flex}>
              {t(errorKey)}
            </AppText>
          </View>
        </Well>
      )}

      <TextField
        label={t('fullNameLabel')}
        icon="person"
        value={fullName}
        onChangeText={setFullName}
        placeholder={t('fullNamePlaceholder')}
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
      />

      <TextField
        label={t('mobileNumberLabel')}
        icon="mobile"
        value={mobile}
        onChangeText={setMobile}
        placeholder="9845012345"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={14}
      />

      <TextField
        label={t('ageLabel')}
        icon="calendar"
        value={age}
        onChangeText={(v) => setAge(v.replace(/\D/g, ''))}
        placeholder="42"
        keyboardType="number-pad"
        maxLength={3}
      />

      <View style={styles.group}>
        <AppText variant="eyebrow" color="ink" compact>
          {t('genderLabel')}
        </AppText>
        <SegmentedControl
          accessibilityLabel={t('genderLabel')}
          options={[
            { value: 'male', label: t('genderMale') },
            { value: 'female', label: t('genderFemale') },
            { value: 'other', label: t('genderOther') },
          ]}
          value={gender}
          onChange={setGender}
        />
      </View>

      <TextField
        label={t('districtLabel')}
        icon="building"
        value={district}
        onChangeText={setDistrict}
        placeholder={t('districtPlaceholder')}
        autoCapitalize="words"
      />

      <TextField
        label={t('abhaOptionalLabel')}
        icon="idCard"
        value={abha}
        onChangeText={setAbha}
        placeholder={t('abhaPlaceholder')}
        hint={t('abhaOptionalHint')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Upload reports now (Optional section, can be skipped) */}
      <View style={styles.uploadSection}>
        <View style={styles.uploadHeader}>
          <View style={styles.ocrTagRow}>
            <Icon name="sparkle" size={15} color={colors.primary} active />
            <AppText variant="eyebrow" color="primary">
              Paddle OCR · ABDM
            </AppText>
          </View>
          <AppText variant="subhead" weight={700}>
            {t('uploadReportsNow')}
          </AppText>
          <AppText variant="footnote" color="inkMuted">
            {t('uploadReportsNowSubtitle')}
          </AppText>
        </View>

        {reportFile ? (
          <Well style={styles.attachedWell}>
            <View style={styles.attachedContent}>
              <View style={styles.fileIconBox}>
                <Icon
                  name={reportFile.type.includes('pdf') ? 'document' : 'lab'}
                  size={24}
                  color={colors.primary}
                  active
                />
              </View>
              <View style={styles.flex}>
                <AppText variant="subhead" weight={600} numberOfLines={1}>
                  {reportFile.name}
                </AppText>
                {analyzingReport ? (
                  <View style={styles.analyzingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <AppText variant="footnote" color="primary" weight={600}>
                      {t('uploadingAndReadingOcr')}
                    </AppText>
                  </View>
                ) : initialRecord ? (
                  <View style={styles.previewSnippet}>
                    <Badge label={t('analyzedWithPaddle')} tone="primary" icon="sparkle" />
                    <AppText variant="footnote" weight={600} color="ink">
                      {initialRecord.title}
                    </AppText>
                    {initialRecord.summary_findings && (
                      <AppText variant="footnote" color="inkMuted" numberOfLines={2}>
                        {initialRecord.summary_findings}
                      </AppText>
                    )}
                  </View>
                ) : (
                  <AppText variant="footnote" color="inkMuted">
                    {t('reportAttached')}
                  </AppText>
                )}
                {reportOcrError && (
                  <AppText variant="footnote" color="warningDeep">
                    {reportOcrError}
                  </AppText>
                )}
              </View>
              <SecondaryButton
                label={t('removeAttachment')}
                size="sm"
                onPress={handleRemoveReport}
                disabled={analyzingReport}
              />
            </View>
          </Well>
        ) : (
          <View style={styles.uploadPromptRow}>
            <SecondaryButton
              label={t('selectReportFile')}
              icon="upload"
              tone="primary"
              size="md"
              onPress={handlePickReport}
            />
            <AppText variant="footnote" color="inkMuted">
              {t('skipForNow')}
            </AppText>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={loading ? t('creatingAccount') : t('createAccount')}
          icon="personAdd"
          speech={scripts.auth.signUpSubmit}
          onPress={handleSubmit}
          loading={loading}
        />
        <SecondaryButton
          label={t('haveAccountSignIn')}
          icon="signIn"
          speech={scripts.auth.backToSignIn}
          onPress={onBackToSignIn}
          disabled={loading}
        />
      </View>
    </NeuPanel>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  panel: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  group: {
    gap: spacing.sm,
  },
  error: {
    padding: spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadSection: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  uploadHeader: {
    gap: spacing.xs,
  },
  ocrTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  uploadPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  attachedWell: {
    padding: spacing.md,
  },
  attachedContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  fileIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  previewSnippet: {
    gap: 4,
    marginTop: 4,
    alignItems: 'flex-start',
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
});
