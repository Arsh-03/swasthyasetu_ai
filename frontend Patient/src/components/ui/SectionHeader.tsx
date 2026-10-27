import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, domains, spacing, type Domain } from '../../theme/tokens';
import { AppText } from './AppText';
import { Badge } from './Badge';
import { Icon, type IconName } from './Icon';
import { Speakable, type SpeechSource } from '../../speech/Speakable';
import { useScripts } from '../../speech/scripts';

interface SectionHeaderProps {
  title: string;
  /** Section icon */
  icon?: IconName;
  /** Domain color orientation */
  domain?: Domain;
  /** Count pill, e.g. "4 Active" */
  count?: number;
  right?: React.ReactNode;
  action?: React.ReactNode;
  /** Spoken on double tap (default: the title and the count). */
  speech?: SpeechSource;
}

/**
 * Compact section header: icon + title + count + optional action.
 * Standard across all screens.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  domain,
  count,
  right,
  action,
  speech,
}) => {
  const scripts = useScripts();
  const iconColor = domain ? domains[domain].deep : colors.primary;
  const trailingAction = action ?? right;
  const spoken = speech ?? (count !== undefined ? () => scripts.common.count(title, count) : undefined);

  return (
    <View style={styles.row} accessibilityRole="header">
      {/* Title, icon and count speak as one; the action (e.g. See all) speaks for itself */}
      <Speakable atomic speech={spoken} style={styles.left}>
          {icon && <Icon name={icon} size={18} color={iconColor} active />}
          <AppText variant="headline" weight={700} color="ink" style={styles.title}>
            {title}
          </AppText>
          {count !== undefined && (
            <Badge label={String(count)} domain={domain} tone={domain ? undefined : 'primary'} size="sm" />
          )}
      </Speakable>
      {trailingAction}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  title: {
    flexShrink: 1,
  },
});
