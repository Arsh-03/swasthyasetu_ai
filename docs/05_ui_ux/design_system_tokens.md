# Design System Tokens V2.3 — "Harbor Calm (Clean Surface System)"

**Document ID:** UI-TOKENS-SS-2026-V2.3  
**Applies to:** Patient app (`frontend Patient/`, Expo SDK 58 / React Native) and Doctor portal (`frontend Doctor/`, Vite 8 + React 19 web).  
**Source of truth in code:** `frontend Patient/src/theme/` (`palette.ts`, `tokens.ts`, `fonts.ts`, `motion.ts`, `contrastPairs.ts`) and `frontend Doctor/src/styles/tokens.css`.  
**History:** Supersedes V2.1 neumorphic-glass hybrid following team review rejection of `ui-neumorphic-v1` ([design_decision_log.md](design_decision_log.md)). Replaced all neumorphic dual shadows, inset wells, ambient gradient blobs, and floating pills with a clean, high-density elevation surface system and 6 domain clinical orientation colours.  
**Related:** [design_principles.md](design_principles.md) · [design_decision_log.md](design_decision_log.md) · [motion_and_illustration.md](motion_and_illustration.md)

---

## 1. Clean Surface System & Elevation

The UI completely eliminates neumorphic dual shadows, inset wells, and ambient blobs. It uses single-layer elevation tokens on crisp light surfaces.

| Token | CSS Shadow / Web | React Native Shadow | Role |
|---|---|---|---|
| `e1` | `0 1px 2px rgba(31,58,76,0.06)` | `shadowColor: '#1F3A4C', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1` | Standard static cards & containers |
| `e2` | `0 4px 12px rgba(31,58,76,0.08)` | `shadowColor: '#1F3A4C', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3` | Interactive cards on hover/press |
| `e3` | `0 12px 32px rgba(31,58,76,0.14)` | `shadowColor: '#1F3A4C', shadowOffset: {width: 0, height: 8}, shadowOpacity: 0.14, shadowRadius: 16, elevation: 8` | Modals, sheets, dialogs, floating menus |

### Surfaces & Structural Rules
- **Canvas Base**: `#F2F5F8` (clean, lighter foundation).
- **Cards**: Pure white `#FFFFFF` with a crisp `1px` border in `#DCE5EA` (`cardBorder`) and `e1` elevation.
- **Interactive Cards**: Lift to `e2` on hover or press.
- **Wells (Read-only Text)**: Subtle `#F8FAFC` fill with `1px #DCE5EA` border (no inset shadows).
- **Inputs**: Pure `#FFFFFF` fill, `1px` border in `#728A97` (`inputBorder`, strictly ≥ 3:1 non-text contrast against surrounding card and canvas), `2px` primary focus ring, leading icon, and visible label above.
- **Segmented Control**: Tonal track, white thumb with subtle `1px #DCE5EA` border and `e1` shadow.
- **Toggle**: Standard switch with tonal track and pure white round knob.
- **Dividers**: Clean hairline dividers (`#DCE5EA`), no debossed grooves.
- **Glass**: Subtle blur, fill ~`0.80–0.85`, hairline border. Reserved strictly for docked top bars, docked bottom tab bar, and modal sheets. Ambient background blobs and specular highlights are completely removed.

---

## 2. Colour System

### 2.1 Core Palette Roles (1:1 Patient & Doctor Parity)

