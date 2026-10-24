import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppText } from './AppText';
import { BrandMark } from './BrandMark';
import { IconButton } from './IconButton';
import type { IconName } from './Icon';

interface SheetHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Right-hand accessory, e.g. a countdown badge. */
  right?: React.ReactNode;
  onClose?: () => void;
}

/** Doctor modal header: gradient icon tile, bold title, grey subtitle, round close button, hairline below. */
export const SheetHeader: React.FC<SheetHeaderProps> = ({ title, subtitle, icon, right, onClose }) => {
  const { t } = useLanguage();
  return (
    <View style={styles.row}>
      {icon && <BrandMark size={36} icon={icon} />}
      <View style={styles.text}>
        <AppText variant="title2" weight={700} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="tertiary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {onClose && <IconButton icon="close" accessibilityLabel={t('close')} onPress={onClose} size={30} />}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  text: {
    flex: 1,
  },
});
