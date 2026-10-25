# Design System Tokens V2 — "Harbor Calm"

**Document ID:** UI-TOKENS-SS-2026-V2.1
**Applies to:** Patient app (`frontend Patient/`, Expo SDK 58 / React Native) and Doctor portal (`frontend Doctor/`, Vite + React 19 web, see [§ 11](#11-web-doctor-portal))
**Source of truth in code:** `frontend Patient/src/theme/` (`palette.ts`, `tokens.ts`, `fonts.ts`, `motion.ts`, `contrastPairs.ts`) and `src/components/ui/Neu.tsx`. The Doctor portal copies the same values into `frontend Doctor/src/styles/tokens.css`.
**Supersedes:** UI-TOKENS-CB-2026-V1 (the `#0b63e5` "Trust Clinical Blue" / `#0d9488` teal palette with Inter). V1 is retired; do not use its values.
**Changes in V2.1:** full depth language (raised / inset with strength tiers, grooves, panels), IconDisc / EmbossedIcon, glassier glass with an ambient background, soft-tactile CriticalButton.
**Changes in V2.2:** the Doctor portal moved from the Apple palette (`#007AFF`, `#5856D6`, Material Symbols, Inter / SF) to Harbor Calm as a denser clinician variant (§ 11). Both apps now share one design system; § 1–10 describe the shared values and the Patient implementation.

Related: [design_principles.md](design_principles.md) · [motion_and_illustration.md](motion_and_illustration.md)

---

## 1. Style: neumorphic-glass hybrid, full depth

**RAISED = you can press it. INSET = it holds, shows or receives something.** Plain text (headings, eyebrows, paragraphs on the canvas) sits directly on the canvas; every *boxed* element has depth.

| Layer | Where |
|---|---|
| **Glass** | Top toolbar, floating tab bar, sheets, toasts, glass cards, over an ambient background |
| **Raised STRONG** | Controls: buttons, toggles' knobs, segmented thumb, chips, icon buttons, tabs, tiles, header pills |
| **Raised SOFT** | Grouped content: cards / panels, tappable list panels, metric cards |
| **Inset STRONG** | Inputs, OTP, editable text areas, toggle and segmented tracks |
| **Inset SOFT** | Read-only text wells, read-only list trays (audit ledger, who-saw-my-records), informational icon discs, badges |
| **Critical** | Raised STRONG shape + SOLID deep fill + coloured glow: SOS, Approve / Decline consent, Join call, End call |

Nesting: at most two levels. Raised or inset controls inside a raised panel are fine. **Inside an inset only a raised thumb / knob is allowed** (segmented control, toggle, slider). Never raised cards inside insets.

---

## 2. Colour

### 2.1 Base palette (approved, exact values)

| Token | Hex | Role | Text use |
|---|---|---|---|
| `ink` | `#1F3A4C` | Primary text, brand gradient end | Yes; the only text colour on glass |
| `primary` | `#3E6985` | Actions, links, selected state, brand gradient start | Yes |
| `primarySoft` | `#8FA8B5` | Fills, borders, ambient blob, disabled critical fill | **Never** |
| `fog` | `#C7D6DB` | Fills, borders | **Never** |
| `ice` | `#D6EBF3` | Ambient blob, illustration blobs, muted text on `night` | On `night` only |
| `base` | `#EAF0F4` | Canvas **and** neumorphic surface | — |
| `card` | `#F7F9FA` | Glass card / sheet tint | — |
| `sand` | `#EDEBE4` | Ambient blob | — |
| `gold` | `#A58D66` | **Verified badges only** | Use `goldDeep` |
| `success` | `#2F9E6E` | Tints, fills, large icons | Use `successDeep` |
| `warning` | `#E0953A` | Tints, fills | Use `warningDeep` (also for icons) |
| `danger` | `#D64545` | Tints, fills, icons | Use `dangerDeep` |

No purple, pink, indigo, teal or Apple system blue anywhere in either app. The brand gradient is `primary → ink`.

### 2.2 Derived values — for approval

| Token | Value | Derived from | Used for | Check |
|---|---|---|---|---|
| `inkMuted` | `#576771` | ink | Secondary text on canvas, panels, soft wells | ≥ 4.55:1 incl. over blobs |
| `inkInset` | `#525F68` | inkMuted, darker | **New:** placeholder and idle icon inside STRONG insets | 4.76:1 at the darkest inset point |
| `primaryPressed` | `#335870` | primary | Pressed Join call | white 7.58:1 |
| `successDeep` | `#22714F` | success | Success text/icons, **Approve consent** fill | white 5.93:1 |
| `successPressed` | `#1B5C40` | success | **New:** pressed Approve | white 7.92:1 |
| `warningDeep` | `#8E5816` | warning | Warning text and icons | ≥ 4.5:1 |
| `dangerDeep` | `#C02A2A` | danger | Danger text, **Decline / SOS / End call** fill | white 5.82:1 |
| `dangerPressed` | `#A32424` | danger | Pressed Decline / SOS / End call | white 7.41:1 |
| `goldDeep` | `#756245` | gold | Verified badge text / icon | ≥ 4.5:1 |
| `night` | `#13242F` | ink | Call screen, night glass, toasts | white 15.9:1 |
| Raised fill | `#F4F8FA → #E3EAEF` (strong), `#F2F6F8 → #E6EDF1` (soft) | base | Raised gradient, top-left → bottom-right | see table |
| Inset fill | `#DFE7EC → #F2F6F8` (strong), `#E3EAEF → #EFF4F6` (soft) | base | Inset gradient (reverse) | see table |
| Critical sheen | white @ **8%** → 0 | — | Highlight on solid critical fills (was 16%; 16% dropped white-on-primary to 4.15:1) | white ≥ 4.93:1 |

### 2.3 Tints (translucent fills behind status text / icons)

Lowered again in V2.1 so badge text stays ≥ 4.5:1 on the darker soft-panel fill (`#E6EDF1`).

| Token | V2 | V2.1 |
|---|---|---|
| `tints.primary` | 8% | **6%** |
| `tints.success` | 14% | **10%** |
| `tints.warning` | 16% | **12%** |
| `tints.danger` | 9% | **6%** |
| `tints.gold` | 12% | **9%** |
| `tints.ink` (neutral) | 6% | **4.5%** |

### 2.4 Accessibility audio badge (unchanged from V1)

Background `#ECFDF5`, text/icon `#047857` (5.21:1; 4.68:1 when pressed inset), minimum 48 × 48. Now drawn as a raised control on its own fill that presses to inset. Required on every card that carries consent or diagnostic information (`AudioListenButton`).

### 2.5 Contrast table

Generated from `src/theme/contrastPairs.ts`; re-check with `npm run contrast` (exits non-zero on any failure). Body text needs ≥ 4.5:1; large text and icons need ≥ 3:1. Translucent layers are flattened bottom-up (e.g. base → ambient blob → strong scrim → sheet glass). Gradient surfaces are checked at their darkest point. Inside insets, glyphs sit ≥ 12px from the edges, where the inner-shadow strips (≤ 10px, fading to 0) leave at most a ~25% residual (`neuInsetResidual`), which is included.

| Pair | Kind | Ratio | Needs | Result |
|---|---|---|---|---|
| ink on base canvas | text | 10.33:1 | 4.5:1 | Pass |
| inkMuted on base canvas | text | 5.10:1 | 4.5:1 | Pass |
| inkMuted on canvas over ice blob | text | 4.87:1 | 4.5:1 | Pass |
| inkMuted on canvas over primarySoft blob | text | 4.55:1 | 4.5:1 | Pass |
| inkMuted on canvas over sand blob | text | 4.98:1 | 4.5:1 | Pass |
| ink on raised strong (darkest) | text | 9.78:1 | 4.5:1 | Pass |
| inkMuted on raised strong (darkest) | text | 4.82:1 | 4.5:1 | Pass |
| primary label on raised strong (darkest) | text | 4.85:1 | 4.5:1 | Pass |
| dangerDeep label on raised strong (darkest) | text | 4.79:1 | 4.5:1 | Pass |
| successDeep label on raised strong (darkest) | text | 4.88:1 | 4.5:1 | Pass |
| ink on raised soft panel (darkest) | text | 10.04:1 | 4.5:1 | Pass |
| inkMuted on raised soft panel (darkest) | text | 4.95:1 | 4.5:1 | Pass |
| primary label on raised soft panel (darkest) | text | 4.98:1 | 4.5:1 | Pass |
| dangerDeep label on raised soft panel (darkest) | text | 4.92:1 | 4.5:1 | Pass |
| successDeep label on raised soft panel (darkest) | text | 5.01:1 | 4.5:1 | Pass |
| ink on inset strong (darkest) | text | 9.49:1 | 4.5:1 | Pass |
| inkMuted on inset strong (darkest) | text | 4.68:1 | 4.5:1 | Pass |
| primary label on inset strong (darkest) | text | 4.71:1 | 4.5:1 | Pass |
| dangerDeep label on inset strong (darkest) | text | 4.65:1 | 4.5:1 | Pass |
| successDeep label on inset strong (darkest) | text | 4.74:1 | 4.5:1 | Pass |
| ink on inset soft well (darkest) | text | 9.78:1 | 4.5:1 | Pass |
| inkMuted on inset soft well (darkest) | text | 4.82:1 | 4.5:1 | Pass |
| primary label on inset soft well (darkest) | text | 4.85:1 | 4.5:1 | Pass |
| dangerDeep label on inset soft well (darkest) | text | 4.79:1 | 4.5:1 | Pass |
| successDeep label on inset soft well (darkest) | text | 4.88:1 | 4.5:1 | Pass |
| primary glyph on raised disc | icon | 4.85:1 | 3:1 | Pass |
| primary glyph on inset disc | icon | 4.85:1 | 3:1 | Pass |
| success glyph on raised disc | icon | 4.88:1 | 3:1 | Pass |
| success glyph on inset disc | icon | 4.88:1 | 3:1 | Pass |
| warning glyph on raised disc | icon | 4.86:1 | 3:1 | Pass |
| warning glyph on inset disc | icon | 4.86:1 | 3:1 | Pass |
| danger glyph on raised disc | icon | 4.79:1 | 3:1 | Pass |
| danger glyph on inset disc | icon | 4.79:1 | 3:1 | Pass |
| gold glyph on raised disc | icon | 4.81:1 | 3:1 | Pass |
| gold glyph on inset disc | icon | 4.81:1 | 3:1 | Pass |
| neutral glyph on raised disc | icon | 4.82:1 | 3:1 | Pass |
| neutral glyph on inset disc | icon | 4.82:1 | 3:1 | Pass |
| inkInset placeholder / idle icon in inset | text | 4.76:1 | 4.5:1 | Pass |
| primary focus icon in inset | icon | 4.27:1 | 3:1 | Pass |
| ink input text in inset | text | 8.61:1 | 4.5:1 | Pass |
| EmbossedIcon primary on base | icon | 5.13:1 | 3:1 | Pass |
| EmbossedIcon dangerDeep on sheet | icon | 3.41:1 | 3:1 | Pass |
| primary badge text on panel | text | 4.62:1 | 4.5:1 | Pass |
| primary badge icon on panel | icon | 4.62:1 | 3:1 | Pass |
| primary badge text on canvas | text | 4.75:1 | 4.5:1 | Pass |
| primary badge icon on canvas | icon | 4.75:1 | 3:1 | Pass |
| success badge text on panel | text | 4.55:1 | 4.5:1 | Pass |
| success badge icon on panel | icon | 4.55:1 | 3:1 | Pass |
| success badge text on canvas | text | 4.68:1 | 4.5:1 | Pass |
| success badge icon on canvas | icon | 4.68:1 | 3:1 | Pass |
| warning badge text on panel | text | 4.56:1 | 4.5:1 | Pass |
| warning badge icon on panel | icon | 4.56:1 | 3:1 | Pass |
| warning badge text on canvas | text | 4.70:1 | 4.5:1 | Pass |
| warning badge icon on canvas | icon | 4.70:1 | 3:1 | Pass |
| danger badge text on panel | text | 4.57:1 | 4.5:1 | Pass |
| danger badge icon on panel | icon | 4.57:1 | 3:1 | Pass |
| danger badge text on canvas | text | 4.70:1 | 4.5:1 | Pass |
| danger badge icon on canvas | icon | 4.70:1 | 3:1 | Pass |
| gold badge text on panel | text | 4.57:1 | 4.5:1 | Pass |
| gold badge icon on panel | icon | 4.57:1 | 3:1 | Pass |
| gold badge text on canvas | text | 4.70:1 | 4.5:1 | Pass |
| gold badge icon on canvas | icon | 4.70:1 | 3:1 | Pass |
| neutral badge text on panel | text | 4.60:1 | 4.5:1 | Pass |
| neutral badge icon on panel | icon | 4.60:1 | 3:1 | Pass |
| neutral badge text on canvas | text | 4.73:1 | 4.5:1 | Pass |
| neutral badge icon on canvas | icon | 4.73:1 | 3:1 | Pass |
| audio badge text on panel | text | 5.21:1 | 4.5:1 | Pass |
| audio badge icon on panel | icon | 5.21:1 | 3:1 | Pass |
| audio badge text on canvas | text | 5.21:1 | 4.5:1 | Pass |
| audio badge icon on canvas | icon | 5.21:1 | 3:1 | Pass |
| white on critical primary under sheen | text | 4.93:1 | 4.5:1 | Pass |
| white on critical primary pressed (inset corner) | text | 11.53:1 | 4.5:1 | Pass |
| white on critical success under sheen | text | 5.02:1 | 4.5:1 | Pass |
| white on critical success pressed (inset corner) | text | 11.81:1 | 4.5:1 | Pass |
| white on critical danger under sheen | text | 5.17:1 | 4.5:1 | Pass |
| white on critical danger pressed (inset corner) | text | 12.49:1 | 4.5:1 | Pass |
| ink on critical disabled | text | 4.77:1 | 4.5:1 | Pass |
| ink on toolbar glass over ice | text | 10.15:1 | 4.5:1 | Pass |
| ink on tab bar glass over ice | text | 10.15:1 | 4.5:1 | Pass |
| ink on glass card over ice | text | 10.64:1 | 4.5:1 | Pass |
| ink on sheet over ice + strong scrim | text | 6.87:1 | 4.5:1 | Pass |
| inkMuted tab icon on tab bar over ice | icon | 5.01:1 | 3:1 | Pass |
| ink on toolbar glass over primarySoft | text | 9.78:1 | 4.5:1 | Pass |
| ink on tab bar glass over primarySoft | text | 9.78:1 | 4.5:1 | Pass |
| ink on glass card over primarySoft | text | 10.33:1 | 4.5:1 | Pass |
| ink on sheet over primarySoft + strong scrim | text | 6.81:1 | 4.5:1 | Pass |
| inkMuted tab icon on tab bar over primarySoft | icon | 4.82:1 | 3:1 | Pass |
| ink on toolbar glass over sand | text | 10.25:1 | 4.5:1 | Pass |
| ink on tab bar glass over sand | text | 10.25:1 | 4.5:1 | Pass |
| ink on glass card over sand | text | 10.75:1 | 4.5:1 | Pass |
| ink on sheet over sand + strong scrim | text | 6.89:1 | 4.5:1 | Pass |
| inkMuted tab icon on tab bar over sand | icon | 5.06:1 | 3:1 | Pass |
| white on night | text | 15.90:1 | 4.5:1 | Pass |
| ice on night | text | 12.90:1 | 4.5:1 | Pass |
| white on night glass over ink | text | 14.59:1 | 4.5:1 | Pass |
| white on night control | text | 10.23:1 | 4.5:1 | Pass |
| success icon on night | icon | 4.72:1 | 3:1 | Pass |
| warning icon on night | icon | 6.46:1 | 3:1 | Pass |
| danger icon on night | icon | 3.63:1 | 3:1 | Pass |
| audio badge text | text | 5.21:1 | 4.5:1 | Pass |
| audio badge text pressed (inset) | text | 4.68:1 | 4.5:1 | Pass |

---

## 3. Typography (Option B, warm editorial)

| Role | English | Kannada | Hindi | Weights loaded |
|---|---|---|---|---|
| Display (serif) | Fraunces | Noto Serif Kannada | Noto Serif Devanagari | 600, 700 |
| UI (sans) | DM Sans | Noto Sans Kannada | Noto Sans Devanagari | 400, 500, 600, 700 |

Serif is **only** for `largeTitle`, `title`, `title2`, `metric`. Everything else is sans.

| Variant | Size (Latin) | Weight | Family |
|---|---|---|---|
| largeTitle | 30 | 700 | serif |
| title | 24 | 600 | serif |
| title2 | 20 | 600 | serif |
| metric | 32 | 700 | serif |
| headline | 17 | 600 | sans |
| body | 16 | 400 | sans |
| callout (buttons) | 16 | 600 / 700 | sans |
| subhead | 15 | 500 | sans |
| footnote | 13 | 400 | sans (meta only) |
| caption / eyebrow | 12 | 500 / 600 | sans |

- Body ≥ 16px. Light weights are never loaded or used.
- Script metrics: Kannada size × 1.1, line-height 1.75; Hindi × 1.05, 1.70; English 1.45 (1.25 single-line labels).
- The active language's fonts load first; the others load in the background; failures fall back to the system font.
- **Mixed-script rule (default in `AppText`):** every string is split into script runs (`src/theme/scripts.ts`). Latin letters and digits always use **DM Sans** (or **Fraunces** for display variants), Kannada runs Noto Sans / Serif Kannada, Devanagari runs Noto Sans / Serif Devanagari, as nested text spans. Each run keeps its own size multiplier; the line-height follows the tallest script present. Neutral characters (spaces, punctuation) stay with the run they follow. Effect: backend data (names, dates, times, numbers) looks identical on en / kn / hi screens, digits never look heavier than surrounding letters, and the greeting name and appointment time are Fraunces in every language.
- **Indic caption floor:** `caption` and `eyebrow` in Kannada / Devanagari use max(size, 14px) × the script multiplier (≈ 15.4px kn, 14.7px hi) and weight ≥ 500. Uppercase and letter-spacing apply only when the text is Latin-only.
- **Dates:** weekday and month names come from translated tables in `translations.ts` (full month names, e.g. "अक्टूबर", "ಅಕ್ಟೋಬರ್"), not device `Intl`, because Hermes' locale data on Android varies by device.
- **On glass, text is ink only.** Glass surfaces publish a `glass` surface context; `AppText` promotes `inkMuted` to `ink` there automatically (inkMuted reaches only 3.1–4.0:1 on a sheet over the strong scrim).

---

## 4. Icons

- **Phosphor** (`phosphor-react-native`, per-icon imports), regular = inactive, duotone = active / emphasis, tinted with palette tokens only.
- Semantic registry: `<Icon name="…">` in `src/components/ui/Icon.tsx`.

### 4.1 `<IconDisc icon tone size variant="raised|inset" shape="circle|square">`

| Variant | Meaning | Used for |
|---|---|---|
| **raised** (strong) | Tappable | Header buttons, active tab, quick-action cards |
| **inset** (soft) | Informational | Trust badges ("Only you decide / Never shared / Govt health ID"), metric icons, status icons, list leading icons, sheet / screen header icons |

Glyph = duotone in `primary` or the status tone's deep variant (`successDeep`, `warningDeep`, `dangerDeep`, `goldDeep`, `inkMuted`). Every tone is checked ≥ 3:1 on both disc fills. Discs < 48 use halved shadow offsets.

### 4.2 `<EmbossedIcon>`

Large decorative icons only (≥ 32px: hero, empty states, onboarding, SOS sheet). Extruded look from offset copies of the same glyph: a white copy at −1.5 / −1.5 and a `rgba(86,116,136,0.42)` copy at +1.5 / +1.5 under the main glyph. Main glyph stays `primary` / `ink` / a deep status colour (≥ 3:1), never white-on-white. Works identically on iOS, Android and web (plain SVG, no shadows). No long flat shadows anywhere.

---

## 5. Neumorphism: full depth language

Surface `base` `#EAF0F4`, light source top-left. RN `shadowRadius` ≈ CSS blur / 2.

### 5.1 Specs

| | STRONG (controls) | SOFT (panels, wells, trays, rows; ~58%) |
|---|---|---|
| Raised fill | gradient `#F4F8FA` (TL) → `#E3EAEF` (BR) | `#F2F6F8` → `#E6EDF1` |
| Raised light shadow | `#FFFFFF`, −8 / −8, CSS blur 16 (RN 8) | white @ 60%, −5 / −5, RN 5 |
| Raised dark shadow | `rgba(86,116,136,0.42)`, +8 / +8, CSS blur 18 (RN 9) | `rgba(86,116,136,0.24)`, +5 / +5, RN 5 |
| Raised edge | hairline, white top-left / soft dark bottom-right | same, softer |
| Inset fill | reverse gradient `#DFE7EC` (TL) → `#F2F6F8` (BR) | `#E3EAEF` → `#EFF4F6` |
| Inset inner dark | `rgba(86,116,136,0.35)` strip fading over 10px, top + left | 0.20, 6px |
| Inset inner light | white @ 90% strip fading over 7px, bottom + right | 55%, 4px |
| Inset edge | 1px dark top-left / white bottom-right | same, softer |

Small elements (knobs, thumbs, chips, discs < 48) halve the raised offsets and use 60% inset depth.

### 5.2 Components (`src/components/ui/Neu.tsx`)

| Component | Use |
|---|---|
| `RaisedLayer`, `InsetLayer` | Absolute background layers (props: `radius`, `strength`, `compact`, `fill`, `focused`) |
| `NeuView` | Static raised surface (strong by default) |
| `NeuPanel` | Soft raised panel (`Card` = `NeuPanel`) |
| `NeuInset` | Inset well (strong by default; `focused` adds the 2px primary ring). `Well` = soft `NeuInset` |
| `NeuPressable` | Raised surface that **animates to inset while pressed** and stays inset when `selected`; optional primary accent bar |
| `Groove` | Debossed divider: 1px `rgba(86,116,136,0.25)` + 1px white @ 90% right below |
| `NeuList` | `panel` (soft raised, tappable rows) or `tray` (soft inset, read-only rows) with grooves between rows |
| `NeuButton`, `NeuToggle`, `NeuTile` | Tactile controls |

RN has no inset shadow, so `InsetLayer` is built from a reverse `LinearGradient` fill plus four `LinearGradient` edge strips and a two-tone border. That uses only the already-installed `expo-linear-gradient`, with no new native dependency.

### 5.3 Rules

- **Lists:** one panel or tray; rows separated by grooves. Rows never get their own dual shadow (Android perf); shadows exist only at panel level. A tappable row is flat inside a raised panel and **presses to inset**; selected row = inset + 4px primary accent bar.
- **Inputs / OTP / text areas:** strong inset; focus = 2px primary ring + duotone primary leading icon. Always a leading icon and a visible label above (plus placeholder), so the field is identifiable even where the inset edge is subtle. Placeholder and idle icon use `inkInset`.
- **Segmented control:** inset track, raised highlight thumb (strong, compact), bold ink label for the selected segment. Equal flex widths; labels **never truncate**: they shrink to 85% and then wrap to two lines. Use the short `seg*` keys (`ABHA ID`, `Mobile`, `Lab`, `Myself`, `On behalf`).
- **Pressed state for every raised thing = animates to inset** over 150 ms (opacity cross-fade between the raised and inset layers plus a 0.985 scale). Shadow properties are never animated.
- Affordance never relies on shadow alone: pressed / selected also changes the icon to duotone + primary, the label to primary or bold, and adds a check or accent bar.

### 5.4 Android

- Raised = the same gradient fill + two-tone hairline edge + **one** elevation shadow tinted `rgba(86,116,136,…)` (elevation 6 strong, 2 soft). Android ignores shadow offsets, so the light top-left shadow is carried by the edge and gradient only; this is the main visual difference from iOS.
- Inset = identical on all platforms (gradients + border), so inputs and trays look the same everywhere.
- Shadow colour on elevation needs Android 9 (API 28)+; older devices show the default grey elevation shadow.

---

## 6. Critical actions: `<CriticalButton tone="primary|success|danger">`

| Tone | Action | Fill | Pressed |
|---|---|---|---|
| primary | Join call, Accept incoming call, Join video consultation | `primary` | `primaryPressed` |
| success | Approve / Authorize consent | `successDeep` | `successPressed` |
| danger | Decline consent, Decline call, SOS (108 / 112), End call | `dangerDeep` | `dangerPressed` |

- Raised neumorphic shape (radius 20): coloured glow in the action colour as the dark shadow (+6 / +8), white light shadow (−6 / −6), 8% white sheen top-left, 1px light edge.
- Always icon + white text label (≥ 4.5:1, worst case under the sheen); min height 56; full width by default (`fullWidth={false}` in the call controls); optional sublabel.
- Pressed = cross-fade to inset (darker fill + inner shadow) + **heavy** haptic. Disabled = flat `primarySoft` fill, ink label, no shadow, no sheen.
- Never grey-on-grey or tone-on-tone. Must be the highest-contrast element on its screen.

---

## 7. Glass

| Material | iOS blur intensity | Fill | Fallback (no blur) |
|---|---|---|---|
| toolbar | 95 | base @ 54% | `base` |
| tabBar (floating pill) | 95 | base @ 54% | `base` |
| card | 90 | card @ 55% | `card` |
| sheet | 100 | card @ 66% | `card` |
| night | 80 | night @ 70% | `night` |

- **Specular edge:** 1px, white @ 90% on the top and left sides fading to white @ 20% on the bottom and right (per-side border colours; a true gradient border needs a mask view, which is not worth a new native dependency), plus an inner top highlight gradient (white @ 35% → 0 over the top 45%).
- **Tab bar:** floating pill, 16px side margins, radius 28, floats ≥ 12px above the safe area, soft `primary` shadow (iOS y 10 / radius 20 / 22%; Android elevation 10 tinted primary).
- **Ambient background** (`src/components/illustrations/AmbientBackground.tsx`): large organic blobs filled with radial gradients fading to transparent, behind the scroll content on every screen (login, tabs, style guide). Peak opacity: ice 70%, sand 70%, **primarySoft 16%** (capped so `inkMuted` canvas text stays ≥ 4.5:1). No animation, no raster, no blur filter.
- **Ink text only on glass** (enforced by `AppText`, see § 3). Worst case: ink on sheet over the primarySoft blob and the strong scrim ≥ 6.7:1.
- **Android:** real blur only on Android 12+ (API 31) and only for the toolbar and tab bar (they sit over the `BlurTargetView`). Cards, sheets and older Android versions use the fallback fill.

---

## 8. Spacing, radii, elevation

- **Spacing:** 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32; screen gutter 16.
- **Radii:** xs 8 · sm 12 · md 14 (inputs, buttons) · lg 20 (cards, panels) · xl 28 (hero, dialogs, tab bar) · sheet 32 · pill.
- **Elevation:** neumorphic tiers above; flat ink shadows (`shadows.sm/md/lg/glass`) remain only for glass and overlays.
- **Touch targets:** ≥ 48 × 48 (44 for dense chips); small visuals use `hitSlop`.

## 9. Illustrations and motion

See [motion_and_illustration.md](motion_and_illustration.md).

## 10. Token-level accessibility checklist

- [ ] New text / icon pairs added to `contrastPairs.ts`; `npm run contrast` passes.
- [ ] Ink only on glass; `primarySoft` / `fog` never used as text.
- [ ] Status text and status glyphs use `*Deep` variants.
- [ ] Icons ≥ 3:1 on their own surface (disc, panel, inset, glass).
- [ ] Audio badge on consent / diagnostic cards.
- [ ] Touch targets ≥ 48.
- [ ] No raw colour values outside `src/theme/` (grep for `#[0-9A-Fa-f]{3,8}` and `rgba(`).
- [ ] Checked in the dev Style Guide in all three languages.

---

## 11. Web (Doctor portal)

The Doctor portal (`frontend Doctor/`, Vite 8 + React 19 + Tailwind CSS 4) uses the **same Harbor Calm values** as the Patient app, as a denser clinician variant for desktop. Everything in § 1–10 applies; this section covers only how the web build expresses it and where it differs.

### 11.1 Where things live

| File | Holds |
|---|---|
| `src/styles/tokens.css` | The only place raw colour values exist. Tailwind `@theme` (colour roles, tints, font stacks, type scale, radii, flat shadows, motion) + `:root` variables (neumorphic fills and shadows, critical, glass, ambient peaks) |
| `src/styles/fonts.css` | Self-hosted `@font-face` rules (Fontsource woff2 files, bundled by Vite) |
| `src/styles/base.css` | Canvas, focus ring, per-script typography, scrollbars, reduced motion |
| `src/styles/utilities.css` | Depth classes (`neu-*`, `groove*`), `critical*`, `glass*`, `ambient*`, and their fallbacks |
| `src/styles/contrast.ts`, `contrastPairs.ts` | WCAG maths + every checked pair, read straight from `tokens.css` |
| `scripts/check-contrast.ts` | `npm run check:contrast` (exits 1 on any failure; `-- --md` prints a Markdown table) |
| `src/components/ui/` | UI kit + `Icon` registry (`iconRegistry.ts`) |
| `src/dev/StyleGuide.tsx` | Dev-only Style Guide: `npm run dev`, open `/?styleguide` (removed from production builds) |

### 11.2 Token → CSS variable → Tailwind class

Tailwind's default palette is removed (`--color-*: initial`), so only these roles exist as classes. Opacity modifiers (`bg-primary/10`) work on every role.

| Patient role | CSS variable | Tailwind classes | Value |
|---|---|---|---|
| ink | `--color-ink` | `text-ink`, `bg-ink`, `border-ink/5` … | `#1F3A4C` |
| inkMuted | `--color-ink-muted` | `text-ink-muted` | `#576771` |
| inkInset | `--color-ink-inset` | `text-ink-inset` (placeholders) | `#525F68` |
| primary | `--color-primary` | `text-primary`, `bg-primary`, `ring-primary/40` | `#3E6985` |
| primaryPressed | `--color-primary-deep` | `bg-primary-deep` (hover / pressed solid primary) | `#335870` |
| primarySoft, fog | `--color-primary-soft`, `--color-fog` | fills / borders only | `#8FA8B5`, `#C7D6DB` |
| ice, card, sand | `--color-ice`, `--color-card`, `--color-sand` | `bg-card`, `bg-sand` (locked), `text-ice` (muted text on night) | `#D6EBF3`, `#F7F9FA`, `#EDEBE4` |
| base | `--color-base` (in `:root`, see below) | `bg-base`, `border-base`, `via-base` | `#EAF0F4` |
| success, successDeep, successPressed | `--color-success`, `-success-deep`, `-success-pressed` | `bg-success` (dots), `text-success-deep`, `bg-success-deep` | `#2F9E6E`, `#22714F`, `#1B5C40` |
| warning, warningDeep | `--color-warning`, `-warning-deep` | `bg-warning` (dots), `text-warning-deep`, `bg-warning-deep` | `#E0953A`, `#8E5816` |
| danger, dangerDeep, dangerPressed | `--color-danger`, `-danger-deep`, `-danger-pressed` | `bg-danger` (dots), `text-danger-deep`, `bg-danger-deep` | `#D64545`, `#C02A2A`, `#A32424` |
| gold, goldDeep | `--color-gold`, `-gold-deep` | verified only | `#A58D66`, `#756245` |
| night | `--color-night` | `bg-night` (call screen, video, login panel) | `#13242F` |
| onPrimary | `--color-on-primary` | `text-on-primary` (= white) | `#FFFFFF` |
| tints (§ 2.3) | `--color-{primary,success,warning,danger,gold,ink}-tint` | `bg-success-tint` etc., behind status text | 6 / 10 / 12 / 6 / 9 / 4.5 % |
| hairline, separator, border | `--color-hairline`, `-separator`, `-border` | `border-hairline` …; the default border colour is `separator` | ink @ 8 / 12 / 14 % |
| glass fills, scrims | `--color-glass`, `-glass-toolbar`, `-glass-sheet`, `-glass-night`, `--color-scrim`, `-scrim-strong` | used by the `glass*` classes, `bg-scrim` | § 7 |

- **`base` is the one naming exception.** A theme colour called `base` would turn Tailwind's `text-base` font-size utility into a colour. So `--color-base` lives in `:root`, and Tailwind sees it only as `--background-color-base` / `--border-color-base`: `bg-base` works and `text-base` stays 16px.
- **Radii** keep the Patient values under descriptive names, so Tailwind's own `rounded-xl` etc. are untouched: `rounded-tight` 8 · `rounded-chip` 12 · `rounded-control` 14 · `rounded-panel` 20 · `rounded-hero` 28 · `rounded-sheet` 32.
- **Flat shadows** (`shadow-sm/md/lg`) are the Patient `shadows.sm/md/lg` in CSS (blur = 2 × RN radius), ink-tinted. `--shadow-glass` is used by the glass classes.

### 11.3 Depth, glass and critical classes

Light source top-left; values are § 5 translated to CSS `box-shadow` (real inset shadows instead of RN gradient strips).

| Class | Use | CSS |
|---|---|---|
| `neu-raised`, `neu-raised-sm` | STRONG raised (controls); `-sm` for < 48px | gradient `#F4F8FA → #E3EAEF`; `-8 -8 16 #FFF, 8 8 18 rgba(86,116,136,.42)` (sm: halved offsets) |
| `neu-panel`, `neu-panel-sm` | SOFT raised panel (cards, tables) | `#F2F6F8 → #E6EDF1`; `-5 -5 10 white@60%, 5 5 10 rgba(86,116,136,.24)` |
| `neu-inset`, `neu-inset-sm` | STRONG inset (inputs, tracks) | `#DFE7EC → #F2F6F8`; `inset 4 4 10 rgba(86,116,136,.35), inset -4 -4 7 white@90%` |
| `neu-well`, `neu-well-sm` | SOFT inset (text wells, trays, informational discs) | `#E3EAEF → #EFF4F6`; `inset 3 3 6 rgba(86,116,136,.2), inset -3 -3 4 white@55%` |
| `neu-press` | Interactive raised: hover lifts 1px; `:active`, `aria-pressed`, `aria-selected`, `aria-current="page"` = inset | only transform animates; the shadow swap is instant |
| `groove`, `groove-v`, `groove-rows` | Debossed divider; divided list or table rows | 1px `rgba(86,116,136,.25)` + 1px white @ 90% |
| `critical` + `critical-success` / `critical-danger` | § 6 | solid fill, 8% sheen, glow `6 8 24 fill@45%` + `-6 -6 14 white@90%`; pressed = darker fill + `inset 6 6 12 rgba(19,36,47,.32)`; disabled = `primarySoft` fill, ink label |
| `glass`, `glass-toolbar`, `glass-sidebar`, `glass-sheet`, `glass-night` | § 7 | `backdrop-filter: blur(30px) saturate(170%)` (sheet 32px / 180%); fills card @ 55%, base @ 54%, card @ 66%, night @ 70%; 1px specular edge white @ 90% top-left → 20% bottom-right; inner top highlight white @ 35% → 0 over 45% |
| `ambient`, `ambient-blob-*` | Background behind glass | fixed, static radial-gradient blobs (ice 70%, primarySoft 16%, sand 70%) with `filter: blur(40px)` |

Fallbacks: without `backdrop-filter` support, and under `prefers-reduced-transparency: reduce`, every glass class switches to its solid fill (`card`, `base`, `night`).

### 11.4 Typography on the web

- **Self-hosted** with Fontsource (`@fontsource/*` 5.3) and bundled by Vite: no Google Fonts and no third-party requests, so it works on poor clinic networks. Weights: Fraunces / Noto Serif 600 + 700; DM Sans / Noto Sans 400–700; DM Mono 400 + 500. `font-display: swap`.
- **Font stacks, Latin first** (the browser falls back per glyph):
  - sans `'DM Sans', 'Noto Sans Kannada', 'Noto Sans Devanagari', sans-serif`
  - serif `'Fraunces', 'Noto Serif Kannada', 'Noto Serif Devanagari', serif`
  - mono `'DM Mono', 'Noto Sans Kannada', 'Noto Sans Devanagari', monospace`

  The Noto faces carry **only their own script's** `unicode-range`, so patient names, drug names, digits and backend text inside kn / hi UI always render in DM Sans / Fraunces. This is the web equivalent of the Patient app's mixed-script rule (§ 3), with no extra component. A font file is downloaded only when a glyph in its range is drawn.
- **Script size:** the Noto Kannada / Devanagari faces have `size-adjust: 110%` / `105%`, the per-glyph version of the Patient ×1.1 / ×1.05 multiplier (Latin runs keep their size).
- **Per-script rules**, switched by `<html lang>` (set from the language selector) or by any element with `lang="kn"` / `lang="hi"`:
  - line-height 1.75 (kn) / 1.70 (hi) / 1.45 (en) on every text size and `leading-*` utility;
  - **Indic floor:** `text-4xs/3xs/2xs/xs/footnote` lift to 14px and weights below 500 lift to 500 (≈ 15.4px kn / 14.7px hi after size-adjust). `font-mono` keeps the dense English sizes, because IDs and timestamps are always Latin;
  - no letter-spacing (`tracking-*` = 0). Uppercase has no effect on Indic scripts and stays on Latin labels.
- **Serif only for display:** `h1`, `h2` and hero numbers (`font-serif`). Everything else is sans.
- **Type scale:** Tailwind's sizes plus dense clinician sizes `text-4xs` 9 · `text-3xs` 10 · `text-2xs` 11 · `text-footnote` 13 · `text-subhead` 15. The 9–11px sizes exist only for the migrated screens; new UI uses ≥ 12px, with body text at 14–16px.

### 11.5 Icons

- `<Icon name tone weight size label?>` from `src/components/ui`. The semantic registry is `src/components/ui/iconRegistry.ts`; names match the Patient registry where the meaning is the same. Screens never import Phosphor directly.
- `@phosphor-icons/react` 2.1 (supports React 19) with **per-icon imports** (`@phosphor-icons/react/dist/csr/<Name>`), so Vite dev never pre-bundles the 1,500-icon barrel. A small build transform in `vite.config.ts` keeps only the `regular` and `duotone` weights in each icon module (about ⅔ smaller).
- `weight`: `regular` = inactive, `duotone` = active / emphasis. `tone`: `inherit` (default, follows the label colour), `ink`, `muted`, `primary`, `success` / `warning` / `danger` / `gold` (their `*Deep` colours), `onPrimary`, `ice` (on night).
- Icons are decorative (`aria-hidden`) unless `label` is passed. An icon-only button must have an `aria-label` (`NeuButton` enforces this in its type).

### 11.6 UI kit (`src/components/ui/`)

| Component | Depth | Notes |
|---|---|---|
| `NeuPanel`, `NeuRaised`, `NeuInset` (`strength` soft / strong), `Groove` | primitives | `compact` = halved shadows for < 48px |
| `NeuButton` | raised strong, presses to inset | `sm` 36px / `md` 44px; `pressed` latches inset + duotone primary icon |
| `CriticalButton` | critical | `tone` primary / success / danger; always icon + label; min 44px; `loading`, `sublabel` |
| `IconDisc`, `EmbossedIcon` | raised (tappable) / inset (informational); emboss = decorative ≥ 32px | glyph ≥ 3:1 on both disc fills |
| `SegmentedControl` | inset track + raised thumb | radio group: ←/→/Home/End; thumb slides with transform over 250 ms |
| `TextField` | strong inset | visible label, leading icon (duotone primary on focus), 2px primary focus ring, error = icon + text |
| `Toggle` | inset track + raised knob | `role="switch"`, optional On / Off text |
| `Badge`, `Chip` | tint + soft edge / raised filter that latches inset | icon + status colour + one word |
| `DataTable` | one soft panel, grooved rows | keyboard rows (Enter / Space); selected = tint + 3px primary bar |
| `GlassToolbar`, `GlassSidebar`, `GlassSheet` | glass | the sheet is a modal dialog: focus moves in, Tab is trapped, Esc closes, focus returns |
| `AmbientBackground` | — | static CSS blobs; place once behind a `relative isolate` page |

### 11.7 Clinician density rules

- Tables and long lists sit on **one soft panel** with **debossed groove dividers**, never per-row shadows.
- **Soft** depth only in the chart, records and queue (panels, wells, rows). **Strong** depth on controls, filters, tabs and critical actions.
- Minimum click target **36px** (44px for critical actions). Body text 14–16px.
- Indic text never below 14px / weight 500, with no uppercase or letter-spacing (enforced in `base.css`).
- Visual first: icon + status colour + short label before any sentence.

### 11.8 Desktop accessibility

- **Focus:** every interactive element shows a 2px primary outline with a 2px offset on `:focus-visible` (ice on `night` surfaces). The rule is unlayered CSS, so a utility like `outline-none` cannot remove it.
- **Pointer:** hover = raised lifts 1px; active = inset. Buttons get `cursor: pointer`.
- **Keyboard:** Tab order follows the DOM; Enter / Space activate (clickable cards and the PIP tile have `role="button"` + key handlers). Dialogs (`ConsentRequestModal`, scan viewer, reschedule, `GlassSheet`) use `useDialogA11y` for focus-in, focus trap, Esc and focus return.
- **Names:** every icon-only button has an `aria-label`; toggles expose `aria-pressed` / `aria-checked`; the active nav tab has `aria-current="page"`; form labels are linked to their fields.
- **Motion and transparency:** `prefers-reduced-motion` collapses transitions and animations; `prefers-reduced-transparency` makes glass solid.
- **Responsive:** checked at 1024 / 1280 / 1440 / 1920 (no horizontal page scroll) and 768.

### 11.9 Contrast (web-only pairs)

`npm run check:contrast` checks 148 pairs: the § 2.5 pairs that apply on the web, plus the ones below. Where a pair is the same as in § 2.5 the ratio is identical, because the values are.

| Pair | Ratio | Needs |
|---|---|---|
| ink-muted on base / card / sand | 5.10 / 5.55 / 4.91 | 4.5 |
| ink-muted tab label on `fog/40` track (card / toolbar) | 4.86 / 4.62 | 4.5 |
| status text on its `*-tint` over card | 5.06–5.14 | 4.5 |
| hover tints on card: primary/10, danger/10, success/15 | 4.90 / 4.84 / 4.79 | 4.5 |
| white on primary / primary-deep / success-deep / warning-deep / danger-deep | 5.89 / 7.58 / 5.93 / 5.90 / 5.82 | 4.5 |
| white on `night/70` video overlay (worst case: over a white frame) | 6.10 | 4.5 |
| white @ 70% / 60% on night | 8.39 / 6.54 | 4.5 |
| success text / icon on night | 4.72 | 4.5 |
| focus ring: primary on base / card / raised / inset | 5.13 / 5.58 / 4.85 / 4.71 | 3 |
| focus ring: ice on night | 12.90 | 3 |

### 11.10 Apple → Harbor Calm mapping (Doctor migration, V2.2)

| Old (Apple) | New | Notes |
|---|---|---|
| `#007AFF` (all uses) | `primary` | |
| `#0062CC` (hover) | `primary-deep` | = Patient `primaryPressed` |
| `#1C1C1E` text / dark surfaces | `ink` / `night` | |
| `#8E8E93`, `#636366` text | `ink-muted` | the grey failed 4.5:1 |
| `#C7C7CC` placeholder | `ink-inset` | |
| `#D1D1D6` text on dark | `ice` | |
| `#F2F2F7` | `base` | |
| `#E5E5EA` fills | `fog` (`fog/40` behind muted tab labels) | |
| `#F9F9FB` (locked record card) | `sand` | |
| `#34C759` | text / icons → `success-deep`; fill under a white label → `success-deep`; dots / bars → `success` | |
| `#248A3D` / `#2FB350` | `success-deep` / `success-pressed` | |
| `#FF3B30` | text → `danger-deep`; fill under a white label → `danger-deep`; dots → `danger` | |
| `#D70015` / `#FFF2F2` | `danger-pressed` / `danger/6` | |
| `#FF9500`, `#C97700` | text / icons → `warning-deep`; fill under a white label → `warning-deep`; dots → `warning` | |
| `#E08500` (hover) | `warning-deep/90` | |
| `#5856D6` indigo | `primary` (text, dots, tints); `ink` as gradient end | brand gradient `primary → ink` |
| `#30B0C7` teal | `ice` | |
| `#000000`, `black` fills ≥ 40% | `night` | |
| `black/5…/10` lines and fills | `ink/5…/10` | |
| `bg-white` | `bg-card` | |
| status `X/10…/15` fills behind deep text | `X-tint` | Patient V2.1 tints; the Apple 15% tints failed 4.5:1 |
| on night surfaces: muted text / success / primary | `ice` / `success` / `ice` | the deep colours are too dark on night |
| `shadow-apple-sm/md/lg` | `shadow-sm/md/lg` | Patient flat shadows |
| `liquid-glass`, `liquid-glass-toolbar` | `glass`, `glass-toolbar` | |
| Material Symbols (98 uses, 63 ligature names) and emoji used as icons | `<Icon>` registry | |

### 11.11 Differences from the Patient app (and why)

| Area | Patient | Doctor | Why |
|---|---|---|---|
| Touch / click target | 48 (44 dense) | 36 (44 critical) | Mouse and keyboard on desktop; clinician density |
| Script size | Every Indic run × 1.1 / × 1.05 via `AppText` | `size-adjust` on the Noto faces + 14px floor on small text | Same visual result per glyph, without a text component |
| Inset rendering | Gradient strips (RN has no inset shadow) | Real `box-shadow: inset` | Native on the web |
| Pressed state | Opacity cross-fade raised → inset | Instant shadow swap; only transform animates | Same rule (never animate shadows) in plain CSS |
| Glass | `expo-blur` intensity 80–100 | `backdrop-filter` blur 28–32px + saturate | Web equivalent |
| Ambient blobs | SVG radial gradients, no blur filter | CSS radial gradients + static `blur(40px)` | Cheap on desktop GPUs; peaks unchanged, so contrast is unchanged |
| Critical button | min height 56, full width | min height 44, sized to content | Desktop density |
| `base` class name | `colors.base` | `bg-base` via `--background-color-base` | Avoids the Tailwind `text-base` clash |
| Badge text size | 12px | 11px in migrated screens (14px in kn / hi) | Kept from the old layout until each screen is restyled in Phase 2 |
