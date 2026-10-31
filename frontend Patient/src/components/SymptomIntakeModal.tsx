import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, radii, spacing, tints } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../utils/translations';
import { GlassSheet } from './glass';
import {
  AppText,
  Chip,
  IconButton,
  type IconName,
  CriticalButton,
  SectionHeader,
  SegmentedControl,
  SheetHeader,
  TextField,
} from './ui';
import { useScripts } from '../speech';

interface SymptomIntakeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (symptoms: string[], isRep: boolean, notes: string) => void;
  /** The doctor this visit request goes to (one of the patient's doctors); none = the triage queue. */
  doctorName?: string | null;
}

// `value` is what the backend receives (unchanged); `label` is what the patient sees
const SYMPTOMS: { value: string; label: TranslationKey; icon: IconName }[] = [
  { value: 'Fever (ಜ್ವರ / बुखार)', label: 'symptomFever', icon: 'fever' },
  { value: 'Stomach Pain (ಹೊಟ್ಟೆ ನೋವು)', label: 'symptomStomach', icon: 'stomach' },
  { value: 'Cough (ಕೆಮ್ಮು / खांसी)', label: 'symptomCough', icon: 'cough' },
  { value: 'Joint Ache (ಕೀಲು ನೋವು)', label: 'symptomJoints', icon: 'joint' },
  { value: 'Headache (ತಲೆನೋವು)', label: 'symptomHeadache', icon: 'headache' },
  { value: 'Nausea (ವಾಕರಿಕೆ)', label: 'symptomNausea', icon: 'nausea' },
];

export const SymptomIntakeModal: React.FC<SymptomIntakeModalProps> = ({ visible, onClose, onSubmit, doctorName }) => {
  const { t } = useLanguage();
  const scripts = useScripts();
  const [isRepresentative, setIsRepresentative] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([SYMPTOMS[0].value]);
  const [notes, setNotes] = useState('Severe flank colic on right side for 3 days');
  const [isRecording, setIsRecording] = useState(false);

  const toggleSymptom = (value: string) => {
    setSelectedSymptoms((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  };

  const handleVoiceInput = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
        setNotes((prev) => prev + ' [Transcribed: ಬಲಭಾಗದ ಹೊಟ್ಟೆ ನೋವು - Severe Right Flank Pain]');
      }, 2500);
    }
  };

  return (
    <GlassSheet visible={visible} onClose={onClose} closeOnBackdrop>
      <SheetHeader
        icon="clipboard"
        title={t('symptomIntake')}
        subtitle={doctorName ? t('visitRequestFor', { name: doctorName }) : t('symptomIntakeSubtitle')}
        onClose={onClose}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Who is consulting */}
        <View style={styles.section}>
          <SectionHeader title={t('whoIsConsulting')} />
          <SegmentedControl
            options={[
              { value: 'self', label: t('segSelf'), icon: 'person' },
              { value: 'rep', label: t('segRepresentative'), icon: 'people' },
            ]}
            value={isRepresentative ? 'rep' : 'self'}
            onChange={(v) => setIsRepresentative(v === 'rep')}
          />
          {isRepresentative && (
            <View style={styles.repBadge}>
              <AppText variant="footnote" weight={600} color="primary">
                {t('nomineeVerified')}
              </AppText>
            </View>
          )}
        </View>

        {/* Symptoms */}
        <View style={styles.section}>
          <SectionHeader title={t('selectSymptoms')} count={selectedSymptoms.length} />
          <View style={styles.chips}>
            {SYMPTOMS.map((sym) => (
              <Chip
                key={sym.value}
                label={t(sym.label)}
                icon={sym.icon}
                selected={selectedSymptoms.includes(sym.value)}
                speech={scripts.symptoms.symptomToggle(t(sym.label), selectedSymptoms.includes(sym.value))}
                onPress={() => toggleSymptom(sym.value)}
              />
            ))}
          </View>
        </View>

        {/* Voice dictation + notes */}
        <View style={styles.section}>
          <SectionHeader title={t('describeCondition')} />
          <View style={styles.voiceCard}>
            <View style={styles.voiceHeader}>
              <IconButton
                icon={isRecording ? 'stop' : 'mic'}
                size={52}
                iconSize={24}
                speech={scripts.symptoms.voiceInput(isRecording)}
                accessibilityLabel={isRecording ? t('stopVoiceInput') : t('startVoiceInput')}
                onPress={handleVoiceInput}
                selected={isRecording}
                haptics
              />
              <View style={styles.flex}>
                <AppText variant="subhead" weight={600}>
                  {isRecording ? t('listeningVoice') : t('tapToSpeak')}
                </AppText>
                <AppText variant="caption" color="inkMuted">
                  {t('voiceEngine')}
                </AppText>
              </View>
            </View>
            <TextField
              label={t('describeCondition')}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('notesPlaceholder')}
              icon="clipboard"
              multiline
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <CriticalButton
          tone="primary"
          label={t('joinVideoConsultation')}
          speech={scripts.symptoms.submit(doctorName ? doctorName : undefined)}
          icon="video"
          onPress={() => onSubmit(selectedSymptoms, isRepresentative, notes)}
        />
      </View>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexShrink: 1,
  },
  body: {
    gap: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  repBadge: {
    backgroundColor: tints.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  voiceCard: {
    backgroundColor: colors.base,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    gap: spacing.md,
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
});
