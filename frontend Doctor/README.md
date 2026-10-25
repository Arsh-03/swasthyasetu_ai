# SwasthyaSetu: Doctor Clinical Portal

Desktop web app for clinicians: the triage queue, patient chart, DPDP consent requests, clinical records, the audit ledger and video consultations. It talks to the FastAPI backend in `../backend` over REST (`src/services/api.ts`) and a WebSocket for call signalling and consent events.

Stack: **Vite 8 · React 19 · TypeScript 6 · Tailwind CSS 4** (build-time, via `@tailwindcss/vite`) · Phosphor icons · self-hosted fonts (Fontsource). Node **22.18+** (Node 24 recommended; `check:contrast` runs TypeScript directly).

## Run

```bash
npm install
npm run dev              # http://localhost:5173 (expects the backend on http://localhost:8000)
npm run build            # type-check + production build into dist/
npm run lint             # oxlint
npm run check:contrast   # WCAG ratios for every colour pair in the design system (exits 1 on failure)
```

Style Guide (development only): run `npm run dev` and open **`/?styleguide`**. It shows the swatches with contrast ratios, the type scale in English / ಕನ್ನಡ / हिंदी, the depth language, the controls, the icons, glass over the ambient background, every `CriticalButton` state, a dense queue table and the focus states. It is not included in production builds.

## Design system: Harbor Calm (shared with the Patient app)

The portal uses the same tokens as `frontend Patient/` (neumorphic-glass hybrid), as a denser clinician variant. Read these before changing UI:

- [design_system_tokens.md § 11 (Web / Doctor portal)](../docs/05_ui_ux/design_system_tokens.md#11-web-doctor-portal): tokens, classes, fonts, icons, UI kit, density and accessibility rules
- [design_principles.md](../docs/05_ui_ux/design_principles.md): the four principles, the Doctor reading of them and the desktop QA checklist
- [motion_and_illustration.md § 3](../docs/05_ui_ux/motion_and_illustration.md#3-web-motion-doctor-portal): web motion

```
src/
  styles/
    tokens.css         the ONLY place raw colours live (Tailwind @theme + :root variables)
    fonts.css          self-hosted @font-face (DM Sans, Fraunces, DM Mono, Noto Sans/Serif Kannada + Devanagari)
    base.css           canvas, focus ring, per-script typography (<html lang>), reduced motion
    utilities.css      neu-* depth, groove, critical, glass, ambient
    contrast*.ts       WCAG maths + checked pairs (used by scripts/check-contrast.ts and the Style Guide)
  components/
    ui/                UI kit: Icon (+ iconRegistry), NeuPanel/NeuRaised/NeuInset/Groove, NeuButton,
                       CriticalButton, IconDisc/EmbossedIcon, SegmentedControl, TextField, Toggle,
                       Badge/Chip, DataTable, GlassToolbar/GlassSidebar/GlassSheet, AmbientBackground
    *.tsx              screens (login, header, queue, chart, consultation, records, audit, consent modal)
  hooks/useDialogA11y.ts   focus-in, focus trap, Esc, focus return for modal dialogs
  dev/StyleGuide.tsx       dev-only Style Guide
  services/api.ts          REST + WebSocket config (app logic, untouched by UI work)
  utils/translations.ts    every UI string in en / kn / hi
```

Rules of thumb:

- Use token classes (`text-ink-muted`, `bg-success-tint`, `bg-primary`) and kit components. No hex values outside `src/styles/`.
- Icons come from `<Icon name=… />` only (`src/components/ui/iconRegistry.ts`); never import Phosphor or use emoji in a screen. Icon-only buttons need an `aria-label`.
- Status text and icons use the `*-deep` colours; status fills behind text use `*-tint`; `primary-soft` and `fog` are never text.
- Critical actions (send consent, start / end call, sign note) use `CriticalButton`.
- Every string goes into `translations.ts`. The selected language sets `<html lang>`, which switches the Kannada / Hindi typography rules (14px / 500 floor, line-height 1.75 / 1.70, no letter-spacing).
- No third-party requests at runtime: fonts and icons are bundled.

## Notes

- `vite.config.ts` includes a small transform that keeps only the `regular` and `duotone` weights of each Phosphor icon (the design system uses only those two), which makes each icon module about ⅔ smaller.
- Some screens still use fallback avatar images from `lh3.googleusercontent.com` (`ConsultationWorkspace`, `PatientQueueView`, `PatientMedicalChartView`). They are replaced screen by screen in Phase 2 of the redesign.
