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
  Badge,
  Button,
  Card,
  Chip,
  CriticalButton,
  DataTable,
  Divider,
  GlassSidebar,
  GlassToolbar,
  Icon,
  ICON_NAMES,
  IconDisc,
  IconTile,
  PageHeader,
  Panel,
  SectionHeader,
  SegmentedControl,
  StatusChip,
  TextField,
  Toggle,
  Well,
  type Column,
  type Domain,
  type Tone,
} from '../components/ui';

const TOKENS = parseTokens(tokensCss);
const PAIRS = buildContrastPairs(TOKENS).map(evaluate);

const SWATCHES: { name: string; note: string; text?: boolean }[] = [
  { name: 'ink', note: 'Primary text; only text colour on glass', text: true },
  { name: 'ink-muted', note: 'Secondary text (derived)', text: true },
  { name: 'primary', note: 'Actions, links, selected', text: true },
  { name: 'primary-deep', note: 'Hover / pressed solid primary (= Patient primaryPressed)' },
  { name: 'primary-soft', note: 'Borders & accents, never text' },
  { name: 'ice', note: 'Tonal secondary button fill; ice tint' },
  { name: 'teal', note: 'Medications domain primary' },
  { name: 'teal-deep', note: 'Medications text, icon, solid fill', text: true },
  { name: 'teal-tint', note: 'Medications background tint (~12%)' },
  { name: 'navy', note: 'Privacy / consent domain primary' },
  { name: 'navy-deep', note: 'Privacy text, icon, solid fill', text: true },
  { name: 'navy-tint', note: 'Privacy background tint (~12%)' },
  { name: 'base', note: 'Canvas background (#F2F5F8)' },
  { name: 'card', note: 'Pure card surface (#FFFFFF)' },
  { name: 'card-border', note: 'Card 1px border (#DCE5EA)' },
  { name: 'input-border', note: 'Input 1px border (#728A97, >= 3:1 vs canvas & card)' },
  { name: 'sand', note: 'Muted surface / record tint' },
  { name: 'gold', note: 'Records domain / verified accent' },
  { name: 'gold-deep', note: 'Verified / record text', text: true },
  { name: 'gold-tint', note: 'Records background tint (~12%)' },
  { name: 'success', note: 'Fills, dots' },
  { name: 'success-deep', note: 'Success text, solid fill', text: true },
  { name: 'warning', note: 'Fills, dots, follow-up domain' },
  { name: 'warning-deep', note: 'Warning / follow-up text and icons', text: true },
  { name: 'warning-tint', note: 'Follow-up background tint (~12%)' },
  { name: 'danger', note: 'Fills, dots, emergency domain' },
  { name: 'danger-deep', note: 'Danger / emergency text, solid fill', text: true },
  { name: 'danger-tint', note: 'Emergency background tint (~12%)' },
  { name: 'night', note: 'Call screen, dark surfaces' },
];

