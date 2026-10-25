import React, { useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, tones, typography, type Tone } from '../../theme/tokens';
import { scriptFontSize, scriptLineHeight } from '../../theme/scripts';
import { useLanguage } from '../../i18n/LanguageContext';
import type { SupportedLanguage } from '../../utils/translations';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { NeuPressable } from './Neu';

export interface ChoiceTileOption<V extends string> {
  value: V;
  label: string;
  icon: IconName;
  tone?: Tone;
}

interface ChoiceTilesProps<V extends string> {
  options: ChoiceTileOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Script of the labels when it differs from the app language (Style Guide). */
  lang?: SupportedLanguage;
}

const GAP = 10;
const ICON = 26;
const ICON_GAP = 6;
const PAD_V = spacing.md;
const PAD_H = spacing.xs;
const VARIANT = 'footnote' as const;
// Same cap AppText uses for Dynamic Type / Android font scale
const MAX_FONT_SCALE = 1.6;

/**
 * A row of equal tiles (icon + label), single choice. Raised at rest, inset when selected.
 * Every tile has the same size whether its label takes one line or two: the icon sits at the
 * top and the label is centred in a fixed two-line area. Labels never truncate; if any label
 * would need three lines at the current width / font scale, the tiles stack vertically.
 */
export function ChoiceTiles<V extends string>({ options, value, onChange, accessibilityLabel, style, lang: langOverride }: ChoiceTilesProps<V>) {
  const { lang: appLang } = useLanguage();
  const lang = langOverride ?? appLang;
  const { fontScale } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  const [lineCounts, setLineCounts] = useState<Record<string, number>>({});

  const line = scriptLineHeight(scriptFontSize(typography[VARIANT].fontSize, lang, VARIANT), lang, true) * Math.min(Math.max(fontScale, 1), MAX_FONT_SCALE);
  const labelBox = Math.ceil(line * 2);
  const tileMinHeight = PAD_V * 2 + ICON + ICON_GAP + labelBox;

  // Width each label gets in the side-by-side layout
  const innerWidth = rowWidth > 0 ? (rowWidth - GAP * (options.length - 1)) / options.length - PAD_H * 2 : 0;
  // Measured at that width in every layout, so switching layout can't flip the decision back
  const stacked = options.some((o) => (lineCounts[`${lang}:${o.label}`] ?? 0) > 2);

  return (
    <View style={style} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
      <View style={stacked ? styles.column : styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
        {options.map((opt) => {
          const selected = value === opt.value;
          const toneIcon = tones[opt.tone ?? 'primary'].icon;
          return (
            <NeuPressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              selected={selected}
              radius={radii.lg}
              haptics="none"
              fillHeight={!stacked}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={opt.label}
              containerStyle={stacked ? undefined : styles.cell}
              style={stacked ? styles.tileStacked : [styles.tile, { minHeight: tileMinHeight }]}
            >
              <Icon name={opt.icon} size={ICON} color={selected ? toneIcon : colors.inkMuted} active={selected} />
              <View style={stacked ? styles.labelStacked : [styles.labelBox, { minHeight: labelBox }]}>
                <AppText
                  variant={VARIANT}
                  weight={selected ? 700 : 600}
                  color={selected ? 'ink' : 'inkMuted'}
                  align={stacked ? 'left' : 'center'}
                  lang={lang}
                  compact
                >
                  {opt.label}
                </AppText>
              </View>
            </NeuPressable>
          );
        })}
      </View>

      {/* Hidden copies at the side-by-side label width (bold, the widest weight) to count lines */}
      {innerWidth > 0 && (
        <View style={styles.measure} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {options.map((opt) => {
            const key = `${lang}:${opt.label}`;
            return (
              <AppText
                key={key}
                variant={VARIANT}
                weight={700}
                align="center"
                lang={lang}
                compact
                style={{ width: innerWidth }}
                onLayout={(e) => {
                  const lines = Math.round(e.nativeEvent.layout.height / line);
                  setLineCounts((prev) => (prev[key] === lines ? prev : { ...prev, [key]: lines }));
                }}
              >
                {opt.label}
              </AppText>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GAP,
  },
  column: {
    gap: GAP,
  },
  cell: {
    flex: 1,
    flexBasis: 0,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: ICON_GAP,
    paddingVertical: PAD_V,
    paddingHorizontal: PAD_H,
  },
  labelBox: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  tileStacked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  labelStacked: {
    flex: 1,
  },
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
  },
});
