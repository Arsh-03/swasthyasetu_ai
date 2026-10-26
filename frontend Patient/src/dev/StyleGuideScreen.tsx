import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography, type Tone, type TypeVariant } from '../theme/tokens';
import { palette, type PaletteKey } from '../theme/palette';
import { contrastRatio, evaluate } from '../theme/contrast';
import { CONTRAST_PAIRS } from '../theme/contrastPairs';
import { duration } from '../theme/motion';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES, LANGUAGE_NAMES, t as translate } from '../utils/translations';
import { GlassCard, GlassSurface, TabItem } from '../components/glass';
import {
  AppText,
  AudioListenButton,
  Badge,
  Card,
  Chip,
  ChoiceTiles,
  CriticalButton,
  DestructiveButton,
  ExpandableText,
  Icon,
  ICON_NAMES,
  IconButton,
  IconDisc,
  IconTile,
  LIST_ROW_TEXT_INSET,
  ListRow,
  MetricCard,
  NavBar,
  NeuInset,
  NeuList,
  NeuPanel,
  NeuTile,
  NeuToggle,
  NeuView,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  SegmentedControl,
  StatusChip,
  TertiaryButton,
  TextField,
  Well,
} from '../components/ui';
import { AmbientBackground, ILLUSTRATIONS } from '../components/illustrations';
import { SignInError } from '../components/PatientLoginView';
import { ConsentCard } from '../components/WhoSawMyRecordsView';
import type { ConsentHistoryItem } from '../services/api';
import { AppointmentTime, RelativeBadge } from '../components/HeroAppointmentCard';
import { HeaderBar, headerLayout } from '../components/PatientHeader';
import { formatLongDate, formatDateLabel, formatTimestamp, daysAgoKey, inDaysKey } from '../utils/dates';
import { hasLanguage, localized, type LocalizedText } from '../utils/localized';
import { DoseButton } from '../components/CarePlanView';

// Fixed reference time for the relative-badge samples: Sun 25 Oct 2026, 09:30 IST

const GUIDE_CONSENT_BASE = {
  doctor: 'Dr. Ananya Sharma',
  reg: 'KMC-48213',
  facility: { en: 'Taluk Hospital, Hosakote' },
  record: { en: 'Ultrasound Pelvis & Abdomen' },
  purpose: { en: 'Evaluating suspected renal calculus' },
  remaining: null,
  created_at: '2026-09-14T05:02:00Z',
} as const;

const inMinutes = (m: number) => new Date(Date.now() + m * 60000).toISOString();

const GUIDE_CONSENTS: ConsentHistoryItem[] = [
  { ...GUIDE_CONSENT_BASE, consent_id: 'g1', status: 'approved', active: true, expires_at: inMinutes(42) },
  { ...GUIDE_CONSENT_BASE, consent_id: 'g2', doctor: 'Dr. Rahul Iyer', status: 'approved', active: true, expires_at: inMinutes(180) },
  { ...GUIDE_CONSENT_BASE, consent_id: 'g3', status: 'revoked', active: false, expires_at: null },
  { ...GUIDE_CONSENT_BASE, consent_id: 'g4', status: 'expired', active: false, expires_at: null },
  { ...GUIDE_CONSENT_BASE, consent_id: 'g5', facility: { en: '' }, status: 'declined', active: false, expires_at: null },
];

const GUIDE_NOW = new Date('2026-10-25T04:00:00Z');
// Greeting-date sample (Sunday 25 October 2026)
const GUIDE_DATE = { year: 2026, month: 9, day: 25 };
const GUIDE_TILES = [
  { value: 'myDoctors', label: 'myDoctorsCaption', icon: 'doctor', tone: 'primary' },
  { value: 'myRecords', label: 'myRecordsCaption', icon: 'records', tone: 'primary' },
  { value: 'medicines', label: 'medicinesCaption', icon: 'medication', tone: 'success' },
  { value: 'followUp', label: 'followUpCaption', icon: 'calendar', tone: 'warning' },
] as const;

const GUIDE_WIDTHS = [320, 360, 390] as const;
const GUIDE_FEELINGS = [
  { value: 'better', label: 'feelingBetter', icon: 'feelingBetter', tone: 'success' },
  { value: 'same', label: 'feelingSame', icon: 'feelingSame', tone: 'primary' },
  { value: 'worse', label: 'feelingWorse', icon: 'help', tone: 'danger' },
] as const;
// Backend display text: full / partial / plain-string / single-language samples
const GUIDE_LOCALIZED: { label: string; value: LocalizedText }[] = [
  {
    label: 'Agenda, all three languages',
    value: { en: 'Review blood sugar report', kn: 'ರಕ್ತದ ಸಕ್ಕರೆ ವರದಿ ಪರಿಶೀಲನೆ', hi: 'ब्लड शुगर रिपोर्ट की समीक्षा' },
  },
  { label: 'Dose instruction, kn missing', value: { en: '1 tablet • after food', hi: '1 गोली • खाने के बाद' } },
  { label: 'Clinic name, plain string (today)', value: 'Hassan District Hospital' },
  { label: 'Record title, kn only (no en)', value: { kn: 'ಹೊಟ್ಟೆಯ ಅಲ್ಟ್ರಾಸೌಂಡ್' } },
];
const GUIDE_MED = {
  name: 'Paracetamol 650mg',
  nameLocal: { kn: 'ಪ್ಯಾರಸಿಟಮಾಲ್', hi: 'पैरासिटामोल' } as LocalizedText,
  dosage: { en: '1 tablet', kn: '1 ಮಾತ್ರೆ', hi: '1 गोली' } as LocalizedText,
};
const GUIDE_AGENDA =
  'Follow-up: review kidney stone pain, repeat ultrasound findings, adjust pain relief and hydration plan, and discuss whether a urology referral is needed before the next visit.';

