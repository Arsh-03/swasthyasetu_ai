import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { WarmClinicTheme } from '../theme/tokens';
import { patientApi, PatientUser } from '../services/api';

interface PatientLoginViewProps {
  onLoginSuccess: (user: PatientUser) => void;
  selectedLanguage: 'kn' | 'hi' | 'en';
  onToggleLanguage: () => void;
}

export const PatientLoginView: React.FC<PatientLoginViewProps> = ({
  onLoginSuccess,
  selectedLanguage,
  onToggleLanguage,
}) => {
  const [authMode, setAuthMode] = useState<'abha' | 'mobile'>('abha');
  const [identifier, setIdentifier] = useState('91-4820-1928-1120@abdm');
  const [otp, setOtp] = useState('123456');
  const [showOtpField, setShowOtpField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!showOtpField) {
      setShowOtpField(true);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      // In demo environment, authenticates via patientApi.loginPatient
      const cleanId = identifier.includes('@') ? '9845012345' : identifier;
      const res = await patientApi.loginPatient(cleanId, 'password123');
      if (res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please verify ABHA ID or mobile number.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = async () => {
    setIdentifier('91-4820-1928-1120@abdm');
    setOtp('123456');
    setShowOtpField(true);
    setErrorMsg(null);
  };

  const handleListen = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text =
        selectedLanguage === 'kn'
          ? 'ನಿಮ್ಮ ಸರ್ಕಾರದ ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಎಬಿಎಚ್ಎ ಆರೋಗ್ಯ ಐಡಿ ಅಥವಾ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ಬಳಸಿಕೊಂಡು ಸುರಕ್ಷಿತವಾಗಿ ಸೈನ್ ಇನ್ ಮಾಡಿ.'
          : 'Sign in securely using your Government ABHA Health ID or mobile number.';
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Bar with Step Indicators & Language Switcher */}
      <View style={styles.topBar}>
        <View style={styles.stepsRow}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={[styles.stepBar, styles.stepDotActive]} />
          <View style={styles.stepDot} />
          <View style={styles.stepDot} />
        </View>

        <View style={styles.topRightActions}>
          <TouchableOpacity activeOpacity={0.8} onPress={onToggleLanguage} style={styles.langPill}>
            <Text style={styles.langIcon}>🌐</Text>
            <Text style={styles.langText}>
              {selectedLanguage === 'kn' ? 'ಕ (KN)' : selectedLanguage === 'hi' ? 'हि (HI)' : 'EN'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Arch Frame Illustration (~40% of viewport, Warm Clinic motif) */}
      <View style={styles.archFrameContainer}>
        <Image
          source={{
            uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAFK9g29UzOVbBvmanewfcfhpS7lYK0M5zBI9xI58osxtgGAB0MCpGRRs8HqlfBee-3YLiRTFqzyWK0xJVlp2x1VOluy2qv4P3EeKW-acWdYovs1chKa4D2XmWyu1rSRGE_KyQSTrkCVCguXBp9qqWT0Ei1f9FOQ3J9RZUWt4fYM8NJC0ejPhNj1lnCON71PGBVjODZWfVYb_FXu52582hRSr-jJ9PV6KPCadYv8tTa072WLvnc2o0jDg',
          }}
          style={styles.heroArchImage}
        />
      </View>

      {/* Headline & Voice Audio Pill */}
      <View style={styles.headlineRow}>
        <View>
          <Text style={styles.signInTitle}>Sign in</Text>
          <Text style={styles.kannadaSubtitle}>
            {selectedLanguage === 'kn' ? 'ಖಾತೆಗೆ ಪ್ರವೇಶಿಸಿ' : selectedLanguage === 'hi' ? 'लॉगिन करें' : 'ABDM Patient Gate'}
          </Text>
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={handleListen} style={styles.listenPill}>
          <Text style={{ fontSize: 18 }}>🔊</Text>
          <Text style={styles.listenPillText}>Listen</Text>
        </TouchableOpacity>
      </View>

      {/* Privacy Trust Safeguards (3 Visual Chips) */}
      <View style={styles.trustGrid}>
        <View style={styles.trustTile}>
          <View style={styles.trustCircle}>
            <Text style={{ fontSize: 24 }}>🔒</Text>
          </View>
          <Text style={styles.trustText}>
            {selectedLanguage === 'kn'
              ? 'ನಿಮ್ಮದೇ ನಿರ್ಧಾರ'
              : selectedLanguage === 'hi'
              ? 'केवल आपका निर्णय'
              : 'Only you decide'}
          </Text>
        </View>

        <View style={styles.trustTile}>
          <View style={styles.trustCircle}>
            <Text style={{ fontSize: 24 }}>🛡️</Text>
          </View>
          <Text style={styles.trustText}>
            {selectedLanguage === 'kn'
              ? 'ಖಾಸಗಿ & ಸುರಕ್ಷಿತ'
              : selectedLanguage === 'hi'
              ? 'कभी साझा नहीं'
              : 'Never shared'}
          </Text>
        </View>

        <View style={styles.trustTile}>
          <View style={styles.trustCircle}>
            <Text style={{ fontSize: 24 }}>🪪</Text>
          </View>
          <Text style={styles.trustText}>
            {selectedLanguage === 'kn'
              ? 'ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಐಡಿ'
              : selectedLanguage === 'hi'
              ? 'सरकारी स्वास्थ्य आईडी'
              : 'Govt health ID'}
          </Text>
        </View>
      </View>

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
        </View>
      )}

      {/* Form Fields: ABHA or Mobile */}
      <View style={styles.inputCard}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            onPress={() => {
              setAuthMode('abha');
              setIdentifier('91-4820-1928-1120@abdm');
            }}
            style={[styles.toggleBtn, authMode === 'abha' && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleBtnText, authMode === 'abha' && styles.toggleBtnTextActive]}>
              {selectedLanguage === 'kn' ? 'ಆಭಾ ವಿಳಾಸ' : selectedLanguage === 'hi' ? 'आभा पता' : 'ABHA Address'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setAuthMode('mobile');
              setIdentifier('9845012345');
            }}
            style={[styles.toggleBtn, authMode === 'mobile' && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleBtnText, authMode === 'mobile' && styles.toggleBtnTextActive]}>
              {selectedLanguage === 'kn' ? 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ' : selectedLanguage === 'hi' ? 'मोबाइल नंबर' : 'Mobile Number'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.inputLabel}>
            {authMode === 'abha'
              ? selectedLanguage === 'kn'
                ? 'ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಆಭಾ ವಿಳಾಸ'
                : selectedLanguage === 'hi'
                ? 'आयुष्मान भारत आभा पता'
                : 'AYUSHMAN BHARAT ABHA ADDRESS'
              : selectedLanguage === 'kn'
              ? 'ನೋಂದಾಯಿತ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ'
              : selectedLanguage === 'hi'
              ? 'पंजीकृत मोबाइल नंबर'
              : 'REGISTERED MOBILE NUMBER'}
          </Text>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            style={styles.textInput}
            placeholder={authMode === 'abha' ? 'e.g. 91-4820-1928-1120@abdm' : '9845012345'}
            placeholderTextColor={WarmClinicTheme.colors.outline}
          />
        </View>

        {showOtpField && (
          <View style={styles.fieldWrapper}>
            <Text style={styles.inputLabel}>
              {selectedLanguage === 'kn' ? '6-ಅಂಕಿಯ OTP ನಮೂದಿಸಿ' : selectedLanguage === 'hi' ? '6-अंकीय OTP दर्ज करें' : 'ENTER 6-DIGIT OTP'}
            </Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              style={[styles.textInput, styles.otpInput]}
              placeholder="123456"
              placeholderTextColor={WarmClinicTheme.colors.outline}
            />
            <Text style={styles.otpHelper}>Demo OTP automatically set to 123456</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsCol}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleContinue}
          disabled={loading}
          style={styles.primaryBtn}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>
                {showOtpField
                  ? selectedLanguage === 'kn'
                    ? 'ದೃಢೀಕರಿಸಿ & ಪ್ರವೇಶಿಸಿ'
                    : selectedLanguage === 'hi'
                    ? 'सत्यापित करें और लॉगिन'
                    : 'Verify & Sign In'
                  : selectedLanguage === 'kn'
                  ? 'ಮುಂದುವರಿಯಿರಿ'
                  : selectedLanguage === 'hi'
                  ? 'आगे बढ़ें'
                  : 'Continue with ABHA'}
              </Text>
              <Text style={{ fontSize: 18, color: '#FFFFFF' }}>→</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleQuickDemoFill}
          style={styles.demoQuickBtn}
        >
          <Text style={styles.demoQuickIcon}>⚡</Text>
          <Text style={styles.demoQuickText}>
            {selectedLanguage === 'kn'
              ? 'ತ್ವರಿತ ಲಾಗಿನ್: ರಮೇಶ್ ಗೌಡ (ರೈತ, ಹಾಸನ)'
              : selectedLanguage === 'hi'
              ? 'त्वरित लॉगिन: रमेश गौड़ा (किसान, हासन)'
              : 'Demo 1-Click: Ramesh Gowda (Agriculture)'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D1D6',
  },
  stepBar: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D1D6',
  },
  stepDotActive: {
    backgroundColor: '#007AFF',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: WarmClinicTheme.radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  langIcon: {
    fontSize: 12,
  },
  langText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  archFrameContainer: {
    width: '100%',
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  heroArchImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  signInTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.6,
  },
  kannadaSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  listenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: WarmClinicTheme.radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  listenPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
  },
  trustGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  trustTile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  trustCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  trustText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#636366',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF3B30',
    textAlign: 'center',
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: 10,
    padding: 2,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  toggleBtnTextActive: {
    fontWeight: '700',
    color: '#1C1C1E',
  },
  fieldWrapper: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  textInput: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 18,
    letterSpacing: 6,
    fontWeight: '800',
  },
  otpHelper: {
    fontSize: 10,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 2,
  },
  actionsCol: {
    gap: 8,
    marginTop: 2,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  demoQuickBtn: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  demoQuickIcon: {
    fontSize: 14,
  },
  demoQuickText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
});
