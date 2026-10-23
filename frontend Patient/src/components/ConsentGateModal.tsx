import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { WarmClinicTheme } from '../theme/tokens';
import { ConsentRequestData } from '../services/api';

interface ConsentGateModalProps {
  visible: boolean;
  request: ConsentRequestData | null;
  onApprove: (otp: string) => Promise<void>;
  onDecline: () => void;
  selectedLanguage: 'kn' | 'hi' | 'en';
}

export const ConsentGateModal: React.FC<ConsentGateModalProps> = ({
  visible,
  request,
  onApprove,
  onDecline,
  selectedLanguage,
}) => {
  const [otp, setOtp] = useState('123456');
  const [timeLeft, setTimeLeft] = useState(3600); // 60 mins
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onApprove(otp);
    } finally {
      setSubmitting(false);
    }
  };

  const getNotice = () => {
    if (selectedLanguage === 'kn') {
      return 'ವೈದ್ಯರು ನಿಮ್ಮ ಆರೋಗ್ಯ ದಾಖಲೆಯನ್ನು ನಿರ್ದಿಷ್ಟ ಕಾರಣಕ್ಕಾಗಿ ವೀಕ್ಷಿಸಲು ಅನುಮತಿ ಕೋರಿದ್ದಾರೆ. ಇದು 60 ನಿಮಿಷಗಳ ನಂತರ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಮುಕ್ತಾಯಗೊಳ್ಳುತ್ತದೆ.';
    }
    if (selectedLanguage === 'hi') {
      return 'डॉक्टर ने आपके स्वास्थ्य रिकॉर्ड को देखने की अनुमति मांगी है। यह 60 मिनट बाद स्वतः समाप्त हो जाएगी।';
    }
    return 'Doctor is requesting time-bound, purpose-specific access to your diagnostic scan under the DPDP Act 2023.';
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* iOS Grabber Handle */}
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.shieldIconBadge}>
              <Text style={{ fontSize: 20 }}>🛡️</Text>
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.modalTitle}>DPDP Consent Request</Text>
              <Text style={styles.modalSubtitle}>Purpose-Bound Record Access</Text>
            </View>
            <View style={styles.timerChip}>
              <Text style={styles.timerText}>⏱️ {formatCountdown(timeLeft)}</Text>
            </View>
          </View>

          {/* Vernacular Notice */}
          <Text style={styles.vernacularNotice}>{getNotice()}</Text>

          {/* Doctor Credentials & Stated Purpose */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>PRACTITIONER</Text>
              <Text style={styles.infoValue}>
                {request?.practitioner_name || 'Your doctor'}
                {request?.practitioner_reg ? ` (${request.practitioner_reg})` : ''}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>RECORD SOUGHT</Text>
              <Text style={[styles.infoValue, { fontWeight: '700' }]}>
                {request?.record_title || 'Ultrasound Pelvis & Abdomen Scan'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>EXPLICIT PURPOSE</Text>
              <Text style={styles.infoPurpose}>
                {request?.clinical_purpose || 'Evaluating acute flank colic & suspected nephrolithiasis'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>TOKEN VALIDITY</Text>
              <Text style={[styles.infoValue, { color: '#34C759', fontWeight: '700' }]}>
                60 Minutes (Cryptographic Token)
              </Text>
            </View>
          </View>

          {/* OTP Input Field */}
          <View style={styles.otpSection}>
            <Text style={styles.otpLabel}>ENTER 6-DIGIT CONSENT OTP</Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.otpInput}
              placeholder="123456"
              placeholderTextColor="#8E8E93"
            />
            <Text style={styles.otpHint}>Simulated OTP pre-filled for instant verification</Text>
          </View>

          {/* Actions: Decline vs Approve */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onDecline}
              style={styles.declineButton}
            >
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleConfirm}
              disabled={submitting}
              style={styles.approveButton}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.approveText}>Authorize Access</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  shieldIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  timerChip: {
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF9500',
  },
  vernacularNotice: {
    fontSize: 12,
    color: '#636366',
    lineHeight: 17,
    marginBottom: 12,
    backgroundColor: '#F2F2F7',
    padding: 10,
    borderRadius: 12,
  },
  infoBox: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  infoRow: {
    flexDirection: 'column',
    gap: 1,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  infoPurpose: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  otpSection: {
    marginTop: 12,
    marginBottom: 14,
  },
  otpLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  otpInput: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 8,
    color: '#1C1C1E',
  },
  otpHint: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 3,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  approveButton: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  approveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
