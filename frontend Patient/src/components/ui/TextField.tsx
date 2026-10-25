import React, { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, neu, radii, spacing, touch } from '../../theme/tokens';
import { fontFamilyFor, SCRIPT_METRICS } from '../../theme/fonts';
import { useFontsLoaded } from '../../theme/FontsProvider';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { NeuInset } from './Neu';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Required: the leading icon keeps the field identifiable even where the inset edge is subtle. */
  icon: IconName;
  hint?: string;
  /** Large centred digits for OTP entry. */
  otp?: boolean;
}

/**
 * Input / OTP / text area: a clearly pressed-in STRONG inset well. Focus adds a 2px primary
 * ring and a duotone primary icon. Visible label above, placeholder inside, text ≥ 4.5:1.
 */
export const TextField: React.FC<TextFieldProps> = ({ label, icon, hint, otp = false, multiline, onFocus, onBlur, ...rest }) => {
  const { lang } = useLanguage();
  const fontsLoaded = useFontsLoaded();
  const [focused, setFocused] = useState(false);
  const m = SCRIPT_METRICS[lang];
  const fontSize = otp ? 22 : 16 * m.sizeScale;
  const fontLang = otp ? 'en' : lang;

  return (
    <View style={styles.wrap}>
      <AppText variant="eyebrow" color="ink" compact>
        {label}
      </AppText>
      <NeuInset radius={radii.md} focused={focused} style={[styles.field, multiline && styles.fieldMultiline]}>
        <Icon name={icon} size={20} color={focused ? colors.primary : colors.inkInset} active={focused} surface={neu.inset.strong.fill[0]} />
        <TextInput
          {...rest}
          multiline={multiline}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={colors.inkInset}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            fontsLoaded[fontLang] ? { fontFamily: fontFamilyFor(fontLang, otp ? 700 : 500) } : { fontWeight: otp ? '700' : '500' },
            { fontSize },
            multiline && { lineHeight: Math.ceil(fontSize * m.lineHeight), textAlignVertical: 'top' },
            otp && styles.otp,
          ]}
        />
      </NeuInset>
      {hint ? (
        <AppText variant="caption" color="inkMuted" align={otp ? 'center' : undefined}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: touch.min + 4,
    paddingHorizontal: 14,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    minHeight: 96,
  },
  input: {
    flex: 1,
    // Inputs have an intrinsic width on web; without this a wide OTP value squeezes the leading icon
    minWidth: 0,
    color: colors.ink,
    paddingVertical: Platform.OS === 'android' ? 8 : 12,
    // Remove the browser focus outline; the ring shows focus instead
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  otp: {
    textAlign: 'center',
    letterSpacing: 8,
    // Keep digits optically centred despite the leading icon
    marginRight: 20,
  },
});
