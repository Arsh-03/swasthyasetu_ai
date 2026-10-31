import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import type { PatientUser } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGE_NAMES, LANGUAGE_SHORT, t as translate } from '../utils/translations';
import { GlassToolbar } from './glass';
import { AppText, Avatar, BrandMark, Icon, IconButton, NeuPressable, StableLabel } from './ui';
import { useScripts } from '../speech';

interface PatientHeaderProps {
  user: PatientUser | null;
  onOpenProfile: () => void;
  onLogout?: () => void;
  onBrandLongPress?: () => void;
}

const initialsOf = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
};

/**
 * Header layout for a given width. Uses the effective width (width ÷ font scale) so large
 * system text gets the compact layouts too. Order of giving up space: full language name →
 * subtitle → app name. The controls never shrink or overlap the brand.
 */
export const headerLayout = (width: number, fontScale = 1) => {
  const w = width / Math.max(1, fontScale);
  return {
    shortLanguage: w < 400,
    // Shown only where they fit unclipped next to the controls (ellipsis remains a safety net)
    showSubtitle: w >= 380,
    showName: w >= 370,
  };
};

interface HeaderBarProps extends PatientHeaderProps {
  /** Override the measured width (dev Style Guide previews). */
  availableWidth?: number;
}

/** Toolbar contents: brand group (flex, ellipsis) + controls (fixed). */
export const HeaderBar: React.FC<HeaderBarProps> = ({ user, onOpenProfile, onLogout, onBrandLongPress, availableWidth }) => {
  const { lang, t, cycleLang } = useLanguage();
  const scripts = useScripts();
  const window = useWindowDimensions();
  const layout = headerLayout(availableWidth ?? window.width, window.fontScale);

  return (
    <View style={styles.bar}>
      {/* Brand: takes the remaining space and ellipsizes; never pushed under the controls */}
      <View style={styles.brand} accessible={!layout.showName} accessibilityLabel={!layout.showName ? t('appName') : undefined}>
        <BrandMark size={36} onLongPress={onBrandLongPress} speech={scripts.header.logo} />
        {layout.showName && (
          <View style={styles.brandText}>
            <AppText variant="callout" compact numberOfLines={1} ellipsizeMode="tail" style={styles.brandName} speech={scripts.header.logo}>
              {t('appName')}
            </AppText>
            {layout.showSubtitle && (
              <StableLabel
                speech={scripts.header.logo}
                text={(l) => translate(l, 'patientApp')}
                variant="caption"
                color="inkMuted"
                compact
                ellipsizeMode="tail"
                containerStyle={styles.subtitle}
              />
            )}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {/* Language pill: icon + full name, or icon + short code below 400pt */}
        <NeuPressable
          onPress={cycleLang}
          atomic
          speech={() => scripts.header.language(LANGUAGE_NAMES[lang])}
          radius={radii.md}
          compact
          haptics="selection"
          hitSlop={4}
          accessibilityLabel={`${t('switchLanguage')}: ${LANGUAGE_NAMES[lang]}`}
          style={[styles.langPill, layout.shortLanguage && styles.langPillShort]}
        >
          <Icon name="translate" size={18} color={colors.primary} active />
          <StableLabel text={(l) => (layout.shortLanguage ? LANGUAGE_SHORT[l] : LANGUAGE_NAMES[l])} variant="subhead" weight={600} compact />
        </NeuPressable>

        {/* Monogram avatar → profile / symptom intake */}
        <NeuPressable
          onPress={onOpenProfile}
          atomic
          speech={() => scripts.header.profile(user?.full_name?.split(' ')[0] ?? '')}
          radius={21}
          compact
          hitSlop={3}
          accessibilityLabel={`${user?.full_name ?? ''}, ${t('openProfile')}`}
          style={styles.avatarDisc}
        >
          <Avatar initials={initialsOf(user?.full_name ?? '')} size={30} />
        </NeuPressable>

        {onLogout && (
          <IconButton icon="signOut" tone="danger" size={42} accessibilityLabel={t('signOut')} onPress={onLogout} speech={scripts.header.logout} />
        )}
      </View>
    </View>
  );
};

/** Glass toolbar: brand, raised language pill, raised avatar disc, raised sign-out disc. */
export const PatientHeader: React.FC<PatientHeaderProps> = (props) => (
  <GlassToolbar>
    <HeaderBar {...props} />
  </GlassToolbar>
);

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    letterSpacing: -0.3,
  },
  subtitle: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  actions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  langPillShort: {
    paddingHorizontal: 10,
    gap: 4,
  },
  avatarDisc: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
