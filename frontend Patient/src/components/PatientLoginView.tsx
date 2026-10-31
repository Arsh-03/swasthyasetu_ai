import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../theme/tokens';
import { patientApi, type PatientUser } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGE_NAMES, t as translate, type SupportedLanguage } from '../utils/translations';
import { LoginHero } from './illustrations';
import { PatientSignUpView } from './PatientSignUpView';
import { AshaLoginPanel } from './AshaLoginPanel';
import {
  AppText,
  AudioListenButton,
  Badge,
  BrandMark,
  Icon,
  IconDisc,
  type IconName,
  NeuPanel,
  NeuPressable,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  StableLabel,
  Stepper,
  TextField,
  Well,
} from './ui';
import { useScripts } from '../speech';

interface PatientLoginViewProps {
  onLoginSuccess: (user: PatientUser) => void;
  onBrandLongPress?: () => void;
}

const DEMO_ABHA = '91-4820-1928-1120@abdm';
const DEMO_MOBILE = '9845012345';

/** Which sign-in failure to show. Raw network / server text is never shown to the patient. */
export type SignInErrorKind = 'network' | 'rejected';

/**
 * `fetch` rejects with a TypeError when no response arrives (offline, server down, DNS):
 * that is a connection problem. Anything else means the server answered and refused
 * (or sent an unreadable error page). Server `detail` text is English-only, so it is not shown.
 */
const classifySignInError = (err: unknown): SignInErrorKind => (err instanceof TypeError ? 'network' : 'rejected');

const ERROR_LOOK: Record<SignInErrorKind, { icon: IconName; color: 'warningDeep' | 'dangerDeep'; key: 'loginNetworkError' | 'loginRejected' }> = {
  // Not the patient's fault: warning tone + signal icon
  network: { icon: 'network', color: 'warningDeep', key: 'loginNetworkError' },
  rejected: { icon: 'error', color: 'dangerDeep', key: 'loginRejected' },
};

/** Sign-in alert in a soft inset well. `lang` lets the dev Style Guide render any language. */
export const SignInError: React.FC<{ kind: SignInErrorKind; lang?: SupportedLanguage }> = ({ kind, lang }) => {
  const { lang: appLang } = useLanguage();
  const look = ERROR_LOOK[kind];
  const l = lang ?? appLang;
  return (
    <Well style={styles.error}>
      <View style={styles.errorRow} accessibilityRole="alert">
        <Icon name={look.icon} size={22} color={colors[look.color]} active />
        <AppText variant="footnote" weight={600} color={look.color} lang={l} style={styles.flex}>
          {translate(l, look.key)}
        </AppText>
      </View>
    </Well>
  );
};

/**
 * Sign-in (visual-first): illustration + one headline, trust shown as icon discs, the
 * two-step flow shown as a stepper, everything else spoken by the Listen button.
 * Logic (ABHA / mobile, OTP step, demo fill, patientApi.loginPatient) is unchanged.
 */
