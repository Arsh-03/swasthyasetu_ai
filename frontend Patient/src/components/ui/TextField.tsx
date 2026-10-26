import React, { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radii, spacing, touch } from '../../theme/tokens';
import { fontFamilyFor, SCRIPT_METRICS } from '../../theme/fonts';
import { useFontsLoaded } from '../../theme/FontsProvider';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Required: leading icon for instant recognition. */
  icon: IconName;
  hint?: string;
  /** Large centred digits for OTP entry. */
  otp?: boolean;
}

/**
 * Clean text field: pure white fill, 1px input border (3.62:1 vs white, 3.31:1 vs base),
 * 2px primary focus ring, visible label above, leading icon.
 */
export const TextField: React.FC<TextFieldProps> = ({
  label,
  icon,
  hint,
  otp = false,
  multiline,
  onFocus,
  onBlur,
  ...rest
}) => {
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
      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          focused ? styles.focused : styles.unfocused,
        ]}
      >
        <Icon
          name={icon}
          size={20}
          color={focused ? colors.primary : colors.inkInset}
          active={focused}
        />
        <TextInput
          {...rest}
          multiline={multiline}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={colors.inkMuted}
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
            fontsLoaded[fontLang]
              ? { fontFamily: fontFamilyFor(fontLang, otp ? 700 : 500) }
              : { fontWeight: otp ? '700' : '500' },
            { fontSize },
            multiline && { lineHeight: Math.ceil(fontSize * m.lineHeight), textAlignVertical: 'top' },
            otp && styles.otp,
          ]}
        />
      </View>
      {hint ? (
        <AppText variant="caption" color="inkMuted" align={otp ? 'center' : undefined}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
};

/** Neutral alias for Field */
export const Field = TextField;

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
    backgroundColor: colors.card,
  },
  unfocused: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  focused: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    minHeight: 96,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    paddingVertical: Platform.OS === 'android' ? 8 : 12,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  otp: {
    textAlign: 'center',
    letterSpacing: 8,
    marginRight: 20,
  },
});
