import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Platform } from 'react-native';
import { AppleTheme } from '../theme/tokens';

interface EmergencySOSModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EmergencySOSModal: React.FC<EmergencySOSModalProps> = ({
  visible,
  onClose,
}) => {
  const dial = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {
      // No phone dialer available (e.g. desktop browser)
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* iOS Emergency Red Beacon */}
          <View style={styles.iconCircle}>
            <Text style={{ fontSize: 32 }}>🚨</Text>
          </View>

          <Text style={styles.title}>Emergency SOS</Text>
          <Text style={styles.kannadaTitle}>ತುರ್ತು ವೈದ್ಯಕೀಯ ಸೇವೆ (108 / 112)</Text>

          <Text style={styles.desc}>
            Your real-time GPS coordinates and ABDM emergency health record have been shared with Hassan District Emergency Response.
          </Text>

          <View style={styles.buttonStack}>
            {/* Primary Action: 108 Ambulance */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => dial('108')}
              style={styles.call108Button}
              accessibilityRole="button"
            >
              <Text style={styles.call108Text}>📞 Dial 108 Ambulance</Text>
            </TouchableOpacity>

            {/* Secondary Action: 112 National Emergency */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => dial('112')}
              style={styles.call112Button}
              accessibilityRole="button"
            >
              <Text style={styles.call112Text}>🚨 Dial 112 Unified SOS</Text>
            </TouchableOpacity>

            {/* Dismiss */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              style={styles.dismissButton}
            >
              <Text style={styles.dismissText}>Cancel</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: AppleTheme.colors.systemRed,
    letterSpacing: -0.4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'System',
    textAlign: 'center',
  },
  kannadaTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: AppleTheme.colors.label,
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    color: AppleTheme.colors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 2,
    paddingHorizontal: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  buttonStack: {
    width: '100%',
    gap: 10,
    marginTop: 14,
  },
  call108Button: {
    height: 52,
    borderRadius: 16,
    backgroundColor: AppleTheme.colors.systemRed,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppleTheme.colors.systemRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  call108Text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  call112Button: {
    height: 48,
    borderRadius: 16,
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  call112Text: {
    fontSize: 14,
    fontWeight: '600',
    color: AppleTheme.colors.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  dismissButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    color: AppleTheme.colors.systemBlue,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
});
