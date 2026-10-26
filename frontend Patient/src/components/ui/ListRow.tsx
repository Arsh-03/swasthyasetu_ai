import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing, type Domain, type Tone } from '../../theme/tokens';
import { AppText } from './AppText';
import { IconTile } from './IconTile';
import type { IconName } from './Icon';

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: Tone;
  domain?: Domain;
  /** Badges / meta rendered under the subtitle. */
  children?: React.ReactNode;
  /** Right side (button, badge, chevron). */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Selected row: ice tint + 3px primary accent bar. */
  selected?: boolean;
  accessibilityLabel?: string;
}

/**
 * Mobile list row (min 56px height).
 * Hairline dividers separate rows. Selected row = ice tint + 3px primary accent bar.
 */
export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  icon,
  iconTone = 'primary',
  domain,
  children,
  trailing,
  onPress,
  selected = false,
  accessibilityLabel,
}) => {
  const content = (
    <>
      {icon && <IconTile icon={icon} domain={domain} tone={iconTone} size={38} />}
      <View style={styles.text}>
        <AppText variant="body" weight={600} color="ink" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="inkMuted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
        {children}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, selected && styles.selected]}>
        {selected && <View style={styles.accentBar} />}
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.row,
        selected && styles.selected,
        pressed && !selected && styles.pressed,
      ]}
    >
      {selected && <View style={styles.accentBar} />}
      {content}
    </Pressable>
  );
};

export const LIST_ROW_TEXT_INSET = spacing.md + 38 + 12;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 12,
    position: 'relative',
    backgroundColor: colors.card,
  },
  selected: {
    backgroundColor: colors.ice,
  },
  pressed: {
    backgroundColor: 'rgba(31, 58, 76, 0.04)',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    backgroundColor: colors.primary,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  trailing: {
    alignSelf: 'center',
    flexShrink: 0,
  },
});
