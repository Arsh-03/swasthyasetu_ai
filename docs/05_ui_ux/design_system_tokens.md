# Design System Tokens V2 — "Harbor Calm"

**Document ID:** UI-TOKENS-SS-2026-V2.1
**Applies to:** Patient app (`frontend Patient/`, Expo SDK 58 / React Native)
**Source of truth in code:** `frontend Patient/src/theme/` (`palette.ts`, `tokens.ts`, `fonts.ts`, `motion.ts`, `contrastPairs.ts`) and `src/components/ui/Neu.tsx`
**Supersedes:** UI-TOKENS-CB-2026-V1 (the `#0b63e5` "Trust Clinical Blue" / `#0d9488` teal palette with Inter). V1 is retired; do not use its values.
**Changes in V2.1:** full depth language (raised / inset with strength tiers, grooves, panels), IconDisc / EmbossedIcon, glassier glass with an ambient background, soft-tactile CriticalButton.

> **Open decision:** the Doctor portal (`frontend Doctor/`) still uses the previous Apple palette (`#007AFF`, `#5856D6`, Material Symbols, Inter / SF). Whether to align it with Harbor Calm has not been decided. Until then the two apps intentionally look different.

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

No purple, pink, indigo, teal or Apple system blue anywhere in the Patient app. The brand gradient is `primary → ink`.

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
