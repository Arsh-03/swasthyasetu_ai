import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { AppleTheme } from '../theme/tokens';

interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  onAccept: () => void;
  onDecline: () => void;
  selectedLanguage?: 'kn' | 'hi' | 'en';
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  visible,
  callerName,
  onAccept,
  onDecline,
  selectedLanguage,
}) => {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Top grabber bar */}
          <View style={styles.grabber} />

          {/* Clinician Avatar with Ringing Glow */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 44 }}>👩‍⚕️</Text>
            </View>
            <View style={styles.ringPulse} />
          </View>

          {/* Caller Details */}
          <View style={styles.textContainer}>
            <Text style={styles.eyebrow}>
              {selectedLanguage === 'kn'
                ? 'ಒಳಬರುವ ವೀಡಿಯೊ ಕರೆ'
                : 'INCOMING VIDEO CALL'}
            </Text>
            <Text style={styles.callerTitle}>{callerName || 'Your doctor'}</Text>
            <Text style={styles.callerSub}>
              Hassan District Hub • SwasthyaSetu Telehealth
            </Text>
            <Text style={styles.complianceTag}>
              🛡️ ABDM Encrypted • DPDP Purpose Verified
            </Text>
          </View>

          {/* iOS Call Actions: Decline and Accept */}
          <View style={styles.actionRow}>
            {/* Decline */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onDecline}
              style={styles.declineButton}
            >
              <Text style={styles.declineIcon}>✕</Text>
              <Text style={styles.declineLabel}>
                {selectedLanguage === 'kn' ? 'ತಿರಸ್ಕರಿಸಿ' : 'Decline'}
              </Text>
            </TouchableOpacity>

            {/* Accept */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onAccept}
              style={styles.acceptButton}
            >
              <Text style={styles.acceptIcon}>📞</Text>
              <Text style={styles.acceptLabel}>
                {selectedLanguage === 'kn' ? 'ಉತ್ತರಿಸಿ' : 'Accept'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 10,
  },
  avatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 2,
  },
  ringPulse: {
    position: 'absolute',
    width: 114,
    height: 114,
    borderRadius: 57,
    backgroundColor: 'rgba(52, 199, 89, 0.25)',
    zIndex: 1,
  },
  textContainer: {
    alignItems: 'center',
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: AppleTheme.colors.systemGreen,
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  callerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'System',
    textAlign: 'center',
  },
  callerSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
    textAlign: 'center',
  },
  complianceTag: {
    fontSize: 11,
    color: AppleTheme.colors.systemTeal,
    fontWeight: '600',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 320,
    marginTop: 14,
  },
  declineButton: {
    alignItems: 'center',
    gap: 8,
  },
  declineIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AppleTheme.colors.systemRed,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 64,
    overflow: 'hidden',
  },
  declineLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  acceptButton: {
    alignItems: 'center',
    gap: 8,
  },
  acceptIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AppleTheme.colors.systemGreen,
    fontSize: 26,
    textAlign: 'center',
    lineHeight: 64,
    overflow: 'hidden',
  },
  acceptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
});
