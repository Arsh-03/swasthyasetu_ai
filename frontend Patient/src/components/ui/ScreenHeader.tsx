import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Speakable } from '../../speech/Speakable';
import { SCRIPTS } from '../../speech/scripts';
import { useLanguage } from '../../i18n/LanguageContext';
import { colors, spacing, touch } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { IconDisc } from './IconDisc';
import { Groove } from './Neu';

interface NavBarProps {
  backLabel: string;
  onBack: () => void;
  right?: React.ReactNode;
}

/** iOS back row ("‹ Home") with an optional trailing action. */
export const NavBar: React.FC<NavBarProps> = ({ backLabel, onBack, right }) => (
  <View style={styles.navBar}>
    <BackSpeakable
      to={backLabel}
      onPress={onBack}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={backLabel}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Icon name="chevronLeft" size={24} color={colors.primary} />
      <AppText variant="body" color="primary" compact numberOfLines={1}>
        {backLabel}
      </AppText>
    </BackSpeakable>
    {right}
  </View>
);

/** Back button: "Go back to Home." on double tap. */
const BackSpeakable: React.FC<React.ComponentProps<typeof Speakable> & { to?: string }> = ({ to, ...props }) => {
  const { lang } = useLanguage();
  return <Speakable atomic speech={() => SCRIPTS[lang].common.back(to)} {...props} />;
};

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
}

/**
 * Compact page header: 48-56px header bar with title and back arrow (replaces giant titles).
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, onBack, backLabel, right }) => (
  <View style={styles.pageHeader}>
    {onBack ? (
      <BackSpeakable
        to={backLabel}
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={backLabel ?? 'Back'}
        style={styles.back}
      >
        <Icon name="chevronLeft" size={24} color={colors.ink} />
        {backLabel ? (
          <AppText variant="subhead" weight={500} color="primary" compact>
            {backLabel}
          </AppText>
        ) : null}
      </BackSpeakable>
    ) : (
      <View style={{ width: 28 }} />
    )}
    <AppText variant="headline" weight={700} color="ink" numberOfLines={1} align="center" style={styles.pageHeaderTitle}>
      {title}
    </AppText>
    <View style={styles.pageHeaderRight}>{right ?? <View style={{ width: 28 }} />}</View>
  </View>
);

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  accessory?: React.ReactNode;
}

/** Clean title block with hairline divider. */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, icon, accessory }) => (
  <View style={styles.header}>
    <View style={styles.titleRow}>
      {icon && <IconDisc icon={icon} size={40} shape="square" />}
      <View style={styles.titleCol}>
        <AppText variant="title" weight={700} color="ink" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="inkMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
    {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
    <Groove />
  </View>
);

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touch.compact,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  pageHeaderTitle: {
    flex: 1,
  },
  pageHeaderRight: {
    minWidth: 28,
    alignItems: 'flex-end',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.compact,
    gap: 4,
  },
  pressed: {
    opacity: 0.5,
  },
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  accessory: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