/**
 * Development-only design reference (long-press the brand mark in a __DEV__ build).
 * Everything renders from the real tokens and components.
 */
export const StyleGuideScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { lang, cycleLang, t } = useLanguage();
  const [toggleA, setToggleA] = useState(true);
  const [toggleB, setToggleB] = useState(false);
  const [chip, setChip] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [auth, setAuth] = useState<'abha' | 'mobile'>('abha');
  const [dose, setDose] = useState(false);
  const [feeling, setFeeling] = useState<'better' | 'same' | 'worse'>('worse');
  const [row, setRow] = useState(0);
  const [text, setText] = useState('91-4820-1928-1120@abdm');
  const [otp, setOtp] = useState('123456');
  const [notes, setNotes] = useState('Severe flank colic on right side for 3 days');
  const pairs = CONTRAST_PAIRS.map(evaluate);

  return (
    <View style={styles.screen}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxxl }]}>
        <NavBar
          backLabel="Close"
          onBack={onClose}
          right={<SecondaryButton size="sm" tone="primary" icon="translate" label={LANGUAGE_NAMES[lang]} onPress={cycleLang} />}
        />
        <AppText variant="largeTitle">Style Guide · Harbor Calm</AppText>
        <AppText variant="footnote" color="inkMuted">
          Dev only. Tokens: src/theme. Spec: docs/05_ui_ux/design_system_tokens.md. RAISED = press it · INSET = it holds or shows something.
        </AppText>

        {/* Regression: every depth primitive must show its content (icons, text, input values) */}
        <Section title="Content visibility">
          <AppText variant="footnote" color="inkMuted">
            Every primitive below must show its glyph, text or value. Empty discs or wells = a stacking regression (see depth.layer /
            depth.stack in ui/Neu.tsx).
          </AppText>
          {([38, 46, 56] as const).map((size) => (
            <View key={size} style={styles.visRow}>
              {(['primary', 'success', 'warning', 'danger', 'gold', 'neutral'] as Tone[]).map((tone) => (
                <View key={tone} style={styles.visPair}>
                  <IconDisc icon="shieldCheck" tone={tone} size={size} variant="raised" />
                  <IconDisc icon="lock" tone={tone} size={size} variant="inset" />
                </View>
              ))}
            </View>
          ))}
          <View style={styles.wrapRow}>
            <IconTile domain="records" size={40} />
            <IconTile domain="emergency" size={40} />
            <IconButton icon="close" accessibilityLabel="Close" onPress={() => {}} size={40} />
            <IconButton icon="signOut" tone="danger" accessibilityLabel="Sign out" onPress={() => {}} size={40} />
            <IconButton icon="mic" accessibilityLabel="Mic on" onPress={() => {}} size={44} selected />
          </View>
          <TextField label="Placeholder only" icon="idCard" value="" onChangeText={() => {}} placeholder="e.g. 91-4820-1928-1120@abdm" />
          <TextField label="With value" icon="mobile" value="9845012345" onChangeText={() => {}} />
          <TextField label="OTP" icon="key" value="123456" onChangeText={() => {}} otp />
          <NeuPanel>
            <AppText variant="headline">NeuPanel text</AppText>
            <AppText variant="footnote" color="inkMuted">
              Secondary text inside a soft raised panel.
            </AppText>
          </NeuPanel>
          <NeuList grooveInset={LIST_ROW_TEXT_INSET}>
            <ListRow icon="morning" iconTone="success" title="Grooved row one" subtitle="Leading inset disc + text" onPress={() => {}} />
            <ListRow icon="night" title="Grooved row two" subtitle="Selected (accent bar)" selected onPress={() => {}} />
          </NeuList>
          <View style={styles.tabRow}>
            <TabItem label="Today" icon="home" active onPress={() => {}} />
            <TabItem label="Records" icon="records" active={false} onPress={() => {}} />
          </View>
          <View style={styles.wrapRow}>
            <PrimaryButton label="Sign in" icon="signIn" onPress={() => {}} />
            <Chip label="Fever" icon="fever" selected onPress={() => {}} />
            <Badge label="Verified" tone="gold" icon="verified" />
          </View>
        </Section>

        {/* Home review fixes */}
        <Section title="Header at narrow widths">
          {([320, 360, 390, 430] as const).map((w) => (
            <View key={w} style={styles.headerSample}>
              <AppText variant="mono" color="inkMuted">
                {w}px
              </AppText>
              {/* True device width (the toolbar spans the screen), scrollable inside the guide */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <GlassSurface material="toolbar" style={[styles.headerBox, { width: w }]}>
                  <HeaderBar user={null} onOpenProfile={() => {}} onLogout={() => {}} availableWidth={w} />
                </GlassSurface>
              </ScrollView>
            </View>
          ))}
          <AppText variant="footnote" color="inkMuted">
            Large font scale (1.3×) at 390px behaves like 300px (mark only, short pill): {JSON.stringify(headerLayout(390, 1.3))}
          </AppText>
        </Section>

        <Section title="Appointment time · relative badge · agenda">
          <View style={styles.timeBox}>
            <AppointmentTime label="10:30 AM IST" />
          </View>
          <View style={styles.wrapRow}>
            <RelativeBadge date="Tomorrow, 23 Oct 2026" time="10:30 AM IST" now={GUIDE_NOW} />
            <RelativeBadge date="24 Oct 2026" time="10:30 AM IST" now={GUIDE_NOW} />
            <RelativeBadge date="25 Oct 2026" time="09:00 AM IST" now={GUIDE_NOW} />
            <RelativeBadge date="25 Oct 2026" time="04:00 PM IST" now={GUIDE_NOW} />
            <RelativeBadge date="Monday, 26 Oct 2026" time="11:15 AM IST" now={GUIDE_NOW} />
            <RelativeBadge date="30 Oct 2026" now={GUIDE_NOW} />
            <RelativeBadge date="Pending 2027" fallback="Backend text (unparsable date)" now={GUIDE_NOW} />
          </View>
          <AppText variant="caption" color="inkMuted">
            Fixed “now” for these samples: Sun 25 Oct 2026, 09:30 IST.
          </AppText>
          <AppText variant="caption" color="inkMuted">
            {[1, 3].map((n) => `${t(daysAgoKey(n), { n })} / ${t(inDaysKey(n), { n })}`).join(' · ')}
          </AppText>
          <NeuPanel>
            <ExpandableText variant="subhead" weight={600}>{GUIDE_AGENDA}</ExpandableText>
          </NeuPanel>
          <NeuPanel>
            <ExpandableText variant="subhead" weight={600} initiallyExpanded>
              {GUIDE_AGENDA}
            </ExpandableText>
          </NeuPanel>
        </Section>

        <Section title="Mixed-script text and Indic caption floor">
          {[
            'ನಮಸ್ಕಾರ, Ramesh',
            'ಶುಕ್ರವಾರ, 23 ಅಕ್ಟೋಬರ್ 2026 · 10:30 AM IST',
            'Dr. Ananya Sharma · Hassan District Hub',
            'नमस्ते, Ramesh',
            'आपकी अगली अपॉइंटमेंट शुक्रवार, 23 अक्टूबर 2026, 10:30 AM IST',
            'ಆಂಬ್ಯುಲೆನ್ಸ್ 108 / 112',
          ].map((sample) => (
            <AppText key={sample} variant="headline">
              {sample}
            </AppText>
          ))}
          <AppText variant="largeTitle">ನಮಸ್ಕಾರ, Ramesh</AppText>
          <AppText variant="largeTitle">नमस्ते, Ramesh</AppText>
          <View style={styles.wrapRow}>
            <AppText variant="eyebrow" color="inkMuted">
              NEXT APPOINTMENT
            </AppText>
            <AppText variant="eyebrow" color="inkMuted">
              ಮುಂದಿನ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್
            </AppText>
            <AppText variant="eyebrow" color="inkMuted">
              अगली अपॉइंटमेंट
            </AppText>
          </View>
          <AppText variant="caption" color="inkMuted">
            Indic eyebrows / captions: 14px floor × script multiplier, weight ≥ 500, no uppercase or tracking.
          </AppText>
        </Section>

        <Section title="Greeting date and quick-action tiles (equal height · 320 / 360 / 390)">
          {LANGUAGES.map((l) => (
            <View key={l} style={styles.errorLang}>
              <AppText variant="eyebrow" color="inkMuted" compact lang={l}>
                {formatLongDate(GUIDE_DATE, l, false)}
              </AppText>
              {GUIDE_WIDTHS.map((w) => (
                <View key={w} style={styles.errorLang}>
                  <AppText variant="caption" color="inkMuted">
                    {`${LANGUAGE_NAMES[l]} · ${w}px`}
                  </AppText>
                  {/* Screen width minus the gutters; scrolls sideways on narrower devices */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={[styles.tileBox, { width: w - 2 * spacing.gutter }]}>
                      {[0, 2].map((start) => (
                        <View key={start} style={styles.tileRow}>
                          {GUIDE_TILES.slice(start, start + 2).map((tile) => (
                            <MetricCard
                              key={tile.value}
                              layout="stacked"
                              compact
                              equalHeight
                              label={translate(l, tile.label)}
                              value={translate(l, tile.value)}
                              icon={tile.icon}
                              tone={tile.tone}
                              onPress={() => {}}
                              style={styles.tile}
                            />
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ))}
            </View>
          ))}
          <AppText variant="caption" color="inkMuted">
            One long label (320px): both cards match the taller one; discs stay at the top and values line up.
          </AppText>
          <View style={styles.tileBox}>
            <View style={styles.tileRow}>
              <MetricCard
                layout="stacked"
                compact
                equalHeight
                label="Encrypted health locker"
                value="My Health Records Archive"
                icon="records"
                onPress={() => {}}
                style={styles.tile}
              />
              <MetricCard layout="stacked" compact equalHeight label="Video" value="Doctors" icon="doctor" onPress={() => {}} style={styles.tile} />
            </View>
          </View>
        </Section>

        {/* Equal-height choice tiles: 1-line and 2-line labels side by side, selected = inset */}
        <Section title="Feeling tiles: equal height, 1- and 2-line labels (320px)">
          {LANGUAGES.map((l) => (
            <View key={l} style={styles.errorLang}>
              <AppText variant="caption" color="inkMuted" lang={l}>
                {LANGUAGE_NAMES[l]}
              </AppText>
              <View style={styles.tileBox}>
                <ChoiceTiles
                  lang={l}
                  options={GUIDE_FEELINGS.map((f) => ({ ...f, label: translate(l, f.label) }))}
                  value={feeling}
                  onChange={setFeeling}
                />
              </View>
            </View>
          ))}
          <AppText variant="caption" color="inkMuted">
            At this screen&apos;s width:
          </AppText>
          {LANGUAGES.map((l) => (
            <ChoiceTiles
              key={l}
              lang={l}
              options={GUIDE_FEELINGS.map((f) => ({ ...f, label: translate(l, f.label) }))}
              value={feeling}
              onChange={setFeeling}
            />
          ))}
          <AppText variant="caption" color="inkMuted">
            Fallback: a label that would need 3 lines stacks the tiles vertically.
          </AppText>
          <View style={styles.tileBox}>
            <ChoiceTiles
              lang="en"
              options={[
                { value: 'better', label: 'Much better than yesterday', icon: 'feelingBetter', tone: 'success' },
                { value: 'same', label: 'About the same', icon: 'feelingSame', tone: 'primary' },
                { value: 'worse', label: 'I need help from my doctor', icon: 'help', tone: 'danger' },
              ]}
              value={feeling}
              onChange={setFeeling}
            />
          </View>
        </Section>

        {/* Sign-in error states, every language at once */}
        <Section title="Sign-in errors (network · rejected)">
          {LANGUAGES.map((l) => (
            <View key={l} style={styles.errorLang}>
              <AppText variant="eyebrow" color="inkMuted" compact>
                {LANGUAGE_NAMES[l]}
              </AppText>
              <SignInError kind="network" lang={l} />
              <SignInError kind="rejected" lang={l} />
            </View>
          ))}
        </Section>

        {/* Privacy screen consent cards (current app language) */}
        <Section title="Privacy: consent cards (active · revoked · expired · declined)">
          <AppText variant="footnote" color="inkMuted">
            Revoke here never calls the server: the first card fails as offline, the second as rejected.
          </AppText>
          {GUIDE_CONSENTS.map((log, i) => (
            <ConsentCard
              key={log.consent_id}
              log={log}
              onRevoked={() => {}}
              revokeFn={() => Promise.reject(i === 0 ? new TypeError('offline') : new Error('rejected'))}
            />
          ))}
        </Section>

        {/* Domain Colours */}
        <Section title="Domain Colours for Clinical Orientation">
          <AppText variant="footnote" color="inkMuted">
            6 semantic domains. Icon tiles = ~12% tint fill + duotone glyph in deep colour (≥ 3:1). Status chips = tinted pills with deep text (≥ 4.5:1).
          </AppText>
          <View style={styles.domainGrid}>
            {(
              [
                { domain: 'appointments', label: 'Appointments & Calls', action: 'Join call' },
                { domain: 'medications', label: 'Medications (Teal)', action: '1 tablet daily' },
                { domain: 'records', label: 'Records (Sand/Gold)', action: 'Ultrasound report' },
                { domain: 'privacy', label: 'Privacy & Consent (Navy)', action: 'Consent active' },
                { domain: 'followup', label: 'Follow-up (Amber)', action: 'Review due 2d' },
                { domain: 'emergency', label: 'Emergency (Red)', action: 'SOS triggered' },
              ] as const
            ).map((d) => (
              <Card key={d.domain} style={styles.domainCard}>
                <View style={styles.domainRow}>
                  <IconTile domain={d.domain} size={40} />
                  <View style={styles.flex}>
                    <AppText variant="subhead" weight={600}>
                      {d.label}
                    </AppText>
                    <AppText variant="mono" color="inkMuted">
                      domain=&quot;{d.domain}&quot;
                    </AppText>
                  </View>
                  <StatusChip domain={d.domain} label={d.action} />
                </View>
                <View style={styles.domainSizes}>
                  <IconTile domain={d.domain} size={32} />
                  <IconTile domain={d.domain} size={40} />
                  <IconTile domain={d.domain} size={48} />
                  <AppText variant="caption" color="inkMuted" style={styles.domainSizeLabel}>
                    32 · 40 · 48px
                  </AppText>
                </View>
              </Card>
            ))}
          </View>
        </Section>

        {/* Clean Surface System & Elevation */}
        <Section title="Clean Surface System & Elevation">
          <AppText variant="footnote" color="inkMuted">
            Pure white cards with 1px border (#DCE5EA) and single-layer elevation (e1, e2, e3). No neumorphic shadows or specular gradients.
          </AppText>
          <View style={styles.elevationRow}>
            <Card style={styles.elevationCard}>
              <AppText variant="subhead" weight={600}>e1 · Base Card</AppText>
              <AppText variant="caption" color="inkMuted">Static cards & containers</AppText>
            </Card>
            <Card interactive style={styles.elevationCard}>
              <AppText variant="subhead" weight={600}>e2 · Interactive</AppText>
              <AppText variant="caption" color="inkMuted">Lifts on press / focus</AppText>
            </Card>
            <Card elevated style={styles.elevationCard}>
              <AppText variant="subhead" weight={600}>e3 · Modal Sheet</AppText>
              <AppText variant="caption" color="inkMuted">Dialogs & overlays</AppText>
            </Card>
          </View>
        </Section>

        {/* Hero Block */}
        <Section title="Hero Block (Solid Primary-to-Ink Gradient)">
          <AppText variant="footnote" color="inkMuted">
            Next-appointment and patient banner blocks use a solid primary-to-ink gradient with white text (≥ 4.5:1).
          </AppText>
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <IconTile domain="appointments" size={48} />
              <View style={styles.flex}>
                <AppText variant="caption" color="onNightMuted" weight={600}>
                  NEXT APPOINTMENT · IN 15 MIN
                </AppText>
                <AppText variant="title2" color="onNight">
                  Dr. Ananya Sharma
                </AppText>
                <AppText variant="footnote" color="onNightMuted">
                  Taluk Hospital, Hosakote
                </AppText>
              </View>
            </View>
            <CriticalButton tone="primary" icon="video" label="Join Video Consultation" onPress={() => {}} />
          </View>
        </Section>

        {/* Header Patterns */}
        <Section title="Header Patterns">
          <AppText variant="footnote" color="inkMuted">
            Compact PageHeader (48-56px bar with back arrow) and SectionHeader (icon + domain + count + action).
          </AppText>
          <Card style={{ gap: spacing.md }}>
            <PageHeader title="Consultation Details" onBack={() => {}} />
            <SectionHeader
              title="Active Prescriptions"
              domain="medications"
              count={3}
              action={<SecondaryButton size="sm" label="Add Refill" onPress={() => {}} />}
            />
            <SectionHeader
              title="Medical Reports"
              domain="records"
              count={2}
            />
          </Card>
        </Section>

        <Section title="List-row actions stay compact (320 / 360 / 390px)">
          {([320, 360, 390] as const).map((w) => (
            <View key={w} style={styles.errorLang}>
              <AppText variant="mono" color="inkMuted">
                {w}px
              </AppText>
              {LANGUAGES.map((l) => (
                <View key={l} style={{ width: w - 2 * spacing.gutter }}>
                  <Card padded={false}>
                    {[false, true].map((taken) => (
                      <ListRow
                        key={String(taken)}
                        icon="morning"
                        iconTone="success"
                        title={GUIDE_MED.name}
                        subtitle={`${localized(GUIDE_MED.dosage, l)} • ${formatDateLabel('14 Sep 2026', l)}`}
                        trailing={
                          <DoseButton
                            taken={taken}
                            lang={l}
                            label={translate(l, taken ? 'taken' : 'take')}
                            accessibilityLabel={translate(l, 'markDoseTaken', { name: GUIDE_MED.name })}
                            onPress={() => {}}
                          />
                        }
                      >
                        <AppText variant="footnote" color="inkMuted" lang={l}>
                          {localized(GUIDE_MED.nameLocal, l)}
                        </AppText>
                        <Badge label={translate(l, 'slotMorning')} tone="success" icon="clock" />
                      </ListRow>
                    ))}
                  </Card>
                </View>
              ))}
            </View>
          ))}
          <AppText variant="caption" color="inkMuted">
            Take / Taken keep their own height (min 48) and sit centred in the row, however tall the text gets. Check large font
            scale by raising the device font size.
          </AppText>
        </Section>

        <Section title="Dates: one localised formatter">
          {LANGUAGES.map((l) => (
            <View key={l} style={styles.errorLang}>
              <AppText variant="caption" color="inkMuted">
                {LANGUAGE_NAMES[l]}
              </AppText>
              <AppText variant="subhead" lang={l}>
                {formatLongDate(GUIDE_DATE, l, false)}
              </AppText>
              <AppText variant="subhead" lang={l}>
                {formatDateLabel('14 Sep 2026', l)}
              </AppText>
              <AppText variant="subhead" lang={l}>
                {formatTimestamp('2026-09-14T05:02:00Z', l)}
              </AppText>
            </View>
          ))}
          <AppText variant="caption" color="inkMuted">
            Home header, appointment date, record date, audit-log timestamp (device time zone). Unparsable labels are shown as sent.
          </AppText>
        </Section>

        <Section title="Backend text: localised vs English fallback">
          {GUIDE_LOCALIZED.map((sample) => (
            <View key={sample.label} style={styles.errorLang}>
              <AppText variant="caption" color="inkMuted">
                {sample.label}
              </AppText>
              {LANGUAGES.map((l) => (
                <View key={l} style={styles.wrapRow}>
                  <AppText variant="mono" color="inkMuted">
                    {l}
                  </AppText>
                  <AppText variant="subhead" lang={l} style={styles.shrinkText}>
                    {localized(sample.value, l)}
                  </AppText>
                  {typeof sample.value !== 'string' && !hasLanguage(sample.value, l) && <Badge label="fallback" tone="warning" />}
                </View>
              ))}
            </View>
          ))}
          <AppText variant="caption" color="inkMuted">
            localized(value, lang): active language → English → any language with text. Drug names stay in Latin script; a
            nameLocal value is a secondary line. The app never translates clinical text itself.
          </AppText>
        </Section>

        <Section title="Panel, grooved lists, text well">
          <NeuPanel>
            <AppText variant="headline">Soft raised panel</AppText>
            <AppText variant="footnote" color="inkMuted">
              Grouped content. Controls inside it may be raised or inset (max two levels).
            </AppText>
          </NeuPanel>
          <SectionHeader title="Tappable list (raised panel, rows press to inset, selected = accent bar)" />
          <NeuList grooveInset={LIST_ROW_TEXT_INSET}>
            {['Paracetamol 650mg', 'Pantoprazole 40mg', 'Cetirizine 10mg'].map((name, i) => (
              <ListRow
                key={name}
                icon={i === 2 ? 'night' : 'morning'}
                iconTone={i === 2 ? 'primary' : 'success'}
                title={name}
                subtitle="1 tablet • after food"
                selected={row === i}
                onPress={() => setRow(i)}
                trailing={<Icon name="chevronRight" size={18} color={colors.inkMuted} />}
              />
            ))}
          </NeuList>
          <SectionHeader title="Read-only list (inset tray)" />
          <NeuList variant="tray" grooveInset={LIST_ROW_TEXT_INSET}>
            <ListRow icon="doctor" title="Dr. Ananya Sharma" subtitle={`Viewed: Ultrasound scan · ${formatTimestamp('2026-09-14T05:02:00Z', lang)}`} />
            <ListRow icon="doctor" title="Dr. Rahul Iyer" subtitle={`Requested: Lab report · ${formatTimestamp('2026-09-12T10:35:00Z', lang)}`} />
          </NeuList>
          <Well>
            <AppText variant="footnote">
              Text well (soft inset, read-only): your doctor is requesting time-bound access to your health record. It expires in 60
              minutes.
            </AppText>
          </Well>
        </Section>

        <Section title="Inputs, OTP, text area (strong inset, focus ring)">
          <TextField label="ABHA address" icon="idCard" value={text} onChangeText={setText} placeholder="91-xxxx@abdm" />
          <TextField label="6-digit OTP" icon="key" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} otp />
          <TextField label="Describe your condition" icon="clipboard" value={notes} onChangeText={setNotes} multiline />
        </Section>

        <Section title="Segmented control (no truncation, all languages)">
          <SegmentedControl
            options={[
              { value: 'abha', label: translate(lang, 'segAbha'), icon: 'idCard' },
              { value: 'mobile', label: translate(lang, 'segMobile'), icon: 'mobile' },
            ]}
            value={auth}
            onChange={setAuth}
          />
          <SegmentedControl
            options={[
              { value: 'a', label: translate(lang, 'filterAll') },
              { value: 'b', label: translate(lang, 'filterImaging'), icon: 'heartbeat' },
              { value: 'c', label: translate(lang, 'segLab'), icon: 'lab' },
            ]}
            value={seg}
            onChange={setSeg}
          />
        </Section>

        {/* Icons */}
        <Section title="IconDisc (raised = tappable, inset = informational) · EmbossedIcon">
          <View style={styles.wrapRow}>
            {(['primary', 'success', 'warning', 'danger', 'gold', 'neutral'] as Tone[]).map((tone) => (
              <View key={tone} style={styles.discCell}>
                <IconDisc icon="shieldCheck" tone={tone} variant="raised" />
                <IconDisc icon="shieldCheck" tone={tone} variant="inset" />
                <AppText variant="mono" color="inkMuted">
                  {tone}
                </AppText>
              </View>
            ))}
          </View>
          <View style={styles.wrapRow}>
            <IconDisc icon="home" variant="raised" size={38} />
            <IconDisc icon="home" variant="raised" size={38} active={false} />
            <IconDisc icon="lock" variant="inset" size={52} />
            <IconDisc icon="calendar" variant="inset" size={46} shape="square" />
            <IconDisc icon="doctor" variant="raised" size={46} shape="square" />
          </View>
          <View style={styles.wrapRow}>
            <IconTile domain="appointments" size={48} />
            <IconTile domain="medications" size={48} />
            <IconTile domain="records" size={48} />
            <IconTile domain="privacy" size={48} />
            <IconTile domain="followup" size={48} />
            <IconTile domain="emergency" size={48} />
          </View>
        </Section>

        {/* Glass */}
        <Section title="Glass over the ambient background">
          <GlassCard>
            <AppText variant="headline">Glass card · fill 55%</AppText>
            <AppText variant="footnote" color="inkMuted">
              Secondary text on glass is promoted to ink automatically.
            </AppText>
          </GlassCard>
          <View style={styles.glassRow}>
            <GlassSurface material="toolbar" style={styles.glassChip}>
              <AppText variant="caption" weight={600}>
                toolbar 54%
              </AppText>
            </GlassSurface>
            <GlassSurface material="tabBar" style={styles.glassChip}>
              <AppText variant="caption" weight={600}>
                tab bar 54%
              </AppText>
            </GlassSurface>
            <GlassSurface material="sheet" style={styles.glassChip}>
              <AppText variant="caption" weight={600}>
                sheet 66%
              </AppText>
            </GlassSurface>
            <GlassSurface material="night" style={styles.glassChip}>
              <AppText variant="caption" weight={600} color="onNight">
                night 70%
              </AppText>
            </GlassSurface>
          </View>
        </Section>

        {/* Critical */}
        <Section title="CriticalButton (soft + tactile, always highest contrast)">
          <CriticalButton tone="primary" icon="video" label="Join call" onPress={() => {}} />
          <CriticalButton tone="success" icon="shieldCheck" label="Authorize access" onPress={() => {}} />
          <CriticalButton tone="danger" icon="emergency" label="Emergency SOS" sublabel="Ambulance 108 / 112" onPress={() => {}} />
          <CriticalButton tone="danger" icon="callEnd" label="End call" onPress={() => {}} fullWidth={false} />
          <CriticalButton tone="primary" icon="video" label="Loading" onPress={() => {}} loading />
          <CriticalButton tone="success" icon="shieldCheck" label="Disabled" onPress={() => {}} disabled />
        </Section>

        {/* Buttons & controls */}
        <Section title="Buttons Hierarchy (Solid, Tonal Secondary, Tertiary)">
          <PrimaryButton label="Primary · Sign in" icon="signIn" onPress={() => {}} />
          <PrimaryButton label="Primary · disabled" icon="signIn" onPress={() => {}} disabled />
          <View style={styles.wrapRow}>
            <SecondaryButton label="Tonal Secondary" tone="primary" icon="lock" onPress={() => {}} />
            <SecondaryButton label="Tonal Success" tone="success" icon="check" onPress={() => {}} />
            <TertiaryButton label="Tertiary Action" icon="rescheduled" onPress={() => {}} />
            <DestructiveButton label="Revoke Access" icon="block" onPress={() => {}} size="sm" />
          </View>
          <View style={styles.neuRow}>
            <IconButton icon="close" accessibilityLabel="Close" onPress={() => {}} size={40} />
            <IconButton icon="signOut" tone="danger" accessibilityLabel="Sign out" onPress={() => {}} size={40} />
            <IconButton icon="mic" accessibilityLabel="Mic on" onPress={() => {}} size={44} selected />
          </View>
        </Section>

        <Section title="Chips, toggles, tiles, badges, audio">
          <View style={styles.wrapRow}>
            <Chip label="Fever" icon="fever" selected={chip} onPress={() => setChip(!chip)} />
            <Chip label="Cough" icon="cough" selected={!chip} onPress={() => setChip(!chip)} />
          </View>
          <View style={styles.neuRow}>
            <NeuToggle value={toggleA} onValueChange={setToggleA} accessibilityLabel="Toggle on" />
            <NeuToggle value={toggleB} onValueChange={setToggleB} accessibilityLabel="Toggle off" />
            <NeuToggle value onValueChange={() => {}} accessibilityLabel="Toggle disabled" disabled />
          </View>
          <View style={styles.neuRow}>
            <NeuTile icon="morning" label="Morning" sublabel="8:00 AM" selected={dose} onPress={() => setDose(!dose)} style={styles.flex} />
            <NeuTile icon="night" label="Night" sublabel="8:30 PM" selected onPress={() => {}} style={styles.flex} />
          </View>
          <View style={styles.wrapRow}>
            {(['primary', 'success', 'warning', 'danger', 'gold', 'neutral', 'audio'] as Tone[]).map((tone) => (
              <Badge key={tone} label={tone} tone={tone} icon={tone === 'gold' ? 'verified' : 'info'} />
            ))}
          </View>
          <AudioListenButton text="Audio badge sample" />
          <MetricCard label="Next appointment" value="10:30" caption="Dr. Ananya · Hassan" icon="calendar" />
          <MetricCard label="Quick action" value="My Records" icon="records" compact onPress={() => {}} />
          <Card>
            <AppText variant="subhead">Card = soft raised panel</AppText>
          </Card>
        </Section>

        {/* Colour */}
        <Section title="Colour">
          <View style={styles.swatches}>
            {(Object.keys(palette) as PaletteKey[])
              .filter((k) => palette[k].startsWith('#'))
              .map((k) => (
                <View key={k} style={styles.swatch}>
                  <View style={[styles.swatchChip, { backgroundColor: palette[k] }]} />
                  <AppText variant="caption" weight={600} compact>
                    {k}
                  </AppText>
                  <AppText variant="mono" color="inkMuted">
                    {palette[k]} · base {contrastRatio(palette[k], palette.base).toFixed(1)}
                  </AppText>
                </View>
              ))}
          </View>
          <SectionHeader title={`Contrast pairs (${pairs.filter((p) => p.pass).length}/${pairs.length} pass)`} />
          <NeuList variant="tray">
            {pairs.map((p) => (
              <View key={p.name} style={styles.pairRow}>
                <Icon name={p.pass ? 'checkCircle' : 'error'} size={18} color={p.pass ? colors.successDeep : colors.dangerDeep} active />
                <AppText variant="footnote" style={styles.flex}>
                  {p.name}
                </AppText>
                <AppText variant="mono" color={p.pass ? 'successDeep' : 'dangerDeep'}>
                  {p.ratio.toFixed(2)} / {p.kind === 'text' ? '4.5' : '3'}
                </AppText>
              </View>
            ))}
          </NeuList>
        </Section>

        {/* Typography */}
        <Section title="Type scale (serif = display, sans = UI)">
          {(Object.keys(typography) as TypeVariant[]).map((v) => (
            <Card key={v} style={styles.typeCard}>
              <AppText variant="mono" color="inkMuted">
                {v} · {typography[v].fontSize}px · {typography[v].weight}
                {typography[v].serif ? ' · serif' : ''}
              </AppText>
              {LANGUAGES.map((l) => (
                <AppText key={l} variant={v} lang={l} numberOfLines={2}>
                  {v === 'metric' ? '10:30' : translate(l, v === 'eyebrow' ? 'nextAppointment' : 'brandHeadline')}
                </AppText>
              ))}
            </Card>
          ))}
        </Section>

        <Section title="Spacing · radii">
          {Object.entries(spacing).map(([k, v]) => (
            <View key={k} style={styles.specRow}>
              <AppText variant="mono" color="inkMuted" style={styles.specLabel}>
                {k} {v}
              </AppText>
              <NeuInset strength="soft" radius={6} style={[styles.spaceBar, { width: v * 4 + 12 }]} />
            </View>
          ))}
          <View style={styles.wrapRow}>
            {Object.entries(radii)
              .filter(([k]) => k !== 'pill')
              .map(([k, v]) => (
                <View key={k} style={styles.radiusItem}>
                  <NeuView strength="soft" radius={v} style={styles.radiusBox} />
                  <AppText variant="mono" color="inkMuted">
                    {k} {v}
                  </AppText>
                </View>
              ))}
          </View>
        </Section>

        <Section title={`Icons (${ICON_NAMES.length}): regular · duotone`}>
          <View style={styles.iconGrid}>
            {ICON_NAMES.map((name) => (
              <View key={name} style={styles.iconCell}>
                <View style={styles.iconPair}>
                  <Icon name={name} size={24} color={colors.inkMuted} />
                  <Icon name={name} size={24} color={colors.primary} active />
                </View>
                <AppText variant="mono" color="inkMuted" numberOfLines={1}>
                  {name}
                </AppText>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Illustrations">
          <View style={styles.wrapRow}>
            {ILLUSTRATIONS.map(({ name, Component }) => (
              <View key={name} style={[styles.illo, name === 'CallWaiting' && styles.illoNight]}>
                <Component width={140} />
                <AppText variant="mono" color={name === 'CallWaiting' ? 'onNightMuted' : 'inkMuted'}>
                  {name}
                </AppText>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Motion">
          <AppText variant="footnote" color="inkMuted">
            press {duration.press}ms · transition {duration.transition}ms · signature {duration.signature}ms (reserved) · ease
            cubic-bezier(0.16, 1, 0.3, 1) · reduce-motion respected
          </AppText>
        </Section>
      </ScrollView>
    </View>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <AppText variant="title2">{title}</AppText>
    {children}
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.base,
  },
  content: {
    paddingHorizontal: spacing.gutter,
    gap: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  section: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  headerSample: {
    gap: spacing.xs,
  },
  headerBox: {
    height: 64,
    paddingHorizontal: spacing.gutter,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBox: {
    width: 200,
  },
  tileBox: {
    width: 320 - 2 * spacing.gutter,
    gap: spacing.md,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tile: {
    flex: 1,
  },
  errorLang: {
    gap: spacing.sm,
  },
  visRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  visPair: {
    flexDirection: 'row',
    gap: 4,
  },
  tabRow: {
    flexDirection: 'row',
    width: 220,
  },
  domainGrid: {
    gap: spacing.md,
  },
  domainCard: {
    gap: spacing.sm,
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  domainSizes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  domainSizeLabel: {
    marginLeft: 'auto',
  },
  elevationRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  elevationCard: {
    flex: 1,
    padding: spacing.md,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  depthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  depthSample: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '24%',
  },
  depthBox: {
    width: 64,
    height: 64,
  },
  depthCircle: {
    width: 64,
    height: 64,
  },
  depthPill: {
    width: 76,
    height: 40,
  },
  shrinkText: {
    flexShrink: 1,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  discCell: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '30%',
  },
  glassRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  glassChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  neuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.sm,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatch: {
    width: '47%',
    gap: 2,
  },
  swatchChip: {
    height: 44,
    borderRadius: radii.md,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typeCard: {
    gap: spacing.xs,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  specLabel: {
    width: 90,
  },
  spaceBar: {
    height: 14,
  },
  radiusItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  radiusBox: {
    width: 64,
    height: 64,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconCell: {
    width: '30%',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
  },
  iconPair: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  illo: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  illoNight: {
    backgroundColor: colors.night,
  },
});
