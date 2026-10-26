# Design Principles & Design QA Checklist

**Document ID:** UI-PRINCIPLES-SS-2026-V2.0  
**Applies to:** Patient app (`frontend Patient/`) and Doctor portal (`frontend Doctor/`). Both use the clean Harbor Calm surface system ([design_system_tokens.md](design_system_tokens.md)).  
**History:** Supersedes V1 neumorphic-glass principles following team review rejection of `ui-neumorphic-v1` ([design_decision_log.md](design_decision_log.md)).

Our users include first-time smartphone users, people who read Kannada or Hindi better than English, and patients and clinicians deciding about sensitive medical data in time-critical environments. Every screen is judged against these four principles. When two principles conflict, the lower number wins.

---

## 1. Calm over clever

The app should lower anxiety and increase clarity, not raise visual noise.

| Do | Don't |
|---|---|
| Use the Harbor Calm palette: `#F2F5F8` base canvas, crisp pure white cards (`#FFFFFF`) with 1px `#DCE5EA` border, single-shadow elevation (`e1`, `e2`, `e3`). | Add neumorphic dual-source raised shadows, inset wells, ambient gradient blobs, or decorative specular shines. |
| Keep spacing tight and purposeful: spacing scale `4 / 8 / 12 / 16 / 20 / 24`. Mobile padding 16, card gap 12, section gap 16–20. | Leave vast empty gaps or stack cards inside cards to fill screen real estate. |
| Use 150 ms / 250 ms / 400 ms ease-out motion that settles quickly and quietly; scale `.98` on button press. | Bounce, wobble, animate shadows continuously, or loop decorations for attention. |
| Show one toast at a time, worded plainly ("Consent approved", "Dose recorded"). | Stack alerts, use exclamation marks, or say "Oops!". |

---

## 2. Show, don't tell

Lead with domain colour orientation, semantic duotone icons, short labels, and an audio option. Use paragraphs only when clinical explanation or consent law requires them.

| Do | Don't |
|---|---|
| Use 6 deliberate domain colours for orientation: **Appointments & Calls** (primary), **Medications** (teal `#407E8C`), **Clinical Records** (gold/sand `#A58D66`), **Privacy & Consent** (navy `#083A4F`), **Follow-up** (warning amber `#E0953A`), **Emergency** (danger red `#D64545`). | Allow screens to read as an undifferentiated grey wash. Never use purple or pink. |
| Icon tiles = ~12% tint fill + duotone glyph in deep domain colour (≥ 3:1). Status chips = tinted pills with deep text (≥ 4.5:1). | Rely on coloured dots alone, plain grey status pills, or generic un-tinted tiles. |
| Dose row = time-of-day icon + medicine name + "Take" button (min height 48px) that turns into a tick with high contrast. | Write out lengthy reminder sentences like "Please remember to take your morning dose of…". |
| Put an audio (Listen) button on every consent, diagnostic, or prescription card. | Rely solely on reading for anything that affects the patient's health or medical data. |
| Hero blocks (next appointment, patient banner) use a solid primary-to-ink gradient with white text (≥ 4.5:1). | Use low-contrast gradient wash cards or decorative unreadable imagery. |

---

## 3. Consent is sacred

**Critical actions are flat, solid, deep-coloured, and always the highest-contrast element on screen (5.8:1 – 7.9:1).**

Anything that shares health data, contacts emergency services, or connects a live call must be unmistakable.

| Do | Don't |
|---|---|
| Use `CriticalButton` for Authorize / Decline consent, Emergency SOS, Join call, and End call: flat solid deep fill (`primary`, `successDeep`, `dangerDeep`), white icon + bold label, min height 48–56px. | Render critical actions with neumorphic sheen overlays, inset wells, ghost borders, or without clear textual labels. |
| State who is asking, for what record, why, and for how long, before the action buttons. | Hide clinical purpose or duration behind a disclosure accordion. |
| Keep consent sheets non-dismissible: no backdrop tap, patient must actively choose. | Let a stray tap dismiss (or accidentally approve) a consent request. |
| Gold badges are reserved exclusively for ABDM verification. | Use gold as generic decoration or accent. |

---

## 4. One look everywhere

Identical component semantics, token parity, and density standards across the Patient app and Doctor portal in all three languages (English, Kannada, Hindi).

| Do | Don't |
|---|---|
| Build screens from the shared UI kit (`Card`, `Panel`, `Field`, `Button`, `CriticalButton`, `IconTile`, `Badge`, `PageHeader`, `SectionHeader`, `ListRow`/`DataTable`). | Hand-style one-off buttons, ad-hoc cards, or custom shadows directly on screens. |
| Follow the clean surface system: `e1` (static card), `e2` (interactive card hover/press), `e3` (modal/sheet). | Re-introduce neumorphism, dual raised/inset shadows, or EmbossedIcon drop shadows. |
| Maintain 1:1 token parity between Patient `tokens.ts` and Doctor `tokens.css`. | Create mismatched colour or spacing values between the two applications. |
| Inputs: pure white fill, 1px input-border (`#728A97`, ≥ 3:1 against card and canvas), 2px primary focus ring, leading icon, visible label. | Use faint borders that fail non-text contrast (< 3:1). |
| All strings localized in translations (en / kn / hi); Indic text respects the 14px floor and line-height multipliers. | Hard-code English strings or truncate Kannada/Hindi conjuncts. |

