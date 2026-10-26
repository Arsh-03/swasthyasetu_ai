import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing, tones } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import type { NextAppointment } from '../../services/api';
import { departmentInfo, departmentName, doctorInitials, doctorShortName } from '../../utils/departments';
import { formatDate, localCalendarDate, parseDateLabel } from '../../utils/dates';
import { MONTHS, WEEKDAYS } from '../../utils/translations';
import { localized } from '../../utils/localized';
import { GlassSheet } from '../glass';
import { AppText, Badge, DestructiveButton, Icon, SecondaryButton, TertiaryButton } from '../ui';

/** Initials on the doctor's department colour (no stock photos: every doctor looks distinct). */
export const DoctorAvatar: React.FC<{ name: string; department?: string; size?: number }> = ({ name, department, size = 52 }) => {
  const tone = tones[departmentInfo(department).tone];
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.bg, borderColor: tone.ring }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppText variant="headline" weight={700} color={tone.text} lang="en" compact style={{ fontSize: Math.round(size * 0.36) }}>
        {doctorInitials(name)}
      </AppText>
    </View>
  );
};

/** Department pill: icon + localised name, in the department's colour. */
export const DepartmentBadge: React.FC<{ department?: string; fallback?: string; size?: 'sm' | 'md' }> = ({ department, fallback, size = 'sm' }) => {
  const { lang } = useLanguage();
  const info = departmentInfo(department);
  const label = departmentName(department, lang) || fallback;
  if (!label) return null;
  return <Badge label={label} tone={info.tone} icon={info.icon} size={size} />;
};

/** "Thu, 29 October" style date for an appointment (clinic date label) plus its time. */
export const appointmentWhen = (apt: NextAppointment, lang: ReturnType<typeof useLanguage>['lang']) => {
  const d = parseDateLabel(apt.date);
  return { date: d ? formatDate(d, lang, { weekday: true, year: false }) : apt.date, time: apt.time };
};

/** Clinic date "2026-10-29" -> "Thursday, 29 October" (or "Today" / "Tomorrow"). */
export const slotDayLabel = (isoDate: string, lang: ReturnType<typeof useLanguage>['lang'], t?: ReturnType<typeof useLanguage>['t']) => {
  const d = parseDateLabel(isoDate);
  if (!d) return isoDate;
  if (t) {
    const today = localCalendarDate();
    const diff = Math.round((Date.UTC(d.year, d.month, d.day) - Date.UTC(today.year, today.month, today.day)) / 86_400_000);
    if (diff === 0) return t('relToday');
    if (diff === 1) return t('relTomorrow');
  }
  return formatDate(d, lang, { weekday: true, year: false });
};

/** Two short lines for a narrow date box: ("Today" | "Wednesday", "28 Oct"). */
const dateBoxLines = (isoDate: string, lang: ReturnType<typeof useLanguage>['lang'], t: ReturnType<typeof useLanguage>['t']) => {
  const d = parseDateLabel(isoDate);
  if (!d) return { top: '', bottom: isoDate };
  const today = localCalendarDate();
  const diff = Math.round((Date.UTC(d.year, d.month, d.day) - Date.UTC(today.year, today.month, today.day)) / 86_400_000);
  const top = diff === 0 ? t('relToday') : diff === 1 ? t('relTomorrow') : WEEKDAYS[lang][new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay()];
  const month = MONTHS[lang][d.month];
  return { top, bottom: `${d.day} ${lang === 'en' ? month.slice(0, 3) : month}` };
};

export const isVideo = (mode: string | undefined) => (mode || '').toLowerCase().includes('video');

interface AppointmentRowProps {
  apt: NextAppointment;
  /** Show the doctor's name (schedule across doctors) or not (one doctor's page). */
  showDoctor?: boolean;
  onCancel?: () => void;
  onPress?: () => void;
  muted?: boolean;
}