| Token | Hex | Role | Usage |
|---|---|---|---|
| `ink` | `#1F3A4C` | Primary text, brand gradient end | Yes (≥ 10.86:1 on canvas, 11.88:1 on card) |
| `inkMuted` | `#576771` | Secondary text | Yes (≥ 5.36:1 on canvas, 5.86:1 on card) |
| `primary` | `#3E6985` | Primary actions, links, active state | Yes (≥ 5.38:1 on canvas, 5.89:1 on card) |
| `primaryDeep` | `#335870` | Hover / pressed solid primary | Solid button hover, high-contrast links (7.58:1 on card) |
| `primarySoft` | `#8FA8B5` | Fills, borders, disabled critical fill | **Never for text** |
| `ice` | `#D6EBF3` | Tonal secondary button fill, active row background | Surface fill; muted text on `night` |
| `teal` | `#407E8C` | Medications domain primary | Domain accents, icon tiles |
| `tealDeep` | `#215661` | Medications text, icons, solid fill | Text on teal tint (8.18:1 on card) |
| `navy` | `#083A4F` | Privacy / consent domain primary | Domain accents, privacy orientation |
| `navyDeep` | `#083A4F` | Privacy text, icons, solid fill | Text on navy tint (12.15:1 on card) |
| `base` | `#F2F5F8` | Page canvas background | Canvas background in both apps |
| `card` | `#FFFFFF` | Card surface | Pure white card fill |
| `cardBorder` | `#DCE5EA` | 1px border for all cards and dividers | Hairline structural dividers |
| `inputBorder` | `#728A97` | 1px border for all text inputs | Non-text contrast: 3.62:1 vs card, 3.31:1 vs canvas |
| `sand` | `#EDEBE4` | Muted surface tint / legacy record fill | Surface fill |
| `gold` | `#A58D66` | Clinical records domain / verified accent | Domain accents |
| `goldDeep` | `#756245` | Verified badge / records text & glyphs | Text on gold tint (5.85:1 on card) |
| `success` | `#2F9E6E` | Status fills, active indicators | Accent fills |
| `successDeep` | `#22714F` | Success text, Approve consent fill | Text & critical fill (5.93:1 on card) |
| `warning` | `#E0953A` | Warning / follow-up domain fills | Dots, icons |
| `warningDeep` | `#8E5816` | Warning / follow-up text & glyphs | Text on warning tint (5.90:1 on card) |
| `danger` | `#D64545` | Danger / emergency domain fills | Dots, badges |
| `dangerDeep` | `#C02A2A` | Danger text, SOS / End call fill | Text & critical fill (5.82:1 on card) |
| `night` | `#13242F` | Call screen, dark video interface | Dark backdrop (white text 15.9:1) |

> **Palette Constraint:** Never use purple or pink. Don't let the UI read as an undifferentiated grey wash: every screen needs deliberate colour in headers, icon tiles, and status indicators.

---

### 2.2 Domain Colours for Clinical Orientation

The UI uses 6 distinct semantic domain colours to orient patients and clinicians instantly:

| Domain | Semantic Area | Base Tone | Deep Text/Glyph | Tint Fill (~12%) | IconTile & StatusChip Usage |
|---|---|---|---|---|---|
| **appointments** | Consultations, Video Calls, Schedules | `primary` (`#3E6985`) | `primaryDeep` (`#335870`) | `#E8F0F5` | Calendar/video visits, appointment triage |
| **medications** | Prescriptions, Dosages, Refills | `teal` (`#407E8C`) | `tealDeep` (`#215661`) | `#E8F2F4` | Active prescriptions, daily medicine schedules |
| **records** | Diagnostic Reports, Labs, Imaging | `gold` (`#A58D66`) | `goldDeep` (`#756245`) | `#F5EFE6` | Ultrasound scans, blood tests, discharge summaries |
| **privacy** | ABHA ID, Consent Tokens, Audit Logs | `navy` (`#083A4F`) | `navyDeep` (`#083A4F`) | `#E2ECF0` | Consent requests, access history, identity tokens |
| **followup** | Reviews Due, Expiring Consents | `warning` (`#E0953A`) | `warningDeep` (`#8E5816`) | `#FAF0E4` | Review dates, time-sensitive doctor follow-ups |
| **emergency** | Acute Triage, SOS Ambulance, Urgent | `danger` (`#D64545`) | `dangerDeep` (`#C02A2A`) | `#FAECEC` | 108/112 SOS callouts, immediate clinical escalation |

- **`<IconTile domain="...">`**: Rendered as a `~12%` domain tint fill + duotone glyph in the domain's deep colour (verified ≥ 3:1 non-text contrast against card and canvas).
- **`<Badge domain="...">` / `<StatusChip domain="...">`**: Rendered as a tinted pill with deep text (verified ≥ 4.5:1 text contrast against card and canvas).
- **Hero Blocks**: Next appointment and patient banner blocks use a solid `primary → ink` gradient with white text (≥ 4.5:1).