export const PatientLoginView: React.FC<PatientLoginViewProps> = ({ onLoginSuccess, onBrandLongPress }) => {
  const { lang, t, cycleLang } = useLanguage();
  const scripts = useScripts();
  const insets = useSafeAreaInsets();
  const [authMode, setAuthMode] = useState<'abha' | 'mobile'>('abha');
  const [identifier, setIdentifier] = useState(DEMO_ABHA);
  const [otp, setOtp] = useState('123456');
  const [showOtpField, setShowOtpField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorKind, setErrorKind] = useState<SignInErrorKind | null>(null);
  const [mode, setMode] = useState<'signIn' | 'signUp' | 'asha'>('signIn');

  const handleContinue = async () => {
    if (!showOtpField) {
      setShowOtpField(true);
      return;
    }

    setLoading(true);
    setErrorKind(null);
    try {
      // Backend matches ABHA address or mobile number. OTP is demo-only, so the demo password is sent.
      const res = await patientApi.loginPatient(identifier.trim(), 'password123');
      if (res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      if (__DEV__) console.warn('[Sign in] failed:', err);
      setErrorKind(classifySignInError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = () => {
    setIdentifier(DEMO_ABHA);
    setOtp('123456');
    setShowOtpField(true);
    setErrorKind(null);
  };

  const trust: { icon: IconName; label: string }[] = [
    { icon: 'lock', label: t('trustOnlyYou') },
    { icon: 'shield', label: t('trustNeverShared') },
    { icon: 'idCard', label: t('trustGovtId') },
  ];

  // Everything the screen no longer prints is spoken instead
  const listenText = () =>
    [t('brandHeadline'), t('brandDescription'), t('signIn'), t('signInSubtitle'), ...trust.map((x) => x.label), t('brandAbdm'), t('brandDpdp')].join('. ');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxxl }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Brand + language */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <BrandMark size={44} onLongPress={onBrandLongPress} />
          <View style={styles.brandText}>
            <AppText variant="title2" lang="en" compact>
              {t('appName')}
            </AppText>
            <StableLabel text={(l) => translate(l, 'patientApp')} variant="caption" color="inkMuted" compact />
          </View>
        </View>
        <NeuPressable
          onPress={cycleLang}
          radius={radii.md}
          compact
          haptics="selection"
          hitSlop={4}
          accessibilityLabel={`${t('switchLanguage')}: ${LANGUAGE_NAMES[lang]}`}
          style={styles.langPill}
        >
          <Icon name="translate" size={18} color={colors.primary} active />
          <StableLabel text={(l) => LANGUAGE_NAMES[l]} variant="subhead" weight={600} compact />
        </NeuPressable>
      </View>

      {/* Hero: illustration first, one headline, two trust marks */}
      <View style={styles.hero}>
        <LoginHero width={200} />
        <AppText variant="title" align="center">
          {t('brandHeadline')}
        </AppText>
        <View style={styles.heroBadges}>
          <Badge label={t('badgeAbdm')} tone="gold" icon="verified" size="md" solid />
          <Badge label={t('badgeDpdp')} tone="primary" icon="shieldCheck" size="md" solid />
        </View>
      </View>

      {mode === 'asha' && <AshaLoginPanel onLoginSuccess={onLoginSuccess} onBack={() => setMode('signIn')} />}

      {mode === 'signUp' && (
        <PatientSignUpView
          onSignUpSuccess={onLoginSuccess}
          onBackToSignIn={() => {
            setMode('signIn');
            setErrorKind(null);
          }}
        />
      )}

      {/* Sign-in panel */}
      {mode === 'signIn' && (
        <NeuPanel radius={radii.xl} style={styles.panel}>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <AppText variant="largeTitle">{t('signIn')}</AppText>
              <AppText variant="footnote" color="inkMuted">
                {t('signInSubtitle')}
              </AppText>
            </View>
            <AudioListenButton text={listenText} />
          </View>

          <Stepper
            accessibilityLabel={t('signInSteps')}
            current={showOtpField ? 1 : 0}
            steps={[
              { icon: authMode === 'abha' ? 'idCard' : 'mobile', label: t('stepId') },
              { icon: 'key', label: t('stepOtp') },
            ]}
          />

          {/* Privacy trust safeguards (informational → inset discs) */}
          <View style={styles.trustRow}>
            {trust.map((item) => (
              <View key={item.icon} style={styles.trustItem}>
                <IconDisc icon={item.icon} size={52} variant="inset" />
                <AppText variant="caption" weight={600} color="inkMuted" align="center">
                  {item.label}
                </AppText>
              </View>
            ))}
          </View>

          {errorKind && <SignInError kind={errorKind} />}

          <SegmentedControl
            options={[
              { value: 'abha', label: t('segAbha'), icon: 'idCard' },
              { value: 'mobile', label: t('segMobile'), icon: 'mobile' },
            ]}
            value={authMode}
            onChange={(mode) => {
              setAuthMode(mode);
              setIdentifier(mode === 'abha' ? DEMO_ABHA : DEMO_MOBILE);
            }}
          />

          <TextField
            label={authMode === 'abha' ? t('abhaAddressLabel') : t('mobileNumberLabel')}
            icon={authMode === 'abha' ? 'idCard' : 'mobile'}
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
              icon="key"
              otp
            />
          )}

          <View style={styles.actions}>
            <PrimaryButton
              label={loading ? t('signingIn') : showOtpField ? t('verifyAndSignIn') : t('continueWithAbha')}
              icon="signIn"
              speech={showOtpField ? scripts.auth.verifyAndSignIn : scripts.auth.continueWithAbha}
              onPress={handleContinue}
              loading={loading}
            />
            <SecondaryButton label={t('demoLogin')} icon="bolt" speech={scripts.auth.demoFill} onPress={handleQuickDemoFill} />
            <SecondaryButton
              label={t('newHereCreateAccount')}
              icon="personAdd"
              speech={scripts.auth.createAccount}
              onPress={() => {
                setMode('signUp');
                setErrorKind(null);
              }}
              disabled={loading}
            />
            <SecondaryButton
              label={t('ashaSignInLink')}
              icon="people"
              speech={scripts.auth.ashaSignIn}
              onPress={() => {
                setMode('asha');
                setErrorKind(null);
              }}
              disabled={loading}
            />
          </View>
        </NeuPanel>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Transparent: the ambient background (App.tsx) shows through
  },
  content: {
    paddingHorizontal: spacing.gutter,
    gap: spacing.xl,
  },
  flex: {
    flex: 1,
  },
  topBar: {
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
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
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
  trustRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  error: {
    padding: spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
});