const DOMAINS: { domain: Domain; label: string; note: string; action: string }[] = [
  { domain: 'appointments', label: 'Appointments & Calls', note: 'Primary solid / tint for scheduled visits and consultations', action: 'Join consultation' },
  { domain: 'medications', label: 'Medications', note: 'Teal (#407E8C) and tint for active prescriptions & dosage plans', action: 'Refill 2 tablets' },
  { domain: 'records', label: 'Clinical Records', note: 'Sand/gold tint and deep gold for diagnostic reports and labs', action: 'View ultrasound' },
  { domain: 'privacy', label: 'Privacy & Consent', note: 'Navy (#083A4F) for ABHA verification and active consent tokens', action: 'Consent active' },
  { domain: 'followup', label: 'Follow-up', note: 'Warning amber for action-required reviews and expiring tokens', action: 'Review due 2d' },
  { domain: 'emergency', label: 'Emergency / Triage', note: 'Danger red for high-acuity triage, SOS triggers, immediate action', action: 'Acute triage' },
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

const Label = ({ children }: { children: ReactNode }) => <p className="text-2xs font-semibold text-ink-muted uppercase tracking-wider">{children}</p>;

const ratio = (fg: string, bg: string) => contrastRatio(fg, bg).toFixed(2);

export default function StyleGuide() {
  const [lang, setLang] = useState<SupportedLanguage>('en');
  const [seg, setSeg] = useState<'queue' | 'chart' | 'records'>('queue');
  const [toggle, setToggle] = useState(true);
  const [chip, setChip] = useState(true);
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
        <Button size="sm" variant="secondary" icon="chart" onClick={(e) => e.stopPropagation()} aria-label={`${t(lang, 'viewChart')}: ${r.name}`}>
          {t(lang, 'viewChart')}
        </Button>
      ),
    },
  ];

  const nav = [
    ['colour', 'Colour'],
    ['domains', 'Domain Colours'],
    ['contrast', 'Contrast'],
    ['type', 'Type Scale'],
    ['elevation', 'Surface & Elevation'],
    ['buttons', 'Buttons'],
    ['critical', 'Critical Actions'],
    ['controls', 'Inputs & Controls'],
    ['headers', 'Header Patterns'],
    ['hero', 'Hero Banner'],
    ['icons', 'Icons & Tiles'],
    ['dense', 'Dense Queue'],
    ['focus', 'Focus & A11y'],
  ];

  return (
    <div className="relative isolate min-h-screen bg-base text-ink">
      <GlassToolbar className="flex items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-chip bg-linear-to-br from-primary to-ink text-white shadow-xs">
            <Icon name="brand" size={20} weight="duotone" />
          </span>
          <div>
            <h1 className="text-lg leading-tight font-semibold">Harbor Calm · Clean Surface System</h1>
            <p className="text-2xs text-ink-muted">Dev Style Guide · Doctor portal · tokens from src/styles/tokens.css</p>
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
        <GlassSidebar label="Style guide sections" className="sticky top-20 hidden h-fit w-52 shrink-0 gap-1 rounded-panel p-3 xl:flex">
          {nav.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-chip px-3 py-2 text-footnote font-medium text-ink hover:bg-ice transition-colors">
              {label}
            </a>
          ))}
        </GlassSidebar>

        <main className="flex min-w-0 flex-1 flex-col gap-14">
          {/* ---------------- 1. Colour ---------------- */}
          <Section id="colour" title="Colour Palette" note="Harbor Calm roles, identical in value between Doctor portal and Patient app. Page background #F2F5F8, pure white cards #FFFFFF with 1px #DCE5EA border.">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-4">
              {SWATCHES.map((s) => {
                const hex = TOKENS[`color-${s.name}`];
                return (
                  <div key={s.name} className="flex flex-col overflow-hidden rounded-panel bg-white border border-card-border shadow-xs">
                    <div className="h-16" style={{ background: hex }} />
                    <div className="flex flex-col gap-1 p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-sm">{s.name}</span>
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

          {/* ---------------- 2. Domain Colours ---------------- */}
          <Section
            id="domains"
            title="Domain Colours for Clinical Orientation"
            note="6 semantic clinical domains. Icon tiles = ~12% tint fill + duotone glyph in deep colour (>= 3:1). Status chips = tinted pills with deep text (>= 4.5:1). Every screen has deliberate domain colour."
          >
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {DOMAINS.map((d) => (
                <Card key={d.domain} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconTile domain={d.domain} size="md" />
                      <div>
                        <h3 className="font-semibold text-sm capitalize">{d.label}</h3>
                        <p className="font-mono text-2xs text-ink-muted">domain="{d.domain}"</p>
                      </div>
                    </div>
                    <StatusChip domain={d.domain} label={d.action} />
                  </div>
                  <p className="text-xs text-ink-muted">{d.note}</p>
                  <div className="flex items-center gap-2 pt-2 border-t border-card-border">
                    <IconTile domain={d.domain} size="sm" />
                    <IconTile domain={d.domain} size="md" />
                    <IconTile domain={d.domain} size="lg" />
                    <span className="text-2xs text-ink-muted ml-auto font-mono">sm (32) · md (40) · lg (48)</span>
                  </div>
                </Card>
              ))}
            </div>
          </Section>

          {/* ---------------- 3. Contrast ---------------- */}
          <Section
            id="contrast"
            title="Contrast Verification"
            note={`${PAIRS.length} pairs from src/styles/contrastPairs.ts (same list as npm run check:contrast). Text 4.5:1, icons / focus rings / borders 3:1.`}
          >
            <div className="flex items-center gap-4">
              <Badge tone={failing ? 'danger' : 'success'} icon={failing ? 'error' : 'checkCircle'} size="md" label={failing ? `${failing} failing` : 'All 87 pairs pass'} />
              <Toggle checked={onlyFailing} onChange={setOnlyFailing} label="Show failing only" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {groups.map(({ group, rows }) => (
                <Panel key={group} className="p-4">
                  <h3 className="mb-2 text-sm font-bold">{group}</h3>
                  <ul className="divide-y divide-card-border">
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
                </Panel>
              ))}
            </div>
          </Section>

          {/* ---------------- 4. Type Scale ---------------- */}
          <Section
            id="type"
            title="Type Scale"
            note="Fraunces / Noto Serif for display only, DM Sans / Noto Sans for UI, DM Mono for IDs. Indic: 14px / 500 floor, line-height 1.75 (kn) / 1.70 (hi), no letter-spacing."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              {LANGS.map((l) => (
                <Panel key={l} as="div" lang={l} className="flex flex-col gap-3 p-5">
                  <Badge tone="primary" icon="translate" label={`${LANG_NAME[l]} · lang="${l}"`} />
                  {TYPE_SCALE.map((row) => (
                    <div key={row.label} className="flex flex-col">
                      <span lang="en" className="font-mono text-4xs text-ink-muted">
                        {row.label}
                      </span>
                      <span className={row.className}>{row.sample(l)}</span>
                    </div>
                  ))}
                </Panel>
              ))}
            </div>
          </Section>

          {/* ---------------- 5. Surface & Elevation ---------------- */}
          <Section
            id="elevation"
            title="Clean Surface System & Elevation"
            note="Single-shadow layer replaces all neumorphism. Pure white cards, 1px #DCE5EA border. e1 for static cards, e2 for interactive cards on hover, e3 for modal sheets. No inset shadows, no specular shines."
          >
            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex flex-col gap-3">
                <Label>e1 · Base Card (0 1px 2px rgba(31,58,76,0.06))</Label>
                <Card className="p-5 flex flex-col gap-2">
                  <span className="font-semibold text-sm">Static Card</span>
                  <p className="text-footnote text-ink-muted">Pure #FFFFFF fill with 1px border (#DCE5EA) and subtle e1 elevation.</p>
                </Card>
              </div>
              <div className="flex flex-col gap-3">
                <Label>e2 · Interactive Card (hover/press lifts)</Label>
                <Card interactive className="p-5 flex flex-col gap-2 cursor-pointer">
                  <span className="font-semibold text-sm">Interactive Card</span>
                  <p className="text-footnote text-ink-muted">Lifts to e2 shadow on hover. Hairline border brightens to primary tint.</p>
                </Card>
              </div>
              <div className="flex flex-col gap-3">
                <Label>e3 · Elevated Sheet / Modal (0 12px 32px rgba(31,58,76,0.14))</Label>
                <div className="rounded-panel bg-white p-5 border border-card-border shadow-lg flex flex-col gap-2">
                  <span className="font-semibold text-sm">Modal Sheet Level</span>
                  <p className="text-footnote text-ink-muted">Deep e3 elevation for focused overlays and critical dialogs.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 mt-4">
              <div className="flex flex-col gap-3">
                <Label>Read-only clinical well (subtle tonal inset)</Label>
                <Well className="p-4 text-sm leading-relaxed">
                  <span className="mb-1 flex items-center gap-1.5 text-2xs font-semibold text-ink-muted">
                    <Icon name="clinicalNotes" size={14} /> Clinical findings
                  </span>
                  Mild tenderness right lower quadrant. No guarding. Ultrasound: 4.2 mm calculus, right lower pole calyx.
                </Well>
              </div>
              <div className="flex flex-col gap-3">
                <Label>Divided List Row Panel</Label>
                <Card className="divide-y divide-card-border px-4">
                  {['Consent granted · Lab report', 'Record viewed · Ultrasound', 'Consent expired · Discharge summary'].map((x, i) => (
                    <div key={x} className="flex items-center justify-between py-2.5 text-footnote">
                      <span className="flex items-center gap-2">
                        <Icon name={i === 2 ? 'hourglass' : 'shieldCheck'} size={16} tone={i === 2 ? 'warning' : 'success'} weight="duotone" />
                        {x}
                      </span>
                      <span className="font-mono text-2xs text-ink-muted">2026-10-2{i} 14:3{i}</span>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          </Section>

          {/* ---------------- 6. Buttons ---------------- */}
          <Section
            id="buttons"
            title="Buttons Hierarchy"
            note="Primary = solid primary with white text. Secondary = tonal (ice fill, primary text). Tertiary = text only. Scale .98 + darker on press."
          >
            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex flex-col gap-3">
                <Label>Solid Primary</Label>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" icon="video">Primary</Button>
                  <Button variant="primary" size="sm" icon="video">Small</Button>
                  <Button variant="primary" disabled icon="video">Disabled</Button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Label>Tonal Secondary (Ice fill)</Label>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" icon="chart">Secondary</Button>
                  <Button variant="secondary" size="sm" icon="chart">Small</Button>
                  <Button variant="secondary" disabled icon="chart">Disabled</Button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Label>Tertiary (Text)</Label>
                <div className="flex flex-wrap gap-3">
                  <Button variant="tertiary" icon="sync">Refresh</Button>
                  <Button variant="tertiary" size="sm" icon="back">Back</Button>
                  <Button variant="tertiary" disabled icon="sync">Disabled</Button>
                </div>
              </div>
            </div>
          </Section>

          {/* ---------------- 7. Critical Actions ---------------- */}
          <Section
            id="critical"
            title="Critical Actions"
            note="Flat solid deep colour, icon + label, min height 48-56px, always the highest-contrast element on screen (5.8:1 - 7.9:1). No shiny specular layers or gradient borders."
          >
            {(['primary', 'success', 'danger'] as const).map((tone) => {
              const meta = { primary: ['video', 'Join video consultation'], success: ['send', 'Approve & grant consent'], danger: ['emergency', 'Trigger SOS / Emergency triage'] } as const;
              const [icon, label] = meta[tone];
              return (
                <div key={tone} className="flex flex-wrap items-center gap-6">
                  <span className="w-24 text-footnote font-semibold text-ink-muted capitalize">{tone}</span>
                  <CriticalButton tone={tone} icon={icon} label={label} />
                  <CriticalButton tone={tone} icon={icon} label="Hover state" data-state="hover" />
                  <CriticalButton tone={tone} icon={icon} label="Pressed state" data-state="pressed" />
                  <CriticalButton tone={tone} icon={icon} label={label} loading loadingLabel="Connecting…" />
                  <CriticalButton tone={tone} icon={icon} label="Disabled" disabled />
                </div>
              );
            })}
          </Section>

          {/* ---------------- 8. Inputs & Controls ---------------- */}
          <Section
            id="controls"
            title="Inputs & Interactive Controls"
            note="Inputs: pure white fill, 1px input-border (#728A97, 3.62:1 vs card), 2px primary focus ring, leading icon, visible label. Segmented control: tonal track + white thumb with e1. Toggle: standard switch."
          >
            <div className="grid gap-6 lg:grid-cols-3">
              <TextField label="Practitioner ID" icon="idCard" placeholder="NMC-KA-000000" hint="As printed on your NMC registration" />
              <TextField label="Password" icon="lock" type="password" defaultValue="secret" error="Incorrect password. Try again." />
              <TextField label="Search patients" icon="search" size="sm" placeholder="Name, ABHA, symptom" />
            </div>

            <div className="flex flex-wrap items-end gap-8 pt-4">
              <div className="flex w-96 flex-col gap-2">
                <Label>SegmentedControl (Tonal track + white e1 thumb)</Label>
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
                <Label>Toggle Switch</Label>
                <Toggle checked={toggle} onChange={setToggle} label="Audio priority" stateLabels={['On', 'Off']} />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Filter Chips</Label>
                <div className="flex gap-3">
                  <Chip label={t(lang, 'urgent')} icon="emergency" selected={chip} count={3} onClick={() => setChip(!chip)} />
                  <Chip label={t(lang, 'routine')} icon="checkCircle" selected={!chip} count={9} onClick={() => setChip(!chip)} />
                </div>
              </div>
            </div>
          </Section>

          {/* ---------------- 9. Header Patterns ---------------- */}
          <Section
            id="headers"
            title="Header Patterns"
            note="Doctor <PageHeader> with title, subtitle, one primary action, breadcrumbs. <SectionHeader> = icon + title + count + action, used across all screens."
          >
            <Card className="p-6 flex flex-col gap-6">
              <div>
                <Label>PageHeader Pattern</Label>
                <PageHeader
                  title="Patient Consultation Chart"
                  subtitle="Lakshmi Devi · ABHA 91-4821-7730-2201 · Female, 54y"
                  breadcrumbs={[
                    { label: 'Patient Queue', href: '#' },
                    { label: 'Lakshmi Devi' },
                  ]}
                  action={
                    <Button variant="primary" icon="video">
                      Start Consultation
                    </Button>
                  }
                />
              </div>

              <Divider />

              <div>
                <Label>SectionHeader Pattern</Label>
                <div className="flex flex-col gap-4 mt-2">
                  <SectionHeader
                    icon="records"
                    domain="records"
                    title="Diagnostic Reports & Labs"
                    count={4}
                    action={<Button size="sm" variant="secondary" icon="storeForward">Upload record</Button>}
                  />
                  <SectionHeader
                    icon="medication"
                    domain="medications"
                    title="Active Medications"
                    count={3}
                  />
                </div>
              </div>
            </Card>
          </Section>

          {/* ---------------- 10. Hero Banner ---------------- */}
          <Section
            id="hero"
            title="Hero Block"
            note="Solid primary-to-ink gradient with white text (>= 4.5:1). Used for next-appointment and patient banner blocks. Everything else stays light and crisp."
          >
            <div className="rounded-panel bg-gradient-to-r from-primary to-ink p-6 text-white shadow-md flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 text-white">
                  <Icon name="video" size={28} weight="duotone" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wider text-white">
                      Next in Queue · In 5 min
                    </span>
                    <span className="text-2xs text-white/80">Token #12</span>
                  </div>
                  <h3 className="font-serif text-2xl font-bold mt-1 text-white">Lakshmi Devi (54y, F)</h3>
                  <p className="text-sm text-white/90">Chest pain, 2h · Hassan District Hospital · ABHA 91-4821-7730-2201</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                  Preview Chart
                </Button>
                <CriticalButton tone="primary" icon="video" label="Join Video Call" />
              </div>
            </div>
          </Section>

          {/* ---------------- 11. Icons & Tiles ---------------- */}
          <Section
            id="icons"
            title="Icons & Domain Tiles"
            note="Phosphor registry: regular = inactive, duotone = active. IconTile provides ~12% tint fill and deep domain glyph."
          >
            <div className="flex flex-wrap items-center gap-6">
              {(['appointments', 'medications', 'records', 'privacy', 'followup', 'emergency'] as const).map((domain) => (
                <div key={domain} className="flex flex-col items-center gap-2">
                  <IconTile domain={domain} size="lg" />
                  <span className="text-2xs text-ink-muted capitalize">{domain}</span>
                </div>
              ))}
            </div>

            <Panel as="div" className="grid grid-cols-3 gap-x-4 gap-y-3 p-5 sm:grid-cols-5 lg:grid-cols-8 2xl:grid-cols-10 mt-4">
              {ICON_NAMES.slice(0, 30).map((n) => (
                <div key={n} className="flex flex-col items-center gap-1.5">
                  <div className="flex gap-1.5">
                    <Icon name={n} size={22} tone="ink" />
                    <Icon name={n} size={22} tone="primary" weight="duotone" />
                  </div>
                  <span className="font-mono text-4xs text-ink-muted">{n}</span>
                </div>
              ))}
            </Panel>
          </Section>

          {/* ---------------- 12. Dense Queue ---------------- */}
          <Section
            id="dense"
            title="Dense Clinician Queue & Table"
            note="Desktop row density: 44px rows, tabular numbers, hairline dividers, ice tint selected row with primary accent indicator. No silent truncation."
          >
            <DataTable
              caption="Triage queue (sample data)"
              columns={columns}
              rows={QUEUE}
              rowKey={(r) => r.id}
              selectedKey={selected}
              onRowClick={(r) => setSelected(r.id)}
            />
          </Section>

          {/* ---------------- 13. Focus & A11y ---------------- */}
          <Section
            id="focus"
            title="Focus & Keyboard Navigation"
            note="Every interactive element shows a 2px primary ring with a 2px offset on keyboard focus (ice on night surfaces)."
          >
            <div className="flex flex-wrap items-center gap-6">
              <Button icon="chart" className="outline-2 outline-offset-2 outline-primary">
                Focused button
              </Button>
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
            <p className="text-footnote text-ink-muted">Reduced motion: transitions and animations collapse to instant. Reduced transparency: glass becomes solid.</p>
          </Section>
        </main>
      </div>
    </div>
  );
}
