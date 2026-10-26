import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { patientApi, type PatientUser } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { AppText, NeuPanel, PrimaryButton, SecondaryButton, TextField } from './ui';

/** Sign-in for ASHA / community health workers (ASHA ID or mobile number). */
export const AshaLoginPanel: React.FC<{ onLoginSuccess: (user: PatientUser) => void; onBack: () => void }> = ({ onLoginSuccess, onBack }) => {
  const { t } = useLanguage();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (identifier: string, pass: string) => {
    setBusy(true);
    setError(null);
    try {
      onLoginSuccess(await patientApi.loginAsha(identifier.trim(), pass));
    } catch {
      setError(t('ashaSignInError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <NeuPanel radius={radii.xl} style={styles.panel}>
      <AppText variant="largeTitle">{t('ashaSignInTitle')}</AppText>
      <AppText variant="footnote" color="inkMuted">{t('ashaSignInSubtitle')}</AppText>
      <TextField label={t('ashaIdLabel')} icon="idCard" value={id} onChangeText={setId} autoCapitalize="characters" autoCorrect={false} />
      <TextField label={t('ashaPassword')} icon="key" value={password} onChangeText={setPassword} secureTextEntry />
      {error && <AppText variant="subhead" color="dangerDeep">{error}</AppText>}
      <View style={styles.buttons}>
        <PrimaryButton label={t('signIn')} icon="signIn" loading={busy} onPress={() => void signIn(id, password)} disabled={!id || !password} />
        <SecondaryButton label={t('ashaDemoLogin')} icon="bolt" onPress={() => void signIn('ASHA-HSN-0142', 'password123')} disabled={busy} />
        <SecondaryButton label={t('ashaBackToPatient')} onPress={onBack} />
      </View>
    </NeuPanel>
  );
};

const styles = StyleSheet.create({
  panel: { padding: spacing.lg, gap: spacing.md },
  buttons: { gap: spacing.sm },
});
