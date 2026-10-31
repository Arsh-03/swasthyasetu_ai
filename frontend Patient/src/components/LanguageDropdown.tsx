import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { Icon } from './ui/Icon';
import { LANGUAGE_DROPDOWN_OPTIONS, type SupportedLanguage } from '../utils/translations';
import { AppText } from './ui/AppText';
import { haptic } from '../utils/haptics';

interface LanguageDropdownProps {
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

/**
 * Language switcher dropdown matching the Doctor portal.
 * On Web: uses the native <select> styled identically to the doctor portal.
 * On Native (iOS/Android): uses a styled picker with modal dropdown menu.
 */
export const LanguageDropdown: React.FC<LanguageDropdownProps> = ({ style, compact = false }) => {
  const { lang, setLang, t } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const currentOption = LANGUAGE_DROPDOWN_OPTIONS.find((o) => o.id === lang) ?? LANGUAGE_DROPDOWN_OPTIONS[0];

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]}>
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            height: 40,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 12,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <Icon name="translate" size={18} color={colors.inkMuted} />
          </span>
          <select
            value={lang}
            onChange={(e) => {
              const next = e.target.value as SupportedLanguage;
              setLang(next);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            aria-label={t('switchLanguage')}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              height: 40,
              paddingLeft: 36,
              paddingRight: 32,
              borderRadius: radii.md,
              border: `1px solid ${isFocused ? colors.primary : colors.cardBorder}`,
              backgroundColor: colors.card,
              fontSize: 14,
              fontWeight: 600,
              color: colors.ink,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: "'DM Sans', 'Noto Sans Kannada', 'Noto Sans Devanagari', ui-sans-serif, system-ui, sans-serif",
              lineHeight: '40px',
              transition: 'border-color 0.15s ease',
            }}
          >
            {LANGUAGE_DROPDOWN_OPTIONS.map((l) => (
              <option
                key={l.id}
                value={l.id}
                style={{
                  color: colors.ink,
                  backgroundColor: colors.card,
                  fontSize: 14,
                  fontWeight: 500,
                  padding: '8px 12px',
                }}
              >
                {l.label}
              </option>
            ))}
          </select>
          <span
            style={{
              position: 'absolute',
              right: 12,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <Icon name="chevronDown" size={14} color={colors.inkMuted} />
          </span>
        </div>
      </View>
    );
  }

  // Native mobile fallback (iOS / Android)
  return (
    <>
      <Pressable
        onPress={() => {
          haptic.tap();
          setModalOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t('switchLanguage')}: ${currentOption.label}`}
        style={({ pressed }) => [
          styles.nativeButton,
          pressed && styles.nativeButtonPressed,
          style,
        ]}
      >
        <Icon name="translate" size={18} color={colors.inkMuted} />
        <AppText variant="subhead" weight={600} color="ink" numberOfLines={1}>
          {compact ? currentOption.id.toUpperCase() : currentOption.label}
        </AppText>
        <Icon name="chevronDown" size={14} color={colors.inkMuted} />
      </Pressable>

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <View style={styles.modalMenu}>
            {LANGUAGE_DROPDOWN_OPTIONS.map((item) => {
              const isSelected = item.id === lang;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    haptic.selection();
                    setLang(item.id);
                    setModalOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    isSelected && styles.menuItemSelected,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <AppText
                    variant="subhead"
                    weight={isSelected ? 700 : 500}
                    color={isSelected ? 'primaryDeep' : 'ink'}
                  >
                    {item.label}
                  </AppText>
                  {isSelected && <Icon name="check" size={16} color={colors.primaryDeep} active />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  nativeButton: {
    height: 40,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nativeButtonPressed: {
    backgroundColor: colors.base,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(19, 36, 47, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalMenu: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xs,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  menuItemSelected: {
    backgroundColor: colors.ice,
  },
  menuItemPressed: {
    opacity: 0.7,
  },
});
