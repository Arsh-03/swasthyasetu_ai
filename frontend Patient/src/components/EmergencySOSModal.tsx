import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { GlassSheet } from './glass';
import { AppText, CriticalButton, EmbossedIcon, SecondaryButton } from './ui';
import { useScripts } from '../speech';

interface EmergencySOSModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EmergencySOSModal: React.FC<EmergencySOSModalProps> = ({ visible, onClose }) => {
  const { t } = useLanguage();
  const scripts = useScripts();

  const dial = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {
      // No phone dialer available (e.g. desktop browser)
    });
  };

  return (
    <GlassSheet visible={visible} onClose={onClose} closeOnBackdrop placement="center" strongScrim>
      <View style={styles.body}>
        <EmbossedIcon icon="emergency" size={56} color={colors.dangerDeep} />

        <View style={styles.text}>
          <AppText variant="title" color="dangerDeep" align="center" accessibilityRole="header" speech={scripts.sos.title}>
            {t('emergencyTitle')}
          </AppText>
          <AppText variant="subhead" weight={600} align="center">
            {t('emergencySubtitle')}
          </AppText>
          <AppText variant="footnote" color="inkMuted" align="center" style={styles.desc}>
            {t('emergencyDescription')}
          </AppText>
        </View>

        <View style={styles.buttons}>
          <CriticalButton tone="danger" label={t('dial108')} icon="call" onPress={() => dial('108')} speech={scripts.sos.dial108} />
          <CriticalButton tone="danger" label={t('dial112')} icon="emergency" onPress={() => dial('112')} speech={scripts.sos.dial112} />
          <SecondaryButton label={t('cancel')} tone="primary" onPress={onClose} speech={scripts.sos.cancel} />
        </View>
      </View>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  text: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  desc: {
    marginTop: spacing.xs,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: 10,
  },
});