/** One appointment: date/time block, doctor + department, visit type, agenda, and a cancel action. */
export const AppointmentRow: React.FC<AppointmentRowProps> = ({ apt, showDoctor = true, onCancel, onPress, muted }) => {
  const { lang, t } = useLanguage();
  const box = dateBoxLines(apt.date, lang, t);
  const video = isVideo(apt.mode);
  const agenda = localized(apt.agenda, lang);
  const cancelled = apt.visitStatus === 'cancelled' || apt.visitStatus === 'no_show';
  const body = (
    <View style={styles.aptRow}>
      <View
        style={[styles.when, muted && styles.whenMuted]}
        accessible
        accessibilityLabel={`${appointmentWhen(apt, lang).date}, ${apt.time}`}
      >
        {box.top ? (
          <AppText variant="caption" weight={600} color={muted ? 'inkMuted' : 'primaryDeep'} align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {box.top}
          </AppText>
        ) : null}
        <AppText variant="footnote" weight={700} color={muted ? 'inkMuted' : 'primaryDeep'} align="center" numberOfLines={2}>
          {box.bottom}
        </AppText>
        <AppText variant="subhead" weight={700} color={muted ? 'inkMuted' : 'ink'} align="center" lang="en" compact numberOfLines={1} adjustsFontSizeToFit>
          {apt.time}
        </AppText>
      </View>
      <View style={styles.flex}>
        {showDoctor ? (
          <AppText variant="subhead" weight={700} numberOfLines={1}>
            {doctorShortName(apt.doctorName || t('yourDoctor'))}
          </AppText>
        ) : null}
        <View style={styles.badges}>
          {showDoctor ? <DepartmentBadge department={apt.department} fallback={localized(apt.specialty, lang)} /> : null}
          <Badge
            label={video ? t('visitVideo') : t('visitInPerson')}
            tone={video ? 'primary' : 'teal'}
            icon={video ? 'video' : 'hospital'}
          />
          {cancelled ? <Badge label={t('appointmentCancelled')} tone="neutral" icon="calendarX" /> : null}
          {apt.visitStatus === 'completed' ? <Badge label={t('visitDone')} tone="success" icon="checkCircle" /> : null}
        </View>
        {agenda ? (
          <AppText variant="footnote" color="inkMuted" numberOfLines={2}>
            {agenda}
          </AppText>
        ) : null}
        {!video && !muted && apt.facility ? (
          <View style={styles.inline}>
            <Icon name="mapPin" size={14} color={colors.inkMuted} />
            <AppText variant="caption" color="inkMuted" numberOfLines={1} style={styles.flex}>
              {localized(apt.facility, lang)}
            </AppText>
          </View>
        ) : null}
        {onCancel ? (
          <TertiaryButton label={t('cancelAppointment')} icon="calendarX" size="sm" onPress={onCancel} style={styles.cancelBtn} />
        ) : null}
      </View>
      {onPress ? <Icon name="chevronRight" size={18} color={colors.inkMuted} /> : null}
    </View>
  );
  return body;
};

/** Centered yes / no dialog (React Native's Alert does nothing on the web). */
export const ConfirmSheet: React.FC<{
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}> = ({ visible, title, body, confirmLabel, onConfirm, onClose }) => {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  return (
    <GlassSheet visible={visible} onClose={onClose} closeOnBackdrop placement="center">
      <View style={styles.confirm}>
        <AppText variant="title2" weight={700} accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="body" color="inkMuted">
          {body}
        </AppText>
        <DestructiveButton
          label={confirmLabel}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        />
        <SecondaryButton label={t('keepIt')} tone="neutral" onPress={onClose} />
      </View>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  aptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  when: {
    width: 84,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.ice,
    gap: 2,
  },
  whenMuted: {
    backgroundColor: colors.base,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginVertical: 2,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cancelBtn: {
    alignSelf: 'flex-start',
    marginLeft: -spacing.sm,
  },
  confirm: {
    padding: spacing.xl,
    gap: spacing.md,
  },
});