---

### 2.3 Contrast Table (87 Pairs Verified)

All 87 color pairs in `src/theme/contrastPairs.ts` (Patient) and `src/styles/contrastPairs.ts` (Doctor) pass mathematically:

| Group | Key Checked Pairs | Ratio | Required | Status |
|---|---|---|---|---|
| **Surfaces** | `ink` on `card` (`#FFFFFF`) | 11.88:1 | 4.5:1 | **Pass** |
| | `inkMuted` on `card` (`#FFFFFF`) | 5.86:1 | 4.5:1 | **Pass** |
| | `primary` on `card` (`#FFFFFF`) | 5.89:1 | 4.5:1 | **Pass** |
| | `primaryDeep` on `card` (`#FFFFFF`) | 7.58:1 | 4.5:1 | **Pass** |
| | `tealDeep` on `card` (`#FFFFFF`) | 8.18:1 | 4.5:1 | **Pass** |
| | `navyDeep` on `card` (`#FFFFFF`) | 12.15:1 | 4.5:1 | **Pass** |
| | `successDeep` on `card` (`#FFFFFF`) | 5.93:1 | 4.5:1 | **Pass** |
| | `warningDeep` on `card` (`#FFFFFF`) | 5.90:1 | 4.5:1 | **Pass** |
| | `dangerDeep` on `card` (`#FFFFFF`) | 5.82:1 | 4.5:1 | **Pass** |
| | `goldDeep` on `card` (`#FFFFFF`) | 5.85:1 | 4.5:1 | **Pass** |
| | `primary` on `ice` (tonal secondary button) | 4.78:1 | 4.5:1 | **Pass** |
| | `primaryDeep` on `ice` (tonal active) | 6.15:1 | 4.5:1 | **Pass** |
| | `inputBorder` (`#728A97`) on `card` | 3.62:1 | 3:1 | **Pass** |
| | `inputBorder` (`#728A97`) on `base` | 3.31:1 | 3:1 | **Pass** |
| **Domain Chips (Text)** | `appointments` chip text on card | 6.43:1 | 4.5:1 | **Pass** |
| | `medications` chip text on card | 7.07:1 | 4.5:1 | **Pass** |
| | `records` chip text on card | 5.20:1 | 4.5:1 | **Pass** |
| | `privacy` chip text on card | 9.73:1 | 4.5:1 | **Pass** |
| | `followup` chip text on card | 5.33:1 | 4.5:1 | **Pass** |
| | `emergency` chip text on card | 4.96:1 | 4.5:1 | **Pass** |
| **Domain Tiles (Icons)** | `appointments` tile icon on card | 6.43:1 | 3:1 | **Pass** |
| | `medications` tile icon on card | 7.07:1 | 3:1 | **Pass** |
| | `records` tile icon on card | 5.20:1 | 3:1 | **Pass** |
| | `privacy` tile icon on card | 9.73:1 | 3:1 | **Pass** |
| | `followup` tile icon on card | 5.33:1 | 3:1 | **Pass** |
| | `emergency` tile icon on card | 4.96:1 | 3:1 | **Pass** |
| **Critical Actions** | White on critical primary (Join call) | 5.89:1 | 4.5:1 | **Pass** |
| | White on critical primary pressed | 7.58:1 | 4.5:1 | **Pass** |
| | White on critical success (Approve consent) | 5.93:1 | 4.5:1 | **Pass** |
| | White on critical danger (SOS / Decline / End call) | 5.82:1 | 4.5:1 | **Pass** |
| | White on critical danger pressed | 7.41:1 | 4.5:1 | **Pass** |
| **Night & Glass** | White on `night` (`#13242F`) | 15.90:1 | 4.5:1 | **Pass** |
| | `ice` on `night` | 12.90:1 | 4.5:1 | **Pass** |
| | `ink` on toolbar glass over base | 11.76:1 | 4.5:1 | **Pass** |
| | `primary` focus ring on card | 5.89:1 | 3:1 | **Pass** |

