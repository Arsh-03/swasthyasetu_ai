import React, { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radii, spacing, touch } from '../../theme/tokens';
import { fontFamilyFor, SCRIPT_METRICS } from '../../theme/fonts';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon?: IconName;
  hint?: string;
  /** Large centred digits for OTP entry. */
  otp?: boolean;
}

/**
 * Doctor login input: `h-11 rounded-xl bg-[#F2F2F7] border-black/5`, white with a
 * blue border on focus, leading icon in #8E8E93.
 */
export const TextField: React.FC<TextFieldProps> = ({ label, icon, hint, otp = false, multiline, onFocus, onBlur, ...rest }) => {
  const { lang } = useLanguage();
  const [focused, setFocused] = useState(false);
  const m = SCRIPT_METRICS[lang];
  const fontSize = otp ? 20 : 15 * m.sizeScale;

  return (
    <View style={styles.wrap}>
      <AppText variant="eyebrow" color="label" compact>
        {label}
      </AppText>
      <View style={[styles.field, multiline && styles.fieldMultiline, focused && styles.fieldFocused]}>
        {icon && !otp && <Icon name={icon} size={18} color={colors.tertiary} />}
        <TextInput
          {...rest}
          multiline={multiline}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={colors.tertiary}
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
            {
              fontFamily: fontFamilyFor(otp ? 'en' : lang, otp ? 700 : 500),
              fontSize,
            },
            multiline && { lineHeight: Math.ceil(fontSize * m.lineHeight), textAlignVertical: 'top' },
            otp && styles.otp,
          ]}
        />
      </View>
      {hint ? (
        <AppText variant="caption" color="tertiary" align={otp ? 'center' : undefined}>
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
    minHeight: touch.min,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.gray6,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    minHeight: 88,
  },
  fieldFocused: {
    backgroundColor: colors.card,
    borderColor: colors.blue,
  },
  input: {
    flex: 1,
    color: colors.label,
    paddingVertical: Platform.OS === 'android' ? 8 : 12,
    // Remove the browser focus outline; the border shows focus instead
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  otp: {
    textAlign: 'center',
    letterSpacing: 8,
  },
});
