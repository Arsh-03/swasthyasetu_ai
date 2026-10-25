import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing, touch } from '../../theme/tokens';
import { AppText } from './AppText';
import { IconDisc } from './IconDisc';
import { Groove } from './Neu';
import { Icon, type IconName } from './Icon';

interface NavBarProps {
  backLabel: string;
  onBack: () => void;
  right?: React.ReactNode;
}

/** iOS back row ("‹ Home") with an optional trailing action. */
export const NavBar: React.FC<NavBarProps> = ({ backLabel, onBack, right }) => (
  <View style={styles.navBar}>
    <Pressable
      onPress={onBack}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={backLabel}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Icon name="chevronLeft" size={28} color={colors.primary} />
      <AppText variant="body" color="primary" compact numberOfLines={1}>
        {backLabel}
      </AppText>
    </Pressable>
    {right}
  </View>
);

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Informational icon, shown on an inset disc. */
  icon?: IconName;
  /** Badge(s) next to the title (e.g. "FHIR R4 Encrypted"). */
  accessory?: React.ReactNode;
}

/** Large serif title block with a groove below. */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, icon, accessory }) => (
  <View style={styles.header}>
    <View style={styles.titleRow}>
      {icon && <IconDisc icon={icon} size={46} shape="square" />}
      <View style={styles.titleCol}>
        <AppText variant="largeTitle" accessibilityRole="header">
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
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.compact,
    paddingRight: spacing.sm,
    marginLeft: -spacing.sm,
  },
  pressed: {
    opacity: 0.5,
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
