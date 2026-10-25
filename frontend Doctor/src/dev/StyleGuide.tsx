/**
 * Dev-only Style Guide (`npm run dev`, then /?styleguide). Not included in production builds.
 * Everything here is built from the UI kit and tokens.css, so it shows exactly what screens get.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import tokensCss from '../styles/tokens.css?raw';
import { contrastRatio, evaluate, parseTokens, requiredRatio } from '../styles/contrast';
import { buildContrastPairs } from '../styles/contrastPairs';
import { t, type SupportedLanguage } from '../utils/translations';
import {
  AmbientBackground,
  Badge,
  Chip,
  CriticalButton,
  DataTable,
  EmbossedIcon,
  GlassSheet,
  GlassSidebar,
  GlassToolbar,
  Groove,
  Icon,
  ICON_NAMES,
  IconDisc,
  NeuButton,
  NeuInset,
  NeuPanel,
  NeuRaised,
  SegmentedControl,
  TextField,
  Toggle,
  cx,
  type Column,
  type Tone,
} from '../components/ui';

const TOKENS = parseTokens(tokensCss);
const PAIRS = buildContrastPairs(TOKENS).map(evaluate);

const SWATCHES: { name: string; note: string; text?: boolean }[] = [
  { name: 'ink', note: 'Primary text; only text colour on glass', text: true },
  { name: 'ink-muted', note: 'Secondary text (derived)', text: true },
  { name: 'ink-inset', note: 'Placeholder / idle icon in strong insets', text: true },
  { name: 'primary', note: 'Actions, links, selected', text: true },
  { name: 'primary-deep', note: 'Hover / pressed solid primary (= Patient primaryPressed)' },
  { name: 'primary-soft', note: 'Fills / borders only, never text' },
  { name: 'fog', note: 'Fills / borders only, never text' },
  { name: 'ice', note: 'Ambient blob; muted text on night' },
  { name: 'base', note: 'Canvas + neumorphic surface' },
  { name: 'card', note: 'Card / sheet tint' },
  { name: 'sand', note: 'Locked / muted surface' },
  { name: 'gold', note: 'Verified only (text: gold-deep)' },
  { name: 'gold-deep', note: 'Verified text / icon', text: true },
  { name: 'success', note: 'Fills, dots; icons on night' },
  { name: 'success-deep', note: 'Success text, solid fill', text: true },
  { name: 'success-pressed', note: 'Pressed solid success' },
  { name: 'warning', note: 'Fills, dots' },
  { name: 'warning-deep', note: 'Warning text and icons', text: true },
  { name: 'danger', note: 'Fills, dots' },
  { name: 'danger-deep', note: 'Danger text, solid fill', text: true },
  { name: 'danger-pressed', note: 'Pressed solid danger' },
  { name: 'night', note: 'Call screen, dark glass' },
];

const LANGS: SupportedLanguage[] = ['en', 'kn', 'hi'];
const LANG_NAME: Record<SupportedLanguage, string> = { en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिंदी' };

const TYPE_SCALE: { label: string; className: string; sample: (l: SupportedLanguage) => string }[] = [
  { label: 'Display / h1 · serif 30 / 700', className: 'font-serif text-3xl font-bold', sample: (l) => t(l, 'patientQueue') },
  { label: 'Title / h2 · serif 24 / 600', className: 'font-serif text-2xl font-semibold', sample: (l) => t(l, 'latestVitals') },
  { label: 'Metric · serif 32 / 700', className: 'font-serif text-[32px] font-bold', sample: () => '128 / 84' },
  { label: 'Headline · sans 17 / 600', className: 'text-[17px] font-semibold', sample: (l) => t(l, 'consentsGranted') },
  { label: 'Body · sans 16 / 400', className: 'text-base', sample: (l) => `${t(l, 'viewChart')} · Ramesh Gowda, 54 · Metformin 500 mg` },
  { label: 'Subhead · sans 15 / 500', className: 'text-subhead font-medium', sample: (l) => t(l, 'listenSummary') },
  { label: 'Small · sans 14 / 500', className: 'text-sm font-medium', sample: (l) => t(l, 'abdmVerified') },
  { label: 'Footnote · sans 13 (Indic → 14)', className: 'text-footnote', sample: (l) => t(l, 'followUp') },
  { label: 'Caption · sans 12 (Indic → 14)', className: 'text-xs font-medium', sample: (l) => t(l, 'urgent') },
  { label: 'Dense 11 / 10 (Indic → 14)', className: 'text-2xs font-semibold uppercase tracking-wider', sample: (l) => t(l, 'routine') },
  { label: 'Mono · IDs, timestamps (always Latin)', className: 'font-mono text-2xs', sample: () => 'ABHA 91-4821-7730-2201 · 14:32:08' },
];

interface QueueRow {
  id: string;
  name: string;
  abha: string;
  complaint: string;
  wait: string;
  urgency: 'high' | 'follow_up' | 'routine';
}
const QUEUE: QueueRow[] = [
  { id: 'p1', name: 'Lakshmi Devi', abha: 'lakshmi.devi@abdm', complaint: 'Chest pain, 2 h', wait: '04:12', urgency: 'high' },
  { id: 'p2', name: 'Ramesh Gowda', abha: 'ramesh.g@abdm', complaint: 'Diabetes review', wait: '11:40', urgency: 'follow_up' },
  { id: 'p3', name: 'Anil Kumar', abha: 'anil.k@abdm', complaint: 'Seasonal cough', wait: '18:05', urgency: 'routine' },
];
const URGENCY: Record<QueueRow['urgency'], { tone: Tone; icon: 'emergency' | 'sync' | 'checkCircle'; key: string }> = {
  high: { tone: 'danger', icon: 'emergency', key: 'urgent' },
  follow_up: { tone: 'warning', icon: 'sync', key: 'followUp' },
  routine: { tone: 'success', icon: 'checkCircle', key: 'routine' },
};

function Section({ id, title, children, note }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-20 flex-col gap-4">
      <div>
        <h2 id={`${id}-h`} className="text-2xl font-semibold text-ink">
          {title}
        </h2>
        {note && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const Label = ({ children }: { children: ReactNode }) => <p className="text-2xs font-semibold text-ink-muted">{children}</p>;

const ratio = (fg: string, bg: string) => contrastRatio(fg, bg).toFixed(2);

export default function StyleGuide() {
  const [lang, setLang] = useState<SupportedLanguage>('en');
  const [seg, setSeg] = useState<'queue' | 'chart' | 'records'>('queue');
  const [toggle, setToggle] = useState(true);
  const [chip, setChip] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [selected, setSelected] = useState('p1');
  const [onlyFailing, setOnlyFailing] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = 'Style Guide · SwasthyaSetu Doctor';
  }, [lang]);

  const groups = useMemo(() => {
    const rows = onlyFailing ? PAIRS.filter((p) => !p.pass) : PAIRS;
    return [...new Set(rows.map((p) => p.group))].map((g) => ({ group: g, rows: rows.filter((p) => p.group === g) }));
  }, [onlyFailing]);
  const failing = PAIRS.filter((p) => !p.pass).length;

  const columns: Column<QueueRow>[] = [
    {
      key: 'patient',
      header: 'Patient',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <IconDisc icon="person" tone="primary" size={32} />
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold text-ink">{r.name}</span>
            <span className="font-mono text-2xs text-ink-muted">{r.abha}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'urgency',
      header: 'Triage',
      className: 'w-40',
      cell: (r) => <Badge tone={URGENCY[r.urgency].tone} icon={URGENCY[r.urgency].icon} label={t(lang, URGENCY[r.urgency].key)} />,
    },
    { key: 'complaint', header: 'Complaint', cell: (r) => <span className="text-ink">{r.complaint}</span> },
    {
      key: 'wait',
      header: 'Waiting',
      className: 'w-24 text-right',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-muted">
          <Icon name="clock" size={14} /> {r.wait}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      className: 'w-36 text-right',
      cell: (r) => (
        <NeuButton size="sm" icon="chart" onClick={(e) => e.stopPropagation()} aria-label={`${t(lang, 'viewChart')}: ${r.name}`}>
          {t(lang, 'viewChart')}
        </NeuButton>
      ),
    },
  ];

  const nav = [
    ['colour', 'Colour'],
    ['contrast', 'Contrast'],
    ['type', 'Type'],
    ['depth', 'Depth'],
    ['controls', 'Controls'],
    ['icons', 'Icons'],
    ['glass', 'Glass'],
    ['critical', 'Critical'],
    ['dense', 'Dense queue'],
    ['focus', 'Focus & hover'],
  ];

  return (
    <div className="relative isolate min-h-screen text-ink">
      <AmbientBackground />
      <GlassToolbar className="flex items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-chip bg-linear-to-br from-primary to-ink text-white">
            <Icon name="brand" size={20} weight="duotone" />
          </span>
          <div>
            <h1 className="text-lg leading-tight font-semibold">Harbor Calm · Doctor portal</h1>
            <p className="text-2xs text-ink">Dev Style Guide · tokens from src/styles/tokens.css</p>
          </div>
        </div>
        <SegmentedControl
          label="Language"
          size="sm"
          className="w-72"
          value={lang}
          onChange={setLang}
          options={LANGS.map((l) => ({ value: l, label: LANG_NAME[l] }))}
        />
      </GlassToolbar>

      <div className="mx-auto flex max-w-[1600px] gap-8 px-6 py-8">
        <GlassSidebar label="Style guide sections" className="sticky top-20 hidden h-fit w-48 shrink-0 gap-1 rounded-panel p-3 xl:flex">
          {nav.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-chip px-3 py-2 text-footnote font-medium text-ink hover:bg-ink-tint">
              {label}
            </a>
          ))}
        </GlassSidebar>

        <main className="flex min-w-0 flex-1 flex-col gap-14">
          {/* ---------------- Colour ---------------- */}
          <Section id="colour" title="Colour" note="Harbor Calm roles, values identical to the Patient app. Ratios: ink and white on the swatch; for text roles, the role as text on base.">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-4">
              {SWATCHES.map((s) => {
                const hex = TOKENS[`color-${s.name}`];
                return (
                  <div key={s.name} className="neu-panel flex flex-col overflow-hidden rounded-panel">
                    <div className="h-16" style={{ background: hex }} />
                    <div className="flex flex-col gap-1 p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold">{s.name}</span>
                        <span className="font-mono text-2xs text-ink-muted">{hex}</span>
                      </div>
                      <p className="text-2xs text-ink-muted">{s.note}</p>
                      <p className="font-mono text-2xs text-ink-muted">
                        ink {ratio(TOKENS['color-ink'], hex)} · white {ratio(TOKENS['color-white'], hex)}
                        {s.text && ` · on base ${ratio(hex, TOKENS['color-base'])}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ---------------- Contrast ---------------- */}
          <Section
            id="contrast"
            title="Contrast"
            note={`${PAIRS.length} pairs from src/styles/contrastPairs.ts (same list as npm run check:contrast). Text 4.5:1, icons / focus rings 3:1. Translucent layers flattened bottom-up; gradients checked at their darkest point.`}
          >
            <div className="flex items-center gap-4">
              <Badge tone={failing ? 'danger' : 'success'} icon={failing ? 'error' : 'checkCircle'} size="md" label={failing ? `${failing} failing` : 'All pairs pass'} />
              <Toggle checked={onlyFailing} onChange={setOnlyFailing} label="Show failing only" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {groups.map(({ group, rows }) => (
                <NeuPanel key={group} className="p-4">
                  <h3 className="mb-2 text-sm font-bold">{group}</h3>
                  <ul className="groove-rows">
                    {rows.map((p) => (
                      <li key={p.name} className="flex items-center justify-between gap-3 py-1.5 text-footnote">
                        <span className="min-w-0">{p.name}</span>
                        <span className="flex shrink-0 items-center gap-2 font-mono text-2xs">
                          {p.ratio.toFixed(2)} / {requiredRatio(p.kind)}
                          <Icon name={p.pass ? 'checkCircle' : 'error'} size={14} tone={p.pass ? 'success' : 'danger'} weight="duotone" label={p.pass ? 'pass' : 'fail'} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </NeuPanel>
              ))}
            </div>
          </Section>

          {/* ---------------- Type ---------------- */}
          <Section
            id="type"
            title="Type scale"
            note="Fraunces / Noto Serif for display only, DM Sans / Noto Sans for UI, DM Mono for IDs. One font stack per role; the browser picks the glyph's font, so Latin names and digits stay DM Sans in kn / hi. Indic: 14px / 500 floor, line-height 1.75 (kn) / 1.70 (hi), no letter-spacing."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              {LANGS.map((l) => (
                <NeuPanel key={l} as="div" lang={l} className="flex flex-col gap-3 p-5">
                  <Badge tone="primary" icon="translate" label={`${LANG_NAME[l]} · lang="${l}"`} />
                  {TYPE_SCALE.map((row) => (
                    <div key={row.label} className="flex flex-col">
                      <span lang="en" className="font-mono text-4xs text-ink-muted">
                        {row.label}
                      </span>
                      <span className={row.className}>{row.sample(l)}</span>
                    </div>
                  ))}
                </NeuPanel>
              ))}
            </div>
          </Section>

          {/* ---------------- Depth ---------------- */}
          <Section id="depth" title="Depth language" note="RAISED = actionable, INSET = holds / shows / receives. STRONG for controls, SOFT for panels, rows and wells. Hover lifts 1px; pressed goes inset.">
            <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-4">
              <div className="flex flex-col gap-3">
                <Label>Raised strong (control) · rest / hover / pressed</Label>
                <div className="flex flex-wrap gap-4">
                  <NeuButton icon="video">Rest</NeuButton>
                  <NeuButton icon="video" data-state="hover">
                    Hover
                  </NeuButton>
                  <NeuButton icon="video" data-state="pressed">
                    Pressed
                  </NeuButton>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Label>Static raised strong / compact</Label>
                <div className="flex gap-4">
                  <NeuRaised className="flex h-16 w-28 items-center justify-center text-footnote">strong</NeuRaised>
                  <NeuRaised compact className="flex h-16 w-28 items-center justify-center text-footnote">
                    compact
                  </NeuRaised>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Label>Inset strong (input / track) vs soft (text well)</Label>
                <div className="flex gap-4">
                  <NeuInset strength="strong" className="flex h-16 w-28 items-center justify-center text-footnote">
                    strong
                  </NeuInset>
                  <NeuInset className="flex h-16 w-28 items-center justify-center text-footnote">soft well</NeuInset>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Label>Soft panel with grooves</Label>
                <NeuPanel as="div" className="p-4">
                  <p className="text-sm font-semibold">Panel</p>
                  <Groove className="my-3" />
                  <p className="text-footnote text-ink-muted">Rows are separated by debossed grooves, never per-row shadows.</p>
                </NeuPanel>
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <Label>Read-only text well (clinical note)</Label>
                <NeuInset className="p-4 text-sm leading-relaxed">
                  <span className="mb-1 flex items-center gap-1.5 text-2xs font-semibold text-ink-muted">
                    <Icon name="clinicalNotes" size={14} /> Clinical findings
                  </span>
                  Mild tenderness right lower quadrant. No guarding. Ultrasound: 4.2 mm calculus, right lower pole calyx.
                </NeuInset>
              </div>
              <div className="flex flex-col gap-3">
                <Label>Grooved list tray (audit entries)</Label>
                <NeuInset className="groove-rows px-4">
                  {['Consent granted · Lab report', 'Record viewed · Ultrasound', 'Consent expired · Discharge summary'].map((x, i) => (
                    <div key={x} className="flex items-center justify-between py-2.5 text-footnote">
                      <span className="flex items-center gap-2">
                        <Icon name={i === 2 ? 'hourglass' : 'shieldCheck'} size={16} tone={i === 2 ? 'warning' : 'success'} weight="duotone" />
                        {x}
                      </span>
                      <span className="font-mono text-2xs text-ink-muted">2026-10-2{i} 14:3{i}</span>
                    </div>
                  ))}
                </NeuInset>
              </div>
            </div>
          </Section>

          {/* ---------------- Controls ---------------- */}
          <Section id="controls" title="Controls" note="Inputs: strong inset, leading icon, visible label, primary focus ring. Segmented: inset track + raised thumb (arrow keys). Toggle: inset track + raised knob.">
            <div className="grid gap-6 lg:grid-cols-3">
              <TextField label="Practitioner ID" icon="idCard" placeholder="NMC-KA-000000" hint="As printed on your NMC registration" />
              <TextField label="Password" icon="lock" type="password" defaultValue="secret" error="Incorrect password. Try again." />
              <TextField label="Search patients" icon="search" size="sm" placeholder="Name, ABHA, symptom" />
            </div>
            <div className="flex flex-wrap items-end gap-8">
              <div className="flex w-96 flex-col gap-2">
                <Label>SegmentedControl</Label>
                <SegmentedControl
                  label="View"
                  value={seg}
                  onChange={setSeg}
                  options={[
                    { value: 'queue', label: t(lang, 'patientQueue'), icon: 'people' },
                    { value: 'chart', label: t(lang, 'patientChart'), icon: 'chart' },
                    { value: 'records', label: t(lang, 'clinicalRecords'), icon: 'records' },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Toggle</Label>
                <Toggle checked={toggle} onChange={setToggle} label="Audio priority" stateLabels={['On', 'Off']} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Chip (filter)</Label>
                <div className="flex gap-3">
                  <Chip label={t(lang, 'urgent')} icon="emergency" selected={chip} count={3} onClick={() => setChip(!chip)} />
                  <Chip label={t(lang, 'routine')} icon="checkCircle" selected={!chip} count={9} onClick={() => setChip(!chip)} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Badges</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="danger" icon="emergency" label={t(lang, 'urgent')} />
                  <Badge tone="warning" icon="sync" label={t(lang, 'followUp')} />
                  <Badge tone="success" icon="checkCircle" label={t(lang, 'routine')} />
                  <Badge tone="primary" dot label="In call" />
                  <Badge tone="gold" icon="verified" label={t(lang, 'abdmVerified')} />
                  <Badge tone="neutral" icon="lock" label="Locked" />
                </div>
              </div>
            </div>
          </Section>

          {/* ---------------- Icons ---------------- */}
          <Section id="icons" title="Icons" note="Phosphor via the semantic registry (src/components/ui/Icon.tsx): regular = inactive, duotone = active. IconDisc raised = tappable, inset = informational.">
            <div className="flex flex-wrap items-center gap-6">
              {(['primary', 'success', 'warning', 'danger', 'gold', 'muted'] as const).map((tone) => (
                <div key={tone} className="flex flex-col items-center gap-2">
                  <div className="flex gap-3">
                    <IconDisc icon="vitals" tone={tone} variant="raised" />
                    <IconDisc icon="vitals" tone={tone} variant="inset" />
                  </div>
                  <span className="text-2xs text-ink-muted">{tone}</span>
                </div>
              ))}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-4">
                  <EmbossedIcon icon="shieldCheck" size={56} />
                  <EmbossedIcon icon="doctor" size={56} tone="ink" />
                  <EmbossedIcon icon="callEnd" size={56} tone="danger" />
                </div>
                <span className="text-2xs text-ink-muted">EmbossedIcon (decorative, ≥ 32px)</span>
              </div>
            </div>
            <NeuPanel as="div" className="grid grid-cols-3 gap-x-4 gap-y-3 p-5 sm:grid-cols-5 lg:grid-cols-8 2xl:grid-cols-10">
              {ICON_NAMES.map((n) => (
                <div key={n} className="flex flex-col items-center gap-1.5">
                  <div className="flex gap-1.5">
                    <Icon name={n} size={22} tone="ink" />
                    <Icon name={n} size={22} tone="primary" weight="duotone" />
                  </div>
                  <span className="font-mono text-4xs text-ink-muted">{n}</span>
                </div>
              ))}
            </NeuPanel>
          </Section>

          {/* ---------------- Glass ---------------- */}
          <Section id="glass" title="Glass over the ambient background" note="Blur 30px + saturate, fill 54–66%, 1px specular edge brighter top-left, ink text only. Falls back to a solid fill without backdrop-filter or with prefers-reduced-transparency.">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="glass flex flex-col gap-2 rounded-panel p-5">
                <span className="flex items-center gap-2 font-semibold">
                  <Icon name="notification" size={18} tone="primary" weight="duotone" /> Glass card
                </span>
                <p className="text-sm">Consent token granted by Lakshmi Devi. Records refreshed.</p>
              </div>
              <div className="glass-toolbar flex items-center justify-between rounded-panel px-5 py-4">
                <span className="font-semibold">Toolbar glass</span>
                <NeuButton size="sm" icon="search" aria-label="Search" />
              </div>
              <div className="flex items-center">
                <NeuButton icon="key" tone="primary" onClick={() => setSheet(true)}>
                  Open glass sheet
                </NeuButton>
              </div>
            </div>
            <GlassSheet
              open={sheet}
              onClose={() => setSheet(false)}
              title="Request record access"
              description="Esc closes, Tab stays inside, focus returns to the button."
              footer={
                <>
                  <NeuButton onClick={() => setSheet(false)}>Cancel</NeuButton>
                  <CriticalButton tone="primary" icon="send" label="Send consent request" onClick={() => setSheet(false)} />
                </>
              }
            >
              <div className="flex flex-col gap-4">
                <TextField label="Purpose" icon="clinicalNotes" defaultValue="Follow-up for renal calculus" />
                <SegmentedControl
                  label="Duration"
                  value="60"
                  onChange={() => undefined}
                  options={[
                    { value: '30', label: '30 min' },
                    { value: '60', label: '1 h' },
                    { value: '1440', label: '24 h' },
                  ]}
                />
              </div>
            </GlassSheet>
          </Section>

          {/* ---------------- Critical ---------------- */}
          <Section id="critical" title="CriticalButton" note="Strong raised shape + solid deep fill + white icon and label + coloured glow. Always the highest-contrast element on screen. Min 44px.">
            {(['primary', 'success', 'danger'] as const).map((tone) => {
              const meta = { primary: ['video', 'Start video call'], success: ['send', 'Send consent request'], danger: ['callEnd', 'End consultation'] } as const;
              const [icon, label] = meta[tone];
              return (
                <div key={tone} className="flex flex-wrap items-center gap-6">
                  <span className="w-20 text-footnote font-semibold text-ink-muted">{tone}</span>
                  <CriticalButton tone={tone} icon={icon} label={label} />
                  <CriticalButton tone={tone} icon={icon} label="Hover" data-state="hover" />
                  <CriticalButton tone={tone} icon={icon} label="Pressed" data-state="pressed" />
                  <CriticalButton tone={tone} icon={icon} label={label} sublabel="Patient app notified" />
                  <CriticalButton tone={tone} icon={icon} label={label} loading loadingLabel="Sending…" />
                  <CriticalButton tone={tone} icon={icon} label="Disabled" disabled />
                </div>
              );
            })}
          </Section>

          {/* ---------------- Dense queue ---------------- */}
          <Section id="dense" title="Dense queue row" note="Clinician density: one soft panel, grooved rows, no per-row shadow. Icon + status colour + short label first. Rows: Tab, then Enter / Space to select.">
            <DataTable
              caption="Triage queue (sample data)"
              columns={columns}
              rows={QUEUE}
              rowKey={(r) => r.id}
              selectedKey={selected}
              onRowClick={(r) => setSelected(r.id)}
            />
          </Section>

          {/* ---------------- Focus ---------------- */}
          <Section id="focus" title="Focus & hover" note="Every interactive element shows a 2px primary ring with a 2px offset on keyboard focus (ice on night surfaces). Static previews below; press Tab to try it.">
            <div className="flex flex-wrap items-center gap-6">
              <NeuButton icon="chart" className="outline-2 outline-offset-2 outline-primary">
                Focused button
              </NeuButton>
              <CriticalButton tone="primary" icon="video" label="Focused critical" className="outline-2 outline-offset-2 outline-primary" />
              <a href="#focus" className="rounded-tight text-sm font-semibold text-primary underline outline-2 outline-offset-2 outline-primary">
                Focused link
              </a>
              <div className="flex items-center gap-4 rounded-panel bg-night p-4">
                <button type="button" className="rounded-control bg-white/15 px-4 py-2 text-sm font-semibold text-white outline-2 outline-offset-2 outline-ice">
                  On night
                </button>
                <button type="button" aria-label="End call" className="flex size-11 items-center justify-center rounded-full bg-danger-deep text-white">
                  <Icon name="callEnd" size={20} />
                </button>
              </div>
            </div>
            <p className={cx('text-footnote text-ink-muted')}>Reduced motion: transitions and animations collapse to instant. Reduced transparency: glass becomes solid.</p>
          </Section>
        </main>
      </div>
    </div>
  );
}
