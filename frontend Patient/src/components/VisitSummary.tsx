import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { patientApi, type VisitSummaryData } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../utils/translations';
import { formatTimestamp } from '../utils/dates';
import { GlassSheet } from './glass';
import { AppText, Card, Icon, PrimaryButton, SecondaryButton, SectionHeader } from './ui';

const SECTIONS: { key: 'told' | 'advice' | 'next' | 'urgent'; title: TranslationKey }[] = [
  { key: 'told', title: 'summaryTold' },
  { key: 'advice', title: 'summaryAdvice' },
  { key: 'next', title: 'summaryNext' },
  { key: 'urgent', title: 'summaryUrgent' },
];

/** The sections of one visit summary (no names: it was written from masked text). */
export const SummaryBody: React.FC<{ summary: VisitSummaryData }> = ({ summary }) => {
  const { t } = useLanguage();
  return (
    <View style={styles.gap}>
      {SECTIONS.map(({ key, title }) => {
        const items = summary.sections[key] ?? [];
        if (!items.length) return null;
        return (
          <View key={key} style={styles.small}>
            <AppText variant="subhead" weight={700} color={key === 'urgent' ? 'dangerDeep' : 'ink'}>{t(title)}</AppText>
            {items.map((line, i) => (
              <AppText key={i} variant="body">• {line}</AppText>
            ))}
          </View>
        );
      })}
    </View>
  );
};

/**
 * After a consultation with AI minutes: "Would you like a summary?" Nothing is kept unless the patient says yes.
 */
export const SummaryOfferSheet: React.FC<{ summaryId: string | null; onDone: (saved: VisitSummaryData | null) => void }> = ({ summaryId, onDone }) => {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<VisitSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prevSummaryId, setPrevSummaryId] = useState(summaryId);
  if (prevSummaryId !== summaryId) {
    setPrevSummaryId(summaryId);
    setSaved(null);
    setError(null);
  }

  const accept = async () => {
    if (!summaryId) return;
    setBusy(true);
    try {
      setSaved(await patientApi.acceptSummary(summaryId));
    } catch {
      setError(t('summaryGone'));
    } finally {
      setBusy(false);
    }
  };
  const decline = () => {
    if (summaryId) void patientApi.declineSummary(summaryId).catch(() => undefined);
    onDone(null);
  };

  return (
    <GlassSheet visible={summaryId !== null} onClose={saved ? () => onDone(saved) : decline} placement="bottom">
      <View style={styles.sheet}>
        {saved ? (
          <>
            <AppText variant="title" accessibilityRole="header">{t('summaryTitle')}</AppText>
            <SummaryBody summary={saved} />
            <PrimaryButton label={t('summaryDone')} onPress={() => onDone(saved)} />
          </>
        ) : (
          <>
            <Icon name="document" size={36} />
            <AppText variant="title" accessibilityRole="header">{t('summaryOfferTitle')}</AppText>
            <AppText variant="body">{t('summaryOfferBody')}</AppText>
            {error && <AppText variant="footnote" color="dangerDeep">{error}</AppText>}
            <PrimaryButton label={t('summaryYes')} icon="check" loading={busy} onPress={() => void accept()} />
            <SecondaryButton label={t('summaryNo')} onPress={decline} />
          </>
        )}
      </View>
    </GlassSheet>
  );
};

/** Saved summaries, newest first (care plan screen). */
export const SavedSummaries: React.FC<{ refreshKey?: number }> = ({ refreshKey = 0 }) => {
  const { lang, t } = useLanguage();
  const [items, setItems] = useState<VisitSummaryData[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { patientApi.getMySummaries().then(setItems).catch(() => setItems([])); }, [refreshKey]);
  if (items.length === 0) return null;
  return (
    <View style={styles.small}>
      <SectionHeader title={t('summariesSection')} count={items.length} />
      {items.slice(0, 3).map((s) => (
        <Card key={s.summary_id} style={styles.small}>
          <SecondaryButton
            label={`${formatTimestamp(s.created_at, lang)} ${open === s.summary_id ? '▲' : '▼'}`}
            size="sm"
            onPress={() => setOpen(open === s.summary_id ? null : s.summary_id)}
          />
          {open === s.summary_id && <SummaryBody summary={s} />}
        </Card>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: { gap: spacing.md, padding: spacing.lg },
  gap: { gap: spacing.md },
  small: { gap: spacing.sm },
});
