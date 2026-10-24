import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing, type Tone } from '../../theme/tokens';
import { AppText } from './AppText';
import { IconTile } from './Card';
import type { IconName } from './Icon';

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: Tone;
  /** Badges / meta rendered under the subtitle. */
  children?: React.ReactNode;
  /** Right side (button, badge, chevron). */
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** Inset-grouped list row: tinted icon tile, title + subtitle, trailing accessory. */
export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  icon,
  iconTone = 'neutral',
  children,
  trailing,
  onPress,
  accessibilityLabel,
}) => {
  const body = (
    <>
      {icon && <IconTile icon={icon} tone={iconTone} size={40} />}
      <View style={styles.text}>
        <AppText variant="body" weight={600}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="secondary">
            {subtitle}
          </AppText>
        ) : null}
        {children}
      </View>
      {trailing}
    </>
  );

  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
};

/** Left inset for a Divider that lines up with the row's text column. */
export const LIST_ROW_TEXT_INSET = spacing.lg + 40 + 14;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 14,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    backgroundColor: colors.cardMuted,
  },
});
