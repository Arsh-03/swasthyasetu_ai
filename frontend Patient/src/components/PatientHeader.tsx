import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, shadows, spacing, tints } from '../theme/tokens';
import type { PatientUser } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGE_NAMES, t as translate } from '../utils/translations';
import { GlassToolbar } from './glass';
import { AppText, Avatar, BrandMark, IconButton, StableLabel } from './ui';

interface PatientHeaderProps {
  user: PatientUser | null;
  onOpenProfile: () => void;
  onLogout?: () => void;
}

const initialsOf = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
};

/** Mobile DoctorHeader: brand mark, language pill and monogram avatar on the glass toolbar. */
export const PatientHeader: React.FC<PatientHeaderProps> = ({ user, onOpenProfile, onLogout }) => {
  const { lang, t, cycleLang } = useLanguage();

  return (
    <GlassToolbar>
      {/* Brand */}
      <View style={styles.brand}>
        <BrandMark size={36} />
        <View>
          <AppText variant="callout" lang="en" compact style={styles.brandName}>
            {t('appName')}
          </AppText>
          <StableLabel text={(l) => translate(l, 'patientApp')} variant="caption" color="tertiary" compact />
        </View>
      </View>

      <View style={styles.actions}>
        {/* Language switcher pill */}
        <Pressable
          onPress={cycleLang}
          accessibilityRole="button"
          accessibilityLabel={`${t('switchLanguage')}: ${LANGUAGE_NAMES[lang]}`}
          hitSlop={4}
          style={({ pressed }) => [styles.langPill, pressed && styles.langPillPressed]}
        >
          <StableLabel text={(l) => LANGUAGE_NAMES[l]} variant="subhead" weight={500} compact />
          <View style={styles.langCode}>
            <AppText variant="mono" color="secondary">
              {lang.toUpperCase()}
            </AppText>
          </View>
        </Pressable>

        {/* Monogram avatar → profile / symptom intake */}
        <Pressable
          onPress={onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={`${user?.full_name ?? ''}, ${t('openProfile')}`}
          hitSlop={4}
          style={({ pressed }) => [styles.avatarPill, pressed && styles.langPillPressed]}
        >
          <Avatar initials={initialsOf(user?.full_name ?? '')} size={30} />
        </Pressable>

        {onLogout && (
          <IconButton icon="logout" tone="danger" size={32} accessibilityLabel={t('signOut')} onPress={onLogout} />
        )}
      </View>
    </GlassToolbar>
  );
};

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  brandName: {
    letterSpacing: -0.3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    backgroundColor: tints.gray,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  langPillPressed: {
    opacity: 0.7,
  },
  langCode: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.card,
  },
  avatarPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    ...shadows.sm,
  },
});
