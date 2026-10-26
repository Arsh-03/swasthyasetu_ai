# Design Decision Log — UI System Corrections

**Document ID:** UI-DECISION-LOG-SS-2026-V1  
**Applies to:** Patient app (`frontend Patient/`), Doctor portal (`frontend Doctor/`), and shared design specifications (`docs/05_ui_ux/`).

---

## 2026-10-26: Rejection of Neumorphic-Glass V1 (`ui-neumorphic-v1`) & Pivot to Clean Harbor Calm Surface System

### Context
A neumorphic-glass redesign was implemented across both the Patient app and the Doctor portal (commits tagged `ui-neumorphic-v1`, beginning with `feat(patient): new neumorphic-glass UI`). It introduced dual-source raised shadows, inset wells, ambient gradient background blobs, floating glass pill tab bars, embossed decorative icons, and complex specular surface effects.

### Decision
Following a comprehensive review by clinical, engineering, and product stakeholders, **the neumorphic-glass UI direction was completely rejected**. The team mandated a return to the clean, crisp layout structure of the pre-redesign system, enhanced with the Harbor Calm palette, the new typography, domain-oriented clinical colours, and a lightweight single-shadow surface system.

### Rationale for Rejection
1. **Unsuitable for Healthcare Products**:
   - Neumorphism creates soft, ambiguous boundaries. In clinical decision-making, ambiguous boundaries reduce scan speed and introduce cognitive friction.
   - Low contrast on pressed/inset states compromised critical medical workflows (e.g. distinguishing whether a dose was marked taken, or whether a toggle was engaged).
2. **Excessive Whitespace & Lost Clinical Density**:
   - Neumorphic surfaces require massive padding and gutter buffers to avoid visual shadow collision.
   - On the Patient app, critical actions like the next appointment and SOS were pushed below the fold on standard devices (360×740).
   - On the Doctor portal, the patient queue showed fewer than 4 visible rows on standard clinician displays (1280×720), requiring continuous scrolling during busy triage shifts.
3. **Control Ambiguity**:
   - Users struggled to identify what was actionable (raised) versus informative (inset), especially in low-light hospital environments or bright sunlight in rural outpatient clinics.
4. **Performance & Visual Artifacts**:
   - Heavy dual box-shadows, inset shadows, and continuous ambient blur blobs caused dropped frames on low-cost Android hardware (e.g. 2GB RAM devices running Expo).

---

### What Was Kept (Non-Visual & Core Foundations)
The team retained all solid non-visual and foundational enhancements introduced during the redesign:
- **Foundational Palette & Parity**:
  - Primary (`#3E6985`), Ink (`#1F3A4C`), Ice (`#D6EBF3`), Sand (`#EDEBE4`), Night (`#13242F`), and deep status variants (`successDeep`, `dangerDeep`, `warningDeep`, `goldDeep`).
  - Strict 1:1 token parity between Patient (`tokens.ts`) and Doctor (`tokens.css`).
- **Typography & Script Rules**:
  - Headings: Fraunces / Noto Serif (display only).
  - UI / Body: DM Sans / Noto Sans.
  - IDs & Timestamps: DM Mono (Latin only).
  - Script metrics: 14px floor for Kannada and Devanagari, line-height 1.75 (kn) / 1.70 (hi), no letter-spacing or uppercase on Indic text.
- **Iconography**:
  - Phosphor icon registry: Regular weight for inactive/idle, Duotone for active/selected.
  - Strict semantic registry mapping across both applications.
- **Internationalization & Formatting**:
  - `i18n`, `formatDate`, `formatTimestamp`, `localized()`, and multi-script handling.
- **Tooling & Dev Infrastructure**:
  - Automated mathematical contrast checkers (`npm run contrast` / `npm run check:contrast`) verifying 87 strict WCAG AA/AAA pairs.
  - Self-hosted woff2 fonts and local icons in Doctor portal (zero external CDN dependency).
  - Dev-only Style Guides in both apps (`StyleGuideScreen.tsx` in Patient, `?styleguide` in Doctor).
- **Core Principles 1–4**:
  - 1. Calm over clever
  - 2. Show, don't tell
  - 3. Consent is sacred
  - 4. One look everywhere

---

### What Was Removed
- **All Neumorphic Shadow Primitives**:
  - Dual raised shadows (`neu-raised`, `neu-raised-soft`, `neuRaised`, `neuRaisedSoft`).
  - Inset shadow wells (`neu-inset`, `neu-inset-soft`, `neuInset`, `neuInsetSoft`).
  - Debossed grooves (`neu-groove`).
  - Light/dark dual-point gradient fills on surfaces.
- **Ambient Blobs & Specular Effects**:
  - `AmbientBackground` decorative SVG gradient blobs.
  - Glass specular highlights (1px white top-left gradient edges).
  - Sheen overlays on buttons (`criticalSheen`).
- **Floating Controls**:
  - Floating pill bottom navigation tab bar (replaced with a docked, clean bottom bar).
- **Embossed Icons**:
  - Multi-layer drop-shadow icon copies (`EmbossedIcon`).

---

### New Surface System & Density Rules Introduced
1. **Lightweight Surface Elevation**:
   - `e1`: `0 1px 2px rgba(31,58,76,0.06)` — Standard static cards.
   - `e2`: `0 4px 12px rgba(31,58,76,0.08)` — Interactive cards on hover/press.
   - `e3`: `0 12px 32px rgba(31,58,76,0.14)` — Modals, dialogs, and sheets.
   - One shadow layer each; pure white cards (`#FFFFFF`) with 1px border (`#DCE5EA`) on canvas (`#F2F5F8`).
2. **Domain Colours for Orientation**:
   - Appointments & Consultations: `primary` (`#3E6985`), tint `#E8F0F5`
   - Medications: `teal` (`#407E8C`), deep `#215661`, tint `#E8F2F4`
   - Records & Reports: `gold` (`#A58D66`), deep `#756245`, tint `#F5EFE6`
   - Privacy & Consent: `navy` (`#083A4F`), deep `#083A4F`, tint `#E2ECF0`
   - Follow-up: `warning` (`#E0953A`), deep `#8E5816`, tint `#FAF0E4`
   - Emergency / Triage: `danger` (`#D64545`), deep `#C02A2A`, tint `#FAECEC`
   - Icon tiles: ~12% tint fill + duotone glyph in deep colour (≥ 3:1).
   - Status chips: tinted pill with deep text (≥ 4.5:1).
3. **Flat Solid Critical Actions**:
   - SOS, Approve/Decline consent, Join call, End call: flat solid deep color, 48–56px height, white text (≥ 5.8:1 contrast).
4. **Strict Whitespace & Viewport Targets**:
   - Spacing scale: `4, 8, 12, 16, 20, 24`.
   - Mobile: 16px screen padding, 12–16px card padding, 12px card gap, 16–20px section gap.
   - Desktop: 16px gap, 24px padding, 1440px max content width.
   - Patient 360×740: Next-appointment hero with Join, 4 quick actions, and SOS must appear in the first viewport without scrolling.
   - Doctor 1280×720: Patient queue + preview shows at least 6 queue rows (8 at 1440×900).
   - Medications & Records 390×844: At least 3 items visible above the fold.