---

## Structure and Density Rules (Measurable Targets)

The main complaint regarding V1 was wasted whitespace and low information density. All screens must strictly adhere to the following layout specifications:

### Spacing Scale
- Token values: `4, 8, 12, 16, 20, 24` px.
- Mobile screen padding: `16px`.
- Card internal padding: `12–16px`.
- Gap between cards: `12px`.
- Gap between sections: `16–20px`.
- Desktop page padding: `24px`, gap `16px`, maximum content width `1440px`.
- **Zero decorative empty gaps; no cards nested inside other cards.**

### Header Patterns
- **Patient Compact Header**: Compact `48–56px` header bar with title and back navigation (no giant oversized titles with large empty margins).
- **Doctor PageHeader**: `<PageHeader>` with title, subtitle, one primary action, and breadcrumbs on deep pages.
- **SectionHeader**: `<SectionHeader>` = icon + domain colour + title + count badge + optional trailing action, used consistently across all sections.

### List & Table Density
- Mobile rows: min `56px` height, hairline divider (`#DCE5EA`), selected state = ice tint (`#D6EBF3`) + 3px solid primary accent bar.
- Desktop rows: dense `44px` height, tabular numbers (`font-variant-numeric: tabular-nums`), hairline dividers.
- Clinical notes & descriptions: clamp to 2 lines with an explicit expand affordance (**never silent truncation**).

### Measurable Viewport Targets
- **Patient Home (360×740)**: The next-appointment hero card with Join call action, all 4 quick-action tiles, and Emergency SOS must appear completely in the first viewport without requiring user scroll.
- **Doctor Queue (1280×720)**: Queue + patient preview panel must display at least **6 queue rows** above the fold without scrolling (at least **8 rows** at 1440×900).
- **Patient Medications & Records (390×844)**: Each screen must display at least **3 items** above the fold.
- **Orientation Target**: Every screen must answer *"What do I do next?"* in the top third of the viewport.

---

## Design QA Checklist

Run this checklist against every screen modification.

### 1. Contrast & Surface System
- [ ] Automated contrast passes (`npm run contrast` for Patient, `npm run check:contrast` for Doctor) — all 87 pairs pass.
- [ ] No neumorphic dual shadows, inset wells, or specular gradients exist.
- [ ] Cards are pure `#FFFFFF` with 1px `#DCE5EA` border and single-shadow `e1` elevation.
- [ ] Inputs have visible labels, leading icons, 1px `#728A97` border (≥ 3:1 vs canvas & card), and 2px primary focus ring.
- [ ] Critical actions use flat solid fills (`primary`, `successDeep`, `dangerDeep`), min 48–56px height, white text (≥ 5.8:1).
- [ ] No raw hex codes outside token files (`src/theme/` in Patient, `src/styles/` in Doctor).

### 2. Information Density & Whitespace
- [ ] Spacing conforms strictly to `4 / 8 / 12 / 16 / 20 / 24` scale.
- [ ] No cards inside cards; no artificial empty spacer blocks.
- [ ] Patient Home meets 360×740 viewport target (hero + 4 tiles + SOS visible above fold).
- [ ] Doctor queue meets 1280×720 target (≥ 6 rows visible).
- [ ] Medications & Records meet 390×844 target (≥ 3 items visible).

### 3. Typography & Multi-Script Integrity
- [ ] Fraunces / Noto Serif used for display only; DM Sans / Noto Sans for UI body; DM Mono for IDs.
- [ ] Indic floor of 14px respected with 1.75 (kn) / 1.70 (hi) line-height multipliers; no letter-spacing or uppercase on Indic text.
- [ ] Switch EN → ಕನ್ನಡ → हिंदी: no text clips, matras remain intact, labels wrap rather than truncate.
- [ ] Clinical text clamps to 2 lines with expand button (no silent ellipsis clipping).

### 4. Accessibility & Touch Targets
- [ ] Touch targets ≥ 48 × 48px on mobile; dense desktop rows ≥ 44px.
- [ ] Every icon button has an accessible label (`accessibilityLabel` / `aria-label`).
- [ ] Focus rings visible on keyboard navigation: 2px primary ring with 2px offset (ice ring on night surfaces).
- [ ] Audio listen button present on all consent and diagnostic summary cards.
- [ ] Reduce motion preference respected: transitions collapse to instant, no scale animations.
