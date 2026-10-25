import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { typography } from '../../theme/tokens';
import { scriptFontSize, scriptLineHeight } from '../../theme/scripts';
import { useLanguage } from '../../i18n/LanguageContext';
import { LANGUAGES, type SupportedLanguage } from '../../utils/translations';
import { AppText, type AppTextProps } from './AppText';

interface StableLabelProps extends Omit<AppTextProps, 'children' | 'lang'> {
  text: (lang: SupportedLanguage) => string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * StableLabel: every language's version is
 * laid out, only the active one is visible, so the label is always as wide as
 * its longest translation and the toolbar never shifts when the language changes.
 * Inactive copies are collapsed to zero height (they still count for width) and hidden
 * from screen readers.
 */
export const StableLabel: React.FC<StableLabelProps> = ({ text, containerStyle, numberOfLines = 1, ...textProps }) => {
  const { lang } = useLanguage();
  // Reserve the tallest script's line height as well, so the label keeps its height too
  const variant = textProps.variant ?? 'body';
  const { fontSize } = typography[variant];
  const minHeight = Math.max(
    ...LANGUAGES.map((l) => scriptLineHeight(scriptFontSize(fontSize, l, variant), l, !!textProps.compact) * numberOfLines)
  );
  return (
    <View style={[styles.stack, { minHeight }, containerStyle]}>
      {LANGUAGES.map((l) => {
        const active = l === lang;
        return (
          <View
            key={l}
            style={active ? undefined : styles.ghost}
            aria-hidden={!active}
            accessibilityElementsHidden={!active}
            importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
          >
            <AppText {...textProps} lang={l} numberOfLines={numberOfLines}>
              {text(l)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  stack: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  ghost: {
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
});
