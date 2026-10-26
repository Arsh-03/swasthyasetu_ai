import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors, radii, spacing, tints } from '../theme/tokens';
import { patientApi, type VitalReading } from '../services/api';
import { estimateHeartRate, fingerOnCamera, waveform, type ColorSample, type HeartRateResult } from '../services/heartRate';
import { CAMERA_HEART_RATE_SUPPORTED, startFingertipCapture, type CameraCapture } from '../services/heartRateCamera';
import { useLanguage } from '../i18n/LanguageContext';
import { formatTimestamp } from '../utils/dates';
import { haptic } from '../utils/haptics';
import { AppText, Card, Icon, NavBar, PrimaryButton, ScreenScroll, SecondaryButton } from './ui';

const MEASURE_SECONDS = 30;
const WARMUP_SECONDS = 3; // the camera's exposure settles after the finger goes on
const LOST_RESET_MS = 2000; // finger off longer than this: start again

type Phase = 'intro' | 'measuring' | 'result' | 'failed';

/**
 * Heart rate from a fingertip on the phone camera (with the flash on where the phone allows it).
 * The result is an estimate for the doctor's reference; it is saved and shared with the doctor.
 */
export const HeartRateView: React.FC<{ onBack: () => void; onMessageDoctor: () => void }> = ({ onBack, onMessageDoctor }) => {
  const { lang, t } = useLanguage();
  const [phase, setPhase] = useState<Phase>('intro');
  const [progress, setProgress] = useState(0); // seconds of good signal
  const [fingerOn, setFingerOn] = useState(false);
  const [live, setLive] = useState<number | null>(null);
  const [wave, setWave] = useState<number[]>([]);
  const [result, setResult] = useState<HeartRateResult | null>(null);
  const [saved, setSaved] = useState<VitalReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState(true);
  const [history, setHistory] = useState<VitalReading[]>([]);
  const capture = useRef<CameraCapture | null>(null);
  const samples = useRef<ColorSample[]>([]);
  const start = useRef<number | null>(null);
  const lostSince = useRef<number | null>(null);

  const loadHistory = () => patientApi.getMyReadings().then(setHistory).catch(() => undefined);
  useEffect(() => { void loadHistory(); }, []);
  useEffect(() => () => capture.current?.stop(), []);

  const stop = () => {
    capture.current?.stop();
    capture.current = null;
  };

  const finish = async () => {
    stop();
    const r = estimateHeartRate(samples.current);
    setResult(r);
    if (!r || r.confidence === 'poor') {
      setPhase('failed');
      haptic.warning();
      return;
    }
    setPhase('result');
    haptic.success();
    try {
      setSaved(await patientApi.saveReading({
        kind: 'heart_rate', value: r.bpm, method: 'camera_ppg', confidence: r.confidence,
        details: { quality: r.quality, irregularity: r.irregularity, seconds: r.seconds, beats: r.beats, torch, channel: r.channel },
      }));
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('hrSaveError'));
    }
  };

  const begin = async () => {
    setError(null);
    setResult(null);
    setSaved(null);
    setProgress(0);
    setLive(null);
    setWave([]);
    samples.current = [];
    start.current = null;
    lostSince.current = null;
    try {
      capture.current = await startFingertipCapture((s) => {
        const on = fingerOnCamera(s);
        setFingerOn(on);
        if (!on) {
          lostSince.current ??= s.t;
          if (s.t - lostSince.current > LOST_RESET_MS) { samples.current = []; start.current = null; setProgress(0); setLive(null); }
          return;
        }
        lostSince.current = null;
        start.current ??= s.t;
        if (s.t - start.current < WARMUP_SECONDS * 1000) return;
        samples.current.push(s);
        const secs = (s.t - samples.current[0].t) / 1000;
        setProgress(Math.min(MEASURE_SECONDS, secs));
        if (samples.current.length % 15 === 0) {
          setWave(waveform(samples.current));
          if (secs >= 10) {
            const est = estimateHeartRate(samples.current.filter((x) => x.t >= s.t - 12000));
            setLive(est && est.confidence !== 'poor' ? est.bpm : null);
          }
        }
        if (secs >= MEASURE_SECONDS) void finish();
      });
      setTorch(capture.current.torch);
      setPhase('measuring');
    } catch (err) {
      const denied = err instanceof Error && /denied|NotAllowed/i.test(err.name + err.message);
      setError(denied ? t('hrCameraDenied') : t('hrCameraError'));
    }
  };

  const cancel = () => { stop(); setPhase('intro'); };

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <NavBar backLabel={t('home')} onBack={() => { stop(); onBack(); }} />
      <AppText variant="largeTitle" accessibilityRole="header">{t('hrTitle')}</AppText>

      {!CAMERA_HEART_RATE_SUPPORTED ? (
        <Card>
          <AppText variant="body">{t('hrNotSupported')}</AppText>
        </Card>
      ) : phase === 'intro' ? (
        <>
          <Card style={styles.gap}>
            {[
              ['clock', t('hrStepRest')],
              ['heartbeat', t('hrStepFinger')],
              ['timer', t('hrStepStill')],
            ].map(([icon, text]) => (
              <View key={text} style={styles.stepRow}>
                <Icon name={icon as 'clock'} size={24} color={colors.primary} />
                <AppText variant="body" style={styles.flex}>{text}</AppText>
              </View>
            ))}
          </Card>
          <AppText variant="footnote" color="inkMuted">{t('hrDisclaimer')}</AppText>
          {error && <AppText variant="subhead" color="dangerDeep">{error}</AppText>}
          <PrimaryButton label={t('hrStart')} icon="heartbeat" onPress={() => void begin()} />
        </>
      ) : phase === 'measuring' ? (
        <View style={styles.center}>
          <ProgressRing value={progress / MEASURE_SECONDS} active={fingerOn}>
            <AppText variant="metric" align="center">{live ?? '--'}</AppText>
            <AppText variant="footnote" color="inkMuted" align="center">{t('hrBpm')}</AppText>
          </ProgressRing>
          <AppText variant="headline" align="center" color={fingerOn ? 'ink' : 'warningDeep'} accessibilityLiveRegion="polite">
            {fingerOn ? t('hrHoldStill', { n: Math.max(0, Math.ceil(MEASURE_SECONDS - progress)) }) : t('hrCoverCamera')}
          </AppText>
          {!torch && <AppText variant="footnote" color="inkMuted" align="center">{t('hrNoFlash')}</AppText>}
          <Wave values={wave} />
          <SecondaryButton label={t('hrCancel')} onPress={cancel} />
        </View>
      ) : phase === 'result' && result ? (
        <>
          <Card style={styles.resultCard}>
            <Icon name="heartbeat" size={36} color={colors.dangerDeep} />
            <AppText variant="metric" align="center">{result.bpm} <AppText variant="title" color="inkMuted">{t('hrBpm')}</AppText></AppText>
            <AppText variant="subhead" color={result.confidence === 'good' ? 'successDeep' : 'warningDeep'} align="center">
              {result.confidence === 'good' ? t('hrClearReading') : t('hrFairReading')}
            </AppText>
            <AppText variant="footnote" color="inkMuted" align="center">
              {saved ? t('hrSharedWithDoctor') : error ? error : t('hrSaving')}
            </AppText>
          </Card>
          {saved?.out_of_range && (
            <Pressable onPress={() => Linking.openURL('tel:108').catch(() => undefined)} accessibilityRole="button" style={styles.warning}>
              <Icon name="emergency" size={22} color={colors.dangerDeep} />
              <AppText variant="subhead" color="dangerDeep" style={styles.flex}>{t('hrOutOfRange')}</AppText>
            </Pressable>
          )}
          <AppText variant="footnote" color="inkMuted">{t('hrDisclaimer')}</AppText>
          <PrimaryButton label={t('hrMessageDoctor')} icon="chat" onPress={onMessageDoctor} />
          <SecondaryButton label={t('hrAgain')} onPress={() => setPhase('intro')} />
        </>
      ) : (
        <>
          <Card style={styles.gap}>
            <Icon name="warning" size={28} color={colors.warningDeep} />
            <AppText variant="headline">{t('hrFailedTitle')}</AppText>
            <AppText variant="body">{t('hrFailedHint')}</AppText>
          </Card>
          <PrimaryButton label={t('hrAgain')} icon="heartbeat" onPress={() => void begin()} />
        </>
      )}

      {history.length > 0 && phase !== 'measuring' && (
        <Card style={styles.gap}>
          <AppText variant="headline">{t('hrHistory')}</AppText>
          {history.slice(0, 5).map((h) => (
            <View key={h.reading_id} style={styles.historyRow}>
              <AppText variant="body" weight={600}>{h.value} {t('hrBpm')}</AppText>
              <AppText variant="footnote" color="inkMuted" style={styles.flex} align="right">{formatTimestamp(h.created_at, lang)}</AppText>
            </View>
          ))}
        </Card>
      )}
    </ScreenScroll>
  );
};

const ProgressRing: React.FC<{ value: number; active: boolean; children: React.ReactNode }> = ({ value, active, children }) => {
  const size = 200;
  const r = 88;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.fog} strokeWidth={10} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={active ? colors.danger : colors.warning} strokeWidth={10} fill="none"
          strokeDasharray={`${c * value} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
};

const Wave: React.FC<{ values: number[] }> = ({ values }) => {
  const w = 300;
  const h = 70;
  if (values.length < 2) return <View style={{ height: h }} />;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 6 - v * (h - 12)}`).join(' ');
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polyline points={pts} fill="none" stroke={colors.danger} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  flex: { flex: 1 },
  gap: { gap: spacing.md },
  center: { alignItems: 'center', gap: spacing.lg },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  resultCard: { alignItems: 'center', gap: spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  warning: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: radii.md, backgroundColor: tints.danger, borderWidth: 1, borderColor: tints.dangerRing,
  },
});
