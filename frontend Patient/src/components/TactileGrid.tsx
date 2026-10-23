import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WarmClinicTheme } from '../theme/tokens';

interface TactileGridProps {
  onOpenDoctors: () => void;
  onOpenRecords: () => void;
  onOpenMedicines: () => void;
  onOpenFollowUp: () => void;
  onTriggerEmergency: () => void;
  selectedLanguage: 'kn' | 'hi' | 'en';
}

export const TactileGrid: React.FC<TactileGridProps> = ({
  onOpenDoctors,
  onOpenRecords,
  onOpenMedicines,
  onOpenFollowUp,
  onTriggerEmergency,
  selectedLanguage,
}) => {
  const getTitles = () => {
    if (selectedLanguage === 'kn') {
      return {
        doctors: 'ನನ್ನ ವೈದ್ಯರು\n(My Doctors)',
        records: 'ನನ್ನ ದಾಖಲೆಗಳು\n(My Records)',
        medicines: 'ಔಷಧಿಗಳು\n(Medicines)',
        followUp: 'ಮುಂದಿನ ಭೇಟಿ\n(Follow-up)',
        emergency: 'ತುರ್ತು ಕರೆ (Emergency SOS - 108)',
      };
    }
    if (selectedLanguage === 'hi') {
      return {
        doctors: 'मेरे डॉक्टर\n(My Doctors)',
        records: 'स्वास्थ्य रिकॉर्ड\n(My Records)',
        medicines: 'दवाइयाँ\n(Medicines)',
        followUp: 'अगली जांच\n(Follow-up)',
        emergency: 'आपातकालीन कॉल (Emergency - 108)',
      };
    }
    return {
      doctors: 'My Doctors',
      records: 'My Records',
      medicines: 'Medicines',
      followUp: 'Follow-up Check',
      emergency: 'Emergency SOS (Ambulance 108 / 112)',
    };
  };

  const titles = getTitles();

  return (
    <View style={styles.container}>
      {/* 2x2 Tactile Action Grid */}
      <View style={styles.gridRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpenDoctors}
          style={styles.gridTile}
        >
          <View style={[styles.iconCircle, { backgroundColor: WarmClinicTheme.colors.paleSage }]}>
            <Text style={styles.tileEmoji}>🩺</Text>
          </View>
          <Text style={styles.tileText}>{titles.doctors}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpenRecords}
          style={styles.gridTile}
        >
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(237, 135, 51, 0.2)' }]}>
            <Text style={styles.tileEmoji}>📄</Text>
          </View>
          <Text style={styles.tileText}>{titles.records}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gridRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpenMedicines}
          style={styles.gridTile}
        >
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(181, 81, 57, 0.18)' }]}>
            <Text style={styles.tileEmoji}>💊</Text>
          </View>
          <Text style={styles.tileText}>{titles.medicines}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpenFollowUp}
          style={styles.gridTile}
        >
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(71, 96, 64, 0.18)' }]}>
            <Text style={styles.tileEmoji}>📅</Text>
          </View>
          <Text style={styles.tileText}>{titles.followUp}</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency SOS Bar */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onTriggerEmergency}
        style={styles.emergencyBar}
      >
        <View style={styles.emergencyLeft}>
          <View style={styles.emergencyIconCircle}>
            <Text style={styles.emergencyEmoji}>🚨</Text>
          </View>
          <Text style={styles.emergencyText}>{titles.emergency}</Text>
        </View>
        <View style={styles.callCircle}>
          <Text style={styles.callEmoji}>📞</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    marginTop: 12,
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gridTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tileEmoji: {
    fontSize: 24,
  },
  tileText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    lineHeight: 18,
  },
  emergencyBar: {
    height: 64,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.25)',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  emergencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emergencyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyEmoji: {
    fontSize: 20,
  },
  emergencyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF3B30',
  },
  callCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  callEmoji: {
    fontSize: 16,
  },
});
