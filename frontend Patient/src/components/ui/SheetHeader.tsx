import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { IconDisc } from './IconDisc';
import type { IconName } from './Icon';
import { Groove } from './Neu';

interface SheetHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Right-hand accessory, e.g. a countdown badge. */
  right?: React.ReactNode;
  onClose?: () => void;
}

/** Sheet header: inset icon disc, serif title, subtitle, raised close disc, groove below. Text is ink (it sits on glass). */
export const SheetHeader: React.FC<SheetHeaderProps> = ({ title, subtitle, icon, right, onClose }) => {
  const { t } = useLanguage();
  return (
    <View>
      <View style={styles.row}>
        {icon && <IconDisc icon={icon} size={40} shape="square" />}
        <View style={styles.text}>
          <AppText variant="title2" weight={700} accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color="inkMuted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right}
        {onClose && <IconButton icon="close" accessibilityLabel={t('close')} onPress={onClose} size={38} />}
      </View>
      <Groove />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: spacing.md,
  },
  text: {
    flex: 1,
  },
});
