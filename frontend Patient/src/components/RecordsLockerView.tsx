import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { AppleTheme } from '../theme/tokens';
import { patientApi, type HealthRecord } from '../services/api';

interface LockerRecord {
  id: string;
  title: string;
  category: 'diagnostic' | 'lab';
  facility: string;
  date: string;
  icon: string;
  status: string;
  active: boolean;
  size: string;
}

const formatSize = (bytes: number, mime: string) => {
  const size =
    bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const kind = mime.includes('dicom') ? 'DICOM' : mime.includes('json') ? 'FHIR JSON' : mime.includes('pdf') ? 'PDF' : mime;
  return `${size} • ${kind}`;
};

const minutesLeft = (iso: string | null) => {
  if (!iso) return null;
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  return mins > 0 ? `${mins}m left` : null;
};

const toLockerRecord = (r: HealthRecord): LockerRecord => {
  const isLab = r.category === 'lab';
  const left = minutesLeft(r.consent_expires_at);
  const shared = !!r.shared_with && !!left;
  return {
    id: r.record_id,
    title: r.title,
    category: isLab ? 'lab' : 'diagnostic',
    facility: r.facility || 'ABDM linked facility',
    date: r.date_str,
    icon: isLab ? '🧪' : r.record_type.includes('discharge') ? '📄' : '🩺',
    status: shared ? `Shared with ${r.shared_with} (${left})` : 'Encrypted Vault',
    active: shared,
    size: formatSize(r.file_size_bytes, r.file_mime_type),
  };
};

interface RecordsLockerViewProps {
  patientId: string;
  onBack: () => void;
  onOpenAudit: () => void;
  selectedLanguage: 'kn' | 'hi' | 'en';
}

export const RecordsLockerView: React.FC<RecordsLockerViewProps> = ({
  patientId,
  onBack,
  onOpenAudit,
  selectedLanguage,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'diagnostic' | 'lab'>('all');

  const [records, setRecords] = useState<LockerRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    patientApi
      .getPatientRecords(patientId)
      .then((rows) => {
        if (cancelled) return;
        setRecords(rows.map(toLockerRecord));
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const filteredRecords = activeFilter === 'all'
    ? records
    : records.filter((r) => r.category === activeFilter);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* iOS Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onBack}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onOpenAudit}
          style={styles.auditNavBtn}
        >
          <Text style={styles.auditNavText}>Privacy Log</Text>
        </TouchableOpacity>
      </View>

      {/* Apple Health Large Title */}
      <View style={styles.headerBlock}>
        <Text style={styles.largeTitle}>Health Records</Text>
        <Text style={styles.headerSubtitle}>
          {selectedLanguage === 'kn'
            ? 'ಎನ್‌ಕ್ರಿಪ್ಟ್ ಮಾಡಲಾದ ಆಯುಷ್ಮಾನ್ ಭಾರತ ದಾಖಲೆಗಳು'
            : 'ABDM FHIR R4 Encrypted Health Locker'}
        </Text>
      </View>

      {/* iOS Segmented Filter Control */}
      <View style={styles.segmentedContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveFilter('all')}
          style={[styles.segmentBtn, activeFilter === 'all' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, activeFilter === 'all' && styles.segmentTextActive]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveFilter('diagnostic')}
          style={[styles.segmentBtn, activeFilter === 'diagnostic' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, activeFilter === 'diagnostic' && styles.segmentTextActive]}>
            Imaging
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveFilter('lab')}
          style={[styles.segmentBtn, activeFilter === 'lab' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, activeFilter === 'lab' && styles.segmentTextActive]}>
            Lab Reports
          </Text>
        </TouchableOpacity>
      </View>

      {/* Records List (Inset Grouped) */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeader}>CLINICAL DOCUMENTS ({filteredRecords.length})</Text>

        {filteredRecords.length === 0 && (
          <Text style={styles.recMeta}>
            {status === 'loading'
              ? 'Loading your records…'
              : status === 'error'
              ? 'Could not load records. Check your connection.'
              : 'No records in this category yet.'}
          </Text>
        )}

        <View style={styles.recordsList}>
          {filteredRecords.map((r, index) => (
            <React.Fragment key={r.id}>
              <TouchableOpacity activeOpacity={0.7} style={styles.recordRow}>
                <View style={styles.iconBox}>
                  <Text style={{ fontSize: 22 }}>{r.icon}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.recTitle}>{r.title}</Text>
                  <Text style={styles.recMeta}>{r.facility} • {r.date}</Text>

                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusPill,
                        r.active ? styles.statusPillActive : styles.statusPillLocked,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: r.active
                              ? AppleTheme.colors.systemGreen
                              : AppleTheme.colors.tertiaryLabel,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusLabel,
                          r.active && { color: AppleTheme.colors.systemGreenDark },
                        ]}
                      >
                        {r.status}
                      </Text>
                    </View>
                    <Text style={styles.sizeText}>{r.size}</Text>
                  </View>
                </View>

                <Text style={styles.disclosureChevron}>›</Text>
              </TouchableOpacity>
              {index < filteredRecords.length - 1 && <View style={styles.rowDivider} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* ABDM Security Trust Banner */}
      <View style={styles.trustBanner}>
        <Text style={{ fontSize: 20 }}>🔒</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.trustTitle}>256-bit AES End-to-End Encrypted</Text>
          <Text style={styles.trustSub}>
            Records cannot be accessed by anyone without your explicit biometric or OTP authorization.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 18,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backChevron: {
    fontSize: 28,
    color: AppleTheme.colors.systemBlue,
    fontWeight: '300',
    marginTop: -2,
  },
  backLabel: {
    fontSize: 17,
    color: AppleTheme.colors.systemBlue,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  auditNavBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: AppleTheme.colors.systemBackground,
    borderWidth: 0.5,
    borderColor: AppleTheme.colors.separator,
  },
  auditNavText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppleTheme.colors.systemBlue,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  headerBlock: {
    gap: 4,
  },
  largeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: AppleTheme.colors.label,
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'System',
  },
  headerSubtitle: {
    fontSize: 14,
    color: AppleTheme.colors.secondaryLabel,
    fontWeight: '400',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    padding: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: AppleTheme.colors.secondaryLabel,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  segmentTextActive: {
    color: AppleTheme.colors.label,
    fontWeight: '600',
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: AppleTheme.colors.secondaryLabel,
    letterSpacing: 0.6,
    paddingLeft: 4,
  },
  recordsList: {
    backgroundColor: AppleTheme.colors.card,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: AppleTheme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: AppleTheme.colors.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  recMeta: {
    fontSize: 12,
    color: AppleTheme.colors.secondaryLabel,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  statusPillLocked: {
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: AppleTheme.colors.secondaryLabel,
  },
  sizeText: {
    fontSize: 10,
    color: AppleTheme.colors.tertiaryLabel,
  },
  disclosureChevron: {
    fontSize: 22,
    color: AppleTheme.colors.tertiaryLabel,
    fontWeight: '300',
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: AppleTheme.colors.separator,
    marginLeft: 74,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 122, 255, 0.15)',
  },
  trustTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: AppleTheme.colors.label,
  },
  trustSub: {
    fontSize: 11,
    color: AppleTheme.colors.secondaryLabel,
    lineHeight: 16,
    marginTop: 2,
  },
});
