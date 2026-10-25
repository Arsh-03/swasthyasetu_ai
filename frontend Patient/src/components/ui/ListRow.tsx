import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radii, spacing, type Tone } from '../../theme/tokens';
import { AppText } from './AppText';
import { IconDisc } from './IconDisc';
import type { IconName } from './Icon';
import { NeuPressable } from './Neu';

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
  /** Selected row: inset + primary accent bar. */
  selected?: boolean;
  accessibilityLabel?: string;
}

/**
 * Row inside a NeuList (panel or tray). Rows carry no shadow of their own (Android perf);
 * grooves separate them. A tappable row presses to inset; selected = inset + accent bar.
 * Leading icon = inset IconDisc (informational).
 */
export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  icon,
  iconTone = 'primary',
  children,
  trailing,
  onPress,
  selected = false,
  accessibilityLabel,
}) => {
  const body = (
    <>
      {icon && <IconDisc icon={icon} tone={iconTone} size={40} />}
      <View style={styles.text}>
        <AppText variant="body" weight={600}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="inkMuted">
            {subtitle}
          </AppText>
        ) : null}
        {children}
      </View>
      {/* Trailing control keeps its own height, centred, however tall the text column gets */}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <NeuPressable
      onPress={onPress}
      flatAtRest
      strength="soft"
      radius={radii.md}
      selected={selected}
      accentBar
      haptics="selection"
      accessibilityLabel={accessibilityLabel ?? title}
      style={styles.row}
    >
      {body}
    </NeuPressable>
  );
};

/** Left inset for a Groove that lines up with the row's text column. */
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
  trailing: {
    alignSelf: 'center',
    flexShrink: 0,
  },
});
