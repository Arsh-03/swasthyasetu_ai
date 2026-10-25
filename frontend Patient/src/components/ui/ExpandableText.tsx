import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing, touch } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppText, type AppTextProps } from './AppText';
import { Icon } from './Icon';

interface ExpandableTextProps extends Omit<AppTextProps, 'children' | 'numberOfLines'> {
  children: string;
  /** Lines shown while collapsed. */
  lines?: number;
  /** Start expanded (Style Guide). */
  initiallyExpanded?: boolean;
}

/**
 * No silent truncation: shows up to `lines` lines and a translated "Read more" / "Show less"
 * toggle only when the text is actually longer. Overflow is detected by measuring a hidden full
 * copy against the clamped copy (works on iOS, Android and web; no onTextLayout needed).
 */
export const ExpandableText: React.FC<ExpandableTextProps> = ({ children, lines = 3, initiallyExpanded = false, style, ...textProps }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [fullHeight, setFullHeight] = useState(0);
  const [clampedHeight, setClampedHeight] = useState(0);
  const overflows = fullHeight > clampedHeight + 1 && clampedHeight > 0;

  return (
    <View style={styles.wrap}>
      {/* Hidden full copy, only for measuring */}
      <View style={styles.measure} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        <AppText {...textProps} style={style} onLayout={(e) => setFullHeight(e.nativeEvent.layout.height)}>
          {children}
        </AppText>
      </View>
      <AppText
        {...textProps}
        style={style}
        numberOfLines={expanded ? undefined : lines}
        onLayout={expanded ? undefined : (e) => setClampedHeight(e.nativeEvent.layout.height)}
      >
        {children}
      </AppText>
      {(overflows || expanded) && fullHeight > clampedHeight + 1 ? (
        <Pressable
          onPress={() => setExpanded(!expanded)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? t('showLess') : t('readMore')}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <AppText variant="footnote" weight={700} color="primary" compact>
            {expanded ? t('showLess') : t('readMore')}
          </AppText>
          <Icon name={expanded ? 'chevronLeft' : 'chevronRight'} size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 1,
  },
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    minHeight: touch.compact,
    paddingRight: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
