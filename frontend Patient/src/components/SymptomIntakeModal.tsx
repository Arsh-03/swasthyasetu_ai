import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { AppleTheme } from '../theme/tokens';

interface SymptomIntakeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (symptoms: string[], isRep: boolean, notes: string) => void;
  selectedLanguage: 'kn' | 'hi' | 'en';
}

export const SymptomIntakeModal: React.FC<SymptomIntakeModalProps> = ({
  visible,
  onClose,
  onSubmit,
  selectedLanguage,
}) => {
  const [isRepresentative, setIsRepresentative] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['Fever (ಜ್ವರ)']);
  const [notes, setNotes] = useState('Severe flank colic on right side for 3 days');
  const [isRecording, setIsRecording] = useState(false);

  const symptomList = [
    { id: 'fever', label: 'Fever (ಜ್ವರ / बुखार)', emoji: '🌡️' },
    { id: 'stomach', label: 'Stomach Pain (ಹೊಟ್ಟೆ ನೋವು)', emoji: '🤢' },
    { id: 'cough', label: 'Cough (ಕೆಮ್ಮು / खांसी)', emoji: '🫁' },
    { id: 'joints', label: 'Joint Ache (ಕೀಲು ನೋವು)', emoji: '🦴' },
    { id: 'headache', label: 'Headache (ತಲೆನೋವು)', emoji: '🤕' },
    { id: 'vomit', label: 'Nausea (ವಾಕರಿಕೆ)', emoji: '🤮' },
  ];

  const toggleSymptom = (label: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
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

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheetContainer}>
          {/* iOS Grabber */}
          <View style={styles.grabberHandle} />

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Symptom Intake</Text>
              <Text style={styles.sheetSubtitle}>
                {selectedLanguage === 'kn'
                  ? 'ಲಕ್ಷಣಗಳ ವಿವರ (Pre-Consultation Check)'
                  : 'Pre-Consultation Clinical Triage'}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              style={styles.closeCircle}
              accessibilityLabel="Close"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Consultation Role: iOS Segmented Control */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>WHO IS CONSULTING?</Text>
              <View style={styles.roleSegment}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsRepresentative(false)}
                  style={[styles.roleOption, !isRepresentative && styles.roleOptionActive]}
                >
                  <Text style={[styles.roleText, !isRepresentative && styles.roleTextActive]}>
                    👤 Patient (Self)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsRepresentative(true)}
                  style={[styles.roleOption, isRepresentative && styles.roleOptionActive]}
                >
                  <Text style={[styles.roleText, isRepresentative && styles.roleTextActive]}>
                    👥 Representative
                  </Text>
                </TouchableOpacity>
              </View>

              {isRepresentative && (
                <View style={styles.repBadge}>
                  <Text style={styles.repBadgeText}>
                    Authorized Nominee: Sunita Devi (Spouse) • DPDP Nominee Consent Verified
                  </Text>
                </View>
              )}
            </View>

            {/* Apple Health Symptom Tags Grid */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>SELECT SYMPTOMS</Text>
              <View style={styles.chipsWrap}>
                {symptomList.map((sym) => {
                  const selected = selectedSymptoms.includes(sym.label);
                  return (
                    <TouchableOpacity
                      key={sym.id}
                      activeOpacity={0.75}
                      onPress={() => toggleSymptom(sym.label)}
                      style={[styles.symptomChip, selected && styles.symptomChipSelected]}
                    >
                      <Text style={{ fontSize: 16 }}>{sym.emoji}</Text>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {sym.label}
                      </Text>
                      {selected && <Text style={styles.chipCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Siri / Apple Intelligence Voice Dictation Card */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>DESCRIBE YOUR CONDITION</Text>

              <View style={styles.voiceCard}>
                <View style={styles.voiceHeader}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleVoiceInput}
                    style={[styles.micButton, isRecording && styles.micButtonRecording]}
                  >
                    <Text style={{ fontSize: 22 }}>🎙️</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voiceTitle}>
                      {isRecording ? 'Listening in Kannada / Hindi...' : 'Tap to Speak Symptoms'}
                    </Text>
                    <Text style={styles.voiceSub}>
                      Powered by Bhashini AI Multilingual Engine
                    </Text>
                  </View>
                </View>

                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Describe where the pain is and for how many days..."
                  placeholderTextColor={AppleTheme.colors.tertiaryLabel}
                  multiline
                  style={styles.notesInput}
                />
              </View>
            </View>
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onSubmit(selectedSymptoms, isRepresentative, notes)}
              style={styles.submitButton}
            >
              <Text style={styles.submitButtonText}>
                {selectedLanguage === 'kn' ? 'ವೈದ್ಯರ ಕರೆಗೆ ಸೇರಿ' : 'Join Video Consultation'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: AppleTheme.colors.secondarySystemGroupedBackground,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  grabberHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: AppleTheme.colors.separator,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppleTheme.colors.label,
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'System',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: AppleTheme.colors.secondaryLabel,
    marginTop: 2,
  },
  closeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 13,
    color: AppleTheme.colors.secondaryLabel,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 18,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: AppleTheme.colors.secondaryLabel,
    letterSpacing: 0.6,
    paddingLeft: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  roleSegment: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    padding: 3,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  roleOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '500',
    color: AppleTheme.colors.secondaryLabel,
  },
  roleTextActive: {
    color: AppleTheme.colors.label,
    fontWeight: '600',
  },
  repBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  repBadgeText: {
    fontSize: 11,
    color: AppleTheme.colors.systemBlue,
    fontWeight: '600',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  symptomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  symptomChipSelected: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderColor: AppleTheme.colors.systemBlue,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: AppleTheme.colors.label,
  },
  chipTextSelected: {
    color: AppleTheme.colors.systemBlue,
    fontWeight: '600',
  },
  chipCheck: {
    fontSize: 12,
    fontWeight: '700',
    color: AppleTheme.colors.systemBlue,
  },
  voiceCard: {
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppleTheme.colors.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppleTheme.colors.systemBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  micButtonRecording: {
    backgroundColor: AppleTheme.colors.systemRed,
    shadowColor: AppleTheme.colors.systemRed,
  },
  voiceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: AppleTheme.colors.label,
  },
  voiceSub: {
    fontSize: 11,
    color: AppleTheme.colors.secondaryLabel,
    marginTop: 2,
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    minHeight: 64,
    fontSize: 13,
    color: AppleTheme.colors.label,
    textAlignVertical: 'top',
    borderWidth: 0.5,
    borderColor: AppleTheme.colors.separator,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  footerRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: AppleTheme.colors.separator,
  },
  submitButton: {
    height: 50,
    backgroundColor: AppleTheme.colors.systemBlue,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppleTheme.colors.systemBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
});
