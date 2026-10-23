import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

export interface PatientAppointmentInfo {
  date: string;
  time: string;
  relativeTime?: string;
  doctorName?: string;
  clinic?: string;
  wait?: string;
  agenda?: string;
  isRescheduled?: boolean;
}

interface HeroAppointmentCardProps {
  onJoinCall: () => void;
  selectedLanguage: 'kn' | 'hi' | 'en';
  appointment?: PatientAppointmentInfo;
}

// Same portrait used on the video call screen
const DOCTOR_PHOTO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCNL4BMuLtJ2i8g6NTnwHeQCHuAOBoVH2a0-_LYQNHlpps-NYI7Zm0kJOS83_2mfT6iW0VmrLR_Ws1XWJQkqFvMdbLIdoytlvHdKWy4oymsMvJiix6ZCfnabbIW2pz4OVbBjAvjRwZlJrf3ptnODgtdPMIvvwU5TOI47tgVHvDdfaHFPeZZKaZ1uf0iQ6sHQIuhtUA6yt256idRVh9J47qEBF8ZhGzRWVzPeff2xX0xQ_aOPSGolBYQfw';

export const HeroAppointmentCard: React.FC<HeroAppointmentCardProps> = ({
  onJoinCall,
  selectedLanguage,
  appointment,
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const isRescheduled = appointment?.isRescheduled;
  const displayTime = appointment?.time || '—';
  const displayDate = appointment?.date || 'No appointment booked';
  const displayDoctor = appointment?.doctorName || 'No doctor assigned yet';
  const displayClinic = appointment?.clinic || 'Describe your symptoms to join the queue';

  const getButtonLabel = () => {
    if (selectedLanguage === 'kn') return 'ವೀಡಿಯೊ ಕರೆಗೆ ಸೇರಿ (Join Call)';
    if (selectedLanguage === 'hi') return 'वीडियो कॉल से जुड़ें (Join Call)';
    return 'Join Consultation Call';
  };

  const getRescheduledNotice = () => {
    if (selectedLanguage === 'kn') return 'ವೈದ್ಯರಿಂದ ಮರುಹೊಂದಿಸಲಾಗಿದೆ';
    if (selectedLanguage === 'hi') return 'डॉक्टर द्वारा पुनर्निर्धारित';
    return 'Rescheduled by Clinician';
  };

  return (
    <View style={[styles.cardContainer, isRescheduled && styles.cardContainerRescheduled]}>
      {isRescheduled && (
        <View style={styles.rescheduledBanner}>
          <Text style={styles.rescheduledIcon}>🔄</Text>
          <Text style={styles.rescheduledText}>{getRescheduledNotice()}</Text>
          <View style={styles.rescheduledDateBadge}>
            <Text style={styles.rescheduledDateText}>{displayDate}</Text>
          </View>
        </View>
      )}

      <View style={styles.topRow}>
        <View style={styles.doctorAvatarContainer}>
          {avatarFailed ? (
            <Text style={styles.doctorAvatarFallback}>👩‍⚕️</Text>
          ) : (
            <Image
              source={{ uri: DOCTOR_PHOTO_URL }}
              style={styles.doctorAvatar}
              onError={() => setAvatarFailed(true)}
            />
          )}
        </View>

        <View style={styles.metaColumn}>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{displayTime}</Text>
            {isRescheduled && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW TIME</Text>
              </View>
            )}
          </View>
          <Text style={styles.doctorName} numberOfLines={1}>
            {displayDoctor}
          </Text>
          <Text style={styles.clinicSubtitle} numberOfLines={2}>
            {displayClinic}
          </Text>
        </View>

        <View style={[styles.timerBadge, isRescheduled && styles.timerBadgeRescheduled]}>
          <Text style={[styles.timerNumber, isRescheduled && styles.timerNumberRescheduled]}>
            {isRescheduled ? 'NEW' : appointment?.wait || '—'}
          </Text>
          <Text style={[styles.timerSub, isRescheduled && styles.timerSubRescheduled]}>
            {isRescheduled ? 'TIME' : 'WAIT'}
          </Text>
        </View>
      </View>

      {/* Appointment Date and Agenda Pill */}
      <View style={styles.detailsPill}>
        <Text style={styles.calendarIcon}>📅</Text>
        <Text style={styles.detailsDateText}>{displayDate}</Text>
        <Text style={styles.detailsDot}>•</Text>
        <Text style={styles.detailsAgendaText} numberOfLines={1}>
          {appointment?.agenda || '—'}
        </Text>
      </View>

      {/* Main Join CTA Button */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onJoinCall}
        style={styles.joinButton}
      >
        <Text style={styles.joinButtonIcon}>📹</Text>
        <Text style={styles.joinButtonText} numberOfLines={1} adjustsFontSizeToFit>
          {getButtonLabel()}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    gap: 10,
  },
  cardContainerRescheduled: {
    borderColor: 'rgba(0, 122, 255, 0.3)',
    backgroundColor: '#FAFCFF',
  },
  rescheduledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    alignSelf: 'flex-start',
  },
  rescheduledIcon: {
    fontSize: 12,
  },
  rescheduledText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
  },
  rescheduledDateBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  rescheduledDateText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorAvatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
    borderWidth: 1.5,
    borderColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorAvatar: {
    width: '100%',
    height: '100%',
  },
  doctorAvatarFallback: {
    fontSize: 28,
  },
  metaColumn: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  newBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#248A3D',
  },
  doctorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 1,
  },
  clinicSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 1,
  },
  timerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBadgeRescheduled: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
  timerNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FF9500',
  },
  timerNumberRescheduled: {
    color: '#007AFF',
  },
  timerSub: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FF9500',
    letterSpacing: 0.5,
  },
  timerSubRescheduled: {
    color: '#007AFF',
  },
  detailsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },
  calendarIcon: {
    fontSize: 12,
  },
  detailsDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  detailsDot: {
    fontSize: 10,
    color: '#8E8E93',
  },
  detailsAgendaText: {
    fontSize: 11,
    color: '#636366',
    flex: 1,
  },
  joinButton: {
    height: 48,
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
  joinButtonIcon: {
    fontSize: 18,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
