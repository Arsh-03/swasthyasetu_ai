import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, tints } from '../theme/tokens';
import { patientApi, type PatientUser } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGE_NAMES, t as translate } from '../utils/translations';
import { GlassSurface } from './glass';
import {
  AppText,
  AudioListenButton,
  Badge,
  BrandMark,
  Icon,
  type IconName,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  StableLabel,
  TextField,
} from './ui';

interface PatientLoginViewProps {
  onLoginSuccess: (user: PatientUser) => void;
}

const DEMO_ABHA = '91-4820-1928-1120@abdm';
const DEMO_MOBILE = '9845012345';

export const PatientLoginView: React.FC<PatientLoginViewProps> = ({ onLoginSuccess }) => {
  const { t, cycleLang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [authMode, setAuthMode] = useState<'abha' | 'mobile'>('abha');
  const [identifier, setIdentifier] = useState(DEMO_ABHA);
  const [otp, setOtp] = useState('123456');
  const [showOtpField, setShowOtpField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!showOtpField) {
      setShowOtpField(true);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      // In demo environment, authenticates via patientApi.loginPatient
      const cleanId = identifier.includes('@') ? DEMO_MOBILE : identifier;
      const res = await patientApi.loginPatient(cleanId, 'password123');
      if (res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = () => {
    setIdentifier(DEMO_ABHA);
    setOtp('123456');
    setShowOtpField(true);
    setErrorMsg(null);
  };

  const trust: { icon: IconName; label: string }[] = [
    { icon: 'lock', label: t('trustOnlyYou') },
    { icon: 'shield', label: t('trustNeverShared') },
    { icon: 'badge', label: t('trustGovtId') },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxxl }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Branding panel (Doctor login's dark left column, stacked on top for mobile) */}
      <View style={styles.brandPanel}>
        <View style={[styles.glow, styles.glowBlue]} />
        <View style={[styles.glow, styles.glowIndigo]} />

        <View style={styles.brandTop}>
          <View style={styles.brandRow}>
            <BrandMark size={44} />
            <View style={styles.brandText}>
              <AppText variant="title2" color="onTint" lang="en" compact>
                {t('appName')}
              </AppText>
              <StableLabel text={(l) => translate(l, 'patientApp')} variant="eyebrow" color="blue" compact />
            </View>
          </View>

          <Pressable
            onPress={cycleLang}
            accessibilityRole="button"
            accessibilityLabel={t('switchLanguage')}
            hitSlop={6}
            style={({ pressed }) => [styles.langPillWrap, pressed && styles.pressed]}
          >
            <GlassSurface material="dark" style={styles.langPill}>
              <Icon name="translate" size={16} color={colors.onTint} />
              <StableLabel text={(l) => LANGUAGE_NAMES[l]} variant="footnote" weight={600} color="onTint" compact />
            </GlassSurface>
          </Pressable>
        </View>

        <View style={styles.brandCopy}>
          <AppText variant="title" color="onTint">
            {t('brandHeadline')}
          </AppText>
          <AppText variant="footnote" color="tertiary">
            {t('brandDescription')}
          </AppText>
        </View>

        <View style={styles.brandFooter}>
          <View style={styles.brandFooterRow}>
            <Icon name="verified" size={16} color={colors.green} />
            <AppText variant="footnote" weight={500} color="gray4" style={styles.flex}>
              {t('brandAbdm')}
            </AppText>
          </View>
          <View style={styles.brandFooterRow}>
            <Icon name="lock" size={16} color={colors.blue} />
            <AppText variant="footnote" weight={500} color="gray4" style={styles.flex}>
              {t('brandDpdp')}
            </AppText>
          </View>
        </View>
      </View>

      {/* Authentication card */}
      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <AppText variant="eyebrow" color="blue" style={styles.flex}>
            {t('patientAuthentication')}
          </AppText>
          <Badge label={t('loginGate')} tone="neutral" />
        </View>

        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <AppText variant="largeTitle">{t('signIn')}</AppText>
            <AppText variant="footnote" color="tertiary">
              {t('signInSubtitle')}
            </AppText>
          </View>
          <AudioListenButton text={() => t('signInSubtitle')} />
        </View>

        {/* Privacy trust safeguards */}
        <View style={styles.trustRow}>
          {trust.map((item) => (
            <View key={item.icon} style={styles.trustItem}>
              <View style={styles.trustTile}>
                <Icon name={item.icon} size={22} color={colors.blue} />
              </View>
              <AppText variant="caption" weight={600} color="secondary" align="center">
                {item.label}
              </AppText>
            </View>
          ))}
        </View>

        {errorMsg && (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Icon name="error" size={18} color={colors.red} />
            <AppText variant="footnote" weight={500} color="red" style={styles.flex}>
              {errorMsg}
            </AppText>
          </View>
        )}

        <SegmentedControl
          options={[
            { value: 'abha', label: t('abhaAddress'), icon: 'badge' },
            { value: 'mobile', label: t('mobileNumber'), icon: 'smartphone' },
          ]}
          value={authMode}
          onChange={(mode) => {
            setAuthMode(mode);
            setIdentifier(mode === 'abha' ? DEMO_ABHA : DEMO_MOBILE);
          }}
        />

        <TextField
          label={authMode === 'abha' ? t('abhaAddressLabel') : t('mobileNumberLabel')}
          icon={authMode === 'abha' ? 'badge' : 'smartphone'}
          value={identifier}
          onChangeText={setIdentifier}
          placeholder={authMode === 'abha' ? t('abhaPlaceholder') : DEMO_MOBILE}
          keyboardType={authMode === 'abha' ? 'email-address' : 'phone-pad'}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {showOtpField && (
          <TextField
            label={t('otpLabel')}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            hint={t('otpDemoHint')}
            otp
          />
        )}

        <View style={styles.actions}>
          <PrimaryButton
            label={loading ? t('signingIn') : showOtpField ? t('verifyAndSignIn') : t('continueWithAbha')}
            icon="login"
            onPress={handleContinue}
            loading={loading}
          />
          <SecondaryButton label={t('demoLogin')} icon="bolt" onPress={handleQuickDemoFill} />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.gutter,
    gap: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  brandPanel: {
    backgroundColor: colors.dark,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    gap: spacing.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  glow: {
    position: 'absolute',
    borderRadius: 9999,
  },
  glowBlue: {
    width: 260,
    height: 260,
    top: -110,
    right: -90,
    backgroundColor: 'rgba(0, 122, 255, 0.22)',
  },
  glowIndigo: {
    width: 220,
    height: 220,
    bottom: -110,
    left: -80,
    backgroundColor: 'rgba(88, 86, 214, 0.18)',
  },
  brandTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 1,
  },
  brandText: {
    flexShrink: 1,
  },
  langPillWrap: {
    borderRadius: radii.pill,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  brandCopy: {
    gap: spacing.sm,
  },
  brandFooter: {
    gap: 10,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  brandFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.lg,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  trustRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  trustTile: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: tints.blue,
    borderWidth: 1,
    borderColor: tints.blueRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: tints.red,
    borderWidth: 1,
    borderColor: tints.redRing,
  },
  actions: {
    gap: 10,
    paddingTop: spacing.xs,
  },
});