---

## 3. Typography & Multi-Script Metrics

| Role | English | Kannada | Hindi | Weights |
|---|---|---|---|---|
| **Display (Serif)** | Fraunces | Noto Serif Kannada | Noto Serif Devanagari | 600, 700 |
| **UI (Sans)** | DM Sans | Noto Sans Kannada | Noto Sans Devanagari | 400, 500, 600, 700 |
| **IDs (Mono)** | DM Mono | DM Mono | DM Mono | 400, 500 |

- Serif is restricted to display: `largeTitle` (30), `title` (24), `title2` (20), `metric` (32).
- Sans is used for all UI text: `headline` (17), `body` (16), `callout` (16), `subhead` (15), `footnote` (13), `caption` (12).
- **Indic Script Metrics**: Kannada text multiplied by 1.1 with line-height 1.75; Hindi multiplied by 1.05 with line-height 1.70.
- **Indic Floor**: Any caption or eyebrow in Kannada/Devanagari has a minimum floor of `14px` and weight ≥ 500 (no uppercase or letter-spacing).
- **Mixed-Script Splitting**: Latin tokens (doctor names, ABHA IDs, medicine names, dates) render with DM Sans/DM Mono, while Indic text renders with Noto Sans/Serif, preserving visual consistency across translations.

---

## 4. Components & Buttons Hierarchy

### 4.1 Buttons
- **Primary Button**: Solid `primary` (`#3E6985`) fill, white text (≥ 5.89:1), hover `primaryDeep`.
- **Secondary Button**: Tonal `ice` (`#D6EBF3`) fill, `primary` text (≥ 4.78:1).
- **Tertiary Button**: Text-only button with hover background tint.
- **Critical Action Button**: Flat solid deep fill (`primary`, `successDeep`, `dangerDeep`), min height `48–56px`, white text (≥ 5.8:1), highest-contrast element on screen (no shiny specular layer or gradient borders).
- **Pressed State**: Scale `.98` + darker fill (150ms ease-out).

### 4.2 Inputs & Fields
- Pure `#FFFFFF` fill with `1px` border in `#728A97` (`inputBorder`).
- Focus state: `2px` primary focus ring with `2px` offset.
- Always accompanied by a leading icon and visible label above.

### 4.3 Lists & Tables
- **Mobile ListRow**: Min `56px` height, hairline divider (`#DCE5EA`), selected state = `ice` tint + 3px solid primary accent bar.
- **Doctor DataTable**: Dense `44px` height desktop rows, tabular numbers (`font-variant-numeric: tabular-nums`), hairline dividers, ice tint selected row.
- **No silent truncation**: Clinical descriptions clamp to 2 lines with an explicit expand affordance.

---

## 5. Structure and Density Rules (Measurable Targets)

### Spacing Scale
`4 / 8 / 12 / 16 / 20 / 24` px.
- Mobile screen padding: `16px`.
- Card padding: `12–16px`.
- Gap between cards: `12px`.
- Gap between sections: `16–20px`.
- Desktop page padding: `24px`, gap `16px`, maximum content width `1440px`.
- **No decorative empty gaps; no cards nested inside other cards.**

### Header Patterns
- **Patient Compact Header**: `48–56px` header bar with title and back navigation.
- **Doctor PageHeader**: Title, subtitle, primary action, breadcrumbs on deep pages.
- **SectionHeader**: `<SectionHeader>` = icon + domain colour + title + count badge + optional trailing action.

### Measurable Viewport Targets
- **Patient Home (360×740)**: Next-appointment hero with Join, 4 quick actions, and SOS must appear completely in the first viewport.
- **Doctor Queue (1280×720)**: Queue + preview shows at least **6 queue rows** above the fold (**8 rows** at 1440×900).
- **Medications & Records (390×844)**: Each screen shows at least **3 items** above the fold.
- **Orientation**: Every screen answers *"What do I do next?"* in the top third of the viewport.
