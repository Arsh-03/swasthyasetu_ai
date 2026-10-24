import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { GlassSheet } from './glass';
import { AppText, DestructiveButton, IconTile, SecondaryButton } from './ui';

interface EmergencySOSModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EmergencySOSModal: React.FC<EmergencySOSModalProps> = ({ visible, onClose }) => {
  const { t } = useLanguage();

  const dial = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {
      // No phone dialer available (e.g. desktop browser)
    });
  };

  return (
    <GlassSheet visible={visible} onClose={onClose} closeOnBackdrop placement="center" strongScrim>
      <View style={styles.body}>
        <IconTile icon="emergency" tone="red" size={68} />

        <View style={styles.text}>
          <AppText variant="title" color="red" align="center" accessibilityRole="header">
            {t('emergencyTitle')}
          </AppText>
          <AppText variant="subhead" weight={600} align="center">
            {t('emergencySubtitle')}
          </AppText>
          <AppText variant="footnote" color="secondary" align="center" style={styles.desc}>
            {t('emergencyDescription')}
          </AppText>
        </View>

        <View style={styles.buttons}>
          <DestructiveButton variant="filled" label={t('dial108')} icon="call" onPress={() => dial('108')} />
          <SecondaryButton label={t('dial112')} icon="emergency" onPress={() => dial('112')} />
          <SecondaryButton label={t('cancel')} tone="blue" onPress={onClose} />
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
