import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WarmClinicTheme } from '../theme/tokens';
import { PatientUser } from '../services/api';

interface PatientHeaderProps {
  user: PatientUser | null;
  selectedLanguage: 'kn' | 'hi' | 'en';
  onToggleLanguage: () => void;
  onOpenProfile: () => void;
  onLogout?: () => void;
}

export const PatientHeader: React.FC<PatientHeaderProps> = ({
  user,
  selectedLanguage,
  onToggleLanguage,
  onOpenProfile,
  onLogout,
}) => {
  const getGreeting = () => {
    if (selectedLanguage === 'kn') return 'ನಮಸ್ಕಾರ';
    if (selectedLanguage === 'hi') return 'नमस्ते';
    return 'Namaste';
  };

  const getLanguageLabel = () => {
    if (selectedLanguage === 'kn') return 'ಕ (KN)';
    if (selectedLanguage === 'hi') return 'हि (HI)';
    return 'EN';
  };

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).toUpperCase();

  const firstName = user?.full_name?.split(' ')[0] || '';

  return (
    <View style={styles.headerContainer}>
      {/* Top row: date on the left, actions on the right */}
      <View style={styles.topRow}>
        <Text style={styles.dateEyebrow} numberOfLines={1}>
          {todayDate}
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onToggleLanguage}
            style={styles.langPill}
            accessibilityLabel="Change language"
          >
            <Ionicons name="language" size={14} color={WarmClinicTheme.colors.systemBlue} />
            <Text style={styles.langText}>{getLanguageLabel()}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onOpenProfile}
            style={styles.avatarButton}
            accessibilityLabel="Profile"
          >
            <Text style={styles.avatarInitial}>{firstName.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>

          {onLogout && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onLogout}
              style={styles.iconButton}
              accessibilityLabel="Sign out"
            >
              <Ionicons name="log-out-outline" size={18} color={WarmClinicTheme.colors.alertRed} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Greeting on its own line so long Kannada / Hindi text never collides with the buttons */}
      <Text style={styles.nameText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {getGreeting()}, {firstName}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: WarmClinicTheme.colors.surface,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateEyebrow: {
    flex: 1,
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nameText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    borderRadius: WarmClinicTheme.radii.pill,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  langText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: WarmClinicTheme.colors.verifiedGreenBg,
    borderWidth: 1.5,
    borderColor: WarmClinicTheme.colors.verifiedGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: WarmClinicTheme.colors.forestHover,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
