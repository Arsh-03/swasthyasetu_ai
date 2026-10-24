import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, typography, type TypeVariant } from '../../theme/tokens';
import { fontFamilyFor, MONO_FAMILY, SCRIPT_METRICS, type FontWeight } from '../../theme/fonts';
import { useLanguage } from '../../i18n/LanguageContext';
import type { SupportedLanguage } from '../../utils/translations';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  weight?: FontWeight;
  color?: keyof typeof colors;
  align?: TextStyle['textAlign'];
  /** Render in a specific script regardless of the app language (used by StableLabel). */
  lang?: SupportedLanguage;
  /** Tighter Latin line-height for single-line UI labels. Kannada / Hindi keep their safe line-height. */
  compact?: boolean;
}

/**
 * Text that follows the Doctor portal's multilingual rules: picks Inter,
 * Noto Sans Kannada or Noto Sans Devanagari from the active language and
 * scales size / line-height so matras and conjuncts never clip.
 */
export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  weight,
  color = 'label',
  align,
  lang: langOverride,
  compact = false,
  style,
  children,
  ...rest
}) => {
  const { lang: appLang } = useLanguage();
  const lang = langOverride ?? appLang;
  const spec = typography[variant];

  let textStyle: TextStyle;
  if (spec.mono) {
    textStyle = { fontFamily: MONO_FAMILY, fontSize: spec.fontSize, fontWeight: '500' };
  } else {
    const metrics = SCRIPT_METRICS[lang];
    const fontSize = Math.round(spec.fontSize * metrics.sizeScale * 10) / 10;
    const lineHeight = Math.ceil(fontSize * (compact ? metrics.compactLineHeight : metrics.lineHeight));
    textStyle = {
      fontFamily: fontFamilyFor(lang, weight ?? spec.weight),
      fontSize,
      lineHeight,
      // Letter-spacing and uppercase only make sense for Latin script
      letterSpacing: lang === 'en' ? spec.letterSpacing : undefined,
      textTransform: lang === 'en' && spec.uppercase ? 'uppercase' : undefined,
    };
  }

  return (
    <Text style={[textStyle, { color: colors[color], textAlign: align }, style]} maxFontSizeMultiplier={1.6} {...rest}>
      {children}
    </Text>
  );
};
