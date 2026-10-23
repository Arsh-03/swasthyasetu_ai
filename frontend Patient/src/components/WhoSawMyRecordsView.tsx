import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { AppleTheme } from '../theme/tokens';
import { patientApi, type ConsentHistoryItem } from '../services/api';

interface AccessLog {
  id: string;
  doctor: string;
  reg: string;
  facility: string;
  record: string;
  purpose: string;
  time: string;
  active: boolean;
  remaining: string;
}

const STATUS_LABELS: Record<ConsentHistoryItem['status'], string> = {
  approved: 'Active',
  requested: 'Awaiting your approval',
  expired: 'Expired',
  revoked: 'Revoked by Patient',
  declined: 'Declined',
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const toAccessLog = (c: ConsentHistoryItem): AccessLog => ({
  id: c.consent_id,
  doctor: c.doctor,
  reg: c.reg,
  facility: c.facility,
  record: c.record,
  purpose: c.purpose,
  time: formatTime(c.created_at),
  active: c.active,
  remaining: c.active && c.remaining ? c.remaining : STATUS_LABELS[c.status] || c.status,
});

interface WhoSawMyRecordsViewProps {
  onBack: () => void;
  backLabel?: string;
  selectedLanguage: 'kn' | 'hi' | 'en';
}

export const WhoSawMyRecordsView: React.FC<WhoSawMyRecordsViewProps> = ({
  onBack,
  backLabel = 'Home',
  selectedLanguage,
}) => {
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const load = () =>
    patientApi
      .getConsentHistory()
      .then((rows) => {
        setAccessLogs(rows.map(toAccessLog));
        setStatus('ready');
      })
      .catch(() => setStatus('error'));

  useEffect(() => {
    load();
  }, []);

  const handleRevoke = async (id: string) => {
    setRevokeError(null);
    try {
      await patientApi.revokeConsent(id);
      await load();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Could not revoke access');
    }
  };

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
          <Text style={styles.backLabel}>{backLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* Apple Health Large Title */}
      <View style={styles.headerBlock}>
        <Text style={styles.largeTitle}>Privacy Report</Text>
        <Text style={styles.headerSubtitle}>
          {selectedLanguage === 'kn'
            ? 'ದಾಖಲೆ ಪ್ರವೇಶ ಇತಿಹಾಸ (DPDP Act 2023)'
            : 'DPDP Act 2023 Sovereign Consent Ledger'}
        </Text>
      </View>

      {/* Apple Data & Privacy Notice Card */}
      <View style={styles.privacyNoticeCard}>
        <View style={styles.shieldIconCircle}>
          <Text style={{ fontSize: 22 }}>🛡️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>Your Data. Your Control.</Text>
          <Text style={styles.noticeBody}>
            Under Section 6 of the DPDP Act 2023, access granted to healthcare practitioners is purpose-limited, time-bound, and immediately revokable.
          </Text>
        </View>
      </View>

      {/* Access Logs Inset Group */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeader}>DOCTOR ACCESS LOGS ({accessLogs.length})</Text>

        {revokeError && <Text style={styles.doctorReg}>{revokeError}</Text>}
        {accessLogs.length === 0 && (
          <Text style={styles.doctorReg}>
            {status === 'loading'
              ? 'Loading access history…'
              : status === 'error'
              ? 'Could not load access history. Check your connection.'
              : 'No doctor has requested access to your records yet.'}
          </Text>
        )}

        <View style={styles.logsGroup}>
          {accessLogs.map((log, index) => (
            <React.Fragment key={log.id}>
              <View style={styles.logCard}>
                {/* Doctor Header */}
                <View style={styles.doctorHeaderRow}>
                  <View style={styles.doctorAvatar}>
                    <Text style={{ fontSize: 20 }}>👩‍⚕️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.doctorName}>{log.doctor}</Text>
                    <Text style={styles.doctorReg}>
                      {log.reg} • {log.facility}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      log.active ? styles.statusPillActive : styles.statusPillExpired,
                    ]}
                  >
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: log.active
                            ? AppleTheme.colors.systemGreen
                            : AppleTheme.colors.tertiaryLabel,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        log.active && { color: AppleTheme.colors.systemGreenDark },
                      ]}
                    >
                      {log.active
                        ? 'ACTIVE'
                        : log.remaining === 'Revoked by Patient'
                        ? 'REVOKED'
                        : 'EXPIRED'}
                    </Text>
                  </View>
                </View>

                {/* Scope & Purpose */}
                <View style={styles.scopeBox}>
                  <View style={styles.scopeRow}>
                    <Text style={styles.scopeLabel}>Record</Text>
                    <Text style={styles.scopeValue}>{log.record}</Text>
                  </View>
                  <View style={styles.scopeRow}>
                    <Text style={styles.scopeLabel}>Purpose</Text>
                    <Text style={styles.purposeText}>"{log.purpose}"</Text>
                  </View>
                </View>

                {/* Footer with Timestamp and Instant Revoke */}
                <View style={styles.cardFooter}>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeText}>⏱️ {log.time}</Text>
                    <Text
                      style={[
                        styles.remainingText,
                        log.active && { color: AppleTheme.colors.systemGreenDark },
                      ]}
                    >
                      {log.remaining}
                    </Text>
                  </View>

                  {log.active && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleRevoke(log.id)}
                      style={styles.revokeButton}
                    >
                      <Text style={styles.revokeText}>Revoke Access</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              {index < accessLogs.length - 1 && <View style={styles.rowDivider} />}
            </React.Fragment>
          ))}
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
  privacyNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: AppleTheme.colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 0.5,
    borderColor: AppleTheme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  shieldIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: AppleTheme.colors.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  },
  noticeBody: {
    fontSize: 12,
    color: AppleTheme.colors.secondaryLabel,
    lineHeight: 18,
    marginTop: 3,
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
  logsGroup: {
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
  logCard: {
    padding: 18,
    gap: 12,
  },
  doctorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  doctorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '600',
    color: AppleTheme.colors.label,
  },
  doctorReg: {
    fontSize: 12,
    color: AppleTheme.colors.secondaryLabel,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  statusPillExpired: {
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppleTheme.colors.secondaryLabel,
  },
  scopeBox: {
    backgroundColor: AppleTheme.colors.systemGroupedBackground,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  scopeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: AppleTheme.colors.secondaryLabel,
    width: 55,
  },
  scopeValue: {
    fontSize: 12,
    fontWeight: '600',
    color: AppleTheme.colors.label,
    flex: 1,
  },
  purposeText: {
    fontSize: 12,
    color: AppleTheme.colors.secondaryLabel,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 2,
  },
  timeColumn: {
    flex: 1,
    gap: 2,
  },
  timeText: {
    fontSize: 11,
    color: AppleTheme.colors.tertiaryLabel,
  },
  remainingText: {
    fontSize: 11,
    fontWeight: '600',
    color: AppleTheme.colors.secondaryLabel,
  },
  revokeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  revokeText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppleTheme.colors.systemRed,
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: AppleTheme.colors.separator,
  },
});
