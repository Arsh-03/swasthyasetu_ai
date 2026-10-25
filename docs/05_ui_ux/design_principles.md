# Design Principles & Design QA Checklist

**Document ID:** UI-PRINCIPLES-SS-2026-V1
**Applies to:** Patient app (`frontend Patient/`) and Doctor portal (`frontend Doctor/`). Both use Harbor Calm ([design_system_tokens.md](design_system_tokens.md)); the Doctor interpretation and the desktop QA checklist are at the end of this document.

Our users include first-time smartphone users, people who read Kannada or Hindi better than English, and patients deciding about sensitive medical data. Every screen is judged against these four principles. When two principles conflict, the lower number wins.

---

## 1. Calm over clever

The app should lower anxiety, not raise it.

| Do | Don't |
|---|---|
| Use the Harbor Calm palette, generous spacing, one focal action per screen | Add gradients, glows or colour just to look premium |
| Use 150 ms / 250 ms ease-out motion that settles quietly | Bounce, wobble, auto-play or loop animation for attention |
| Show one toast at a time, worded plainly ("Consent approved") | Stack alerts, use exclamation marks, or say "Oops!" |
| Use the SOFT tier for panels, wells and trays and the STRONG tier only for controls, so hierarchy survives the depth | Give every element the same strong shadow, or stack raised cards inside insets |

## 2. Show, don't tell

Lead with an icon, a status colour, a short label and an audio option. Use paragraphs only when the law requires them.

| Do | Don't |
|---|---|
| A dose row = time-of-day icon + medicine name + "Take" tile that turns into a tick | A sentence like "Please remember to take your morning dose of…" |
| Status = coloured badge with icon + one word ("Shared", "Locked") | Status written out as a full sentence in grey |
| Put an audio (Listen) button on every consent or diagnostic card | Rely on reading for anything that affects the patient's health or data |
| Use an illustration for empty states | Show a blank list with "No data" |

## 3. Consent is sacred

**Critical actions are soft and tactile but always the highest-contrast element on screen.**

Anything that shares data, contacts emergency services or connects a call must be unmistakable.

| Do | Don't |
|---|---|
| Use `CriticalButton` for Authorize / Decline consent, SOS, Join call and End call: raised shape, **solid** deep fill (`successDeep`, `dangerDeep`, `primary`), white icon + label, glow, heavy haptic | Render a critical action grey-on-grey, tone-on-tone, as a ghost button, or without a text label |
| Show who is asking, for what record, why, and for how long, before the buttons | Hide the purpose or duration behind "Details" |
| Keep consent sheets non-dismissible: no backdrop tap, the patient must choose | Let a stray tap dismiss (or approve) a request |
| Use the gold "verified" badge only for real verification | Use gold as decoration |

## 4. One look everywhere

The same components, tokens and wording everywhere, in all three languages.

| Do | Don't |
|---|---|
| Build screens from `src/components/ui` and `glass` | Hand-style a one-off button or card on a screen |
| **RAISED = you can press it; INSET = it holds, shows or receives something.** Boxed elements always have depth: panels soft raised, inputs strong inset, read-only lists in an inset tray with grooves | Make a tappable thing look sunk, an input look raised, or give each list row its own dual shadow |
| Nest at most two levels; inside an inset only a raised thumb / knob | Put raised cards inside inset wells |
| Ink text only on glass (AppText enforces it) | Grey text directly on toolbar, tab bar or sheets |
| Use tokens only; there are no raw colours outside `src/theme/` | Paste a hex value "just for this screen" |
| Use the semantic `<Icon>` registry | Import a Phosphor icon directly in a screen |
| Put every string in `translations.ts` (en / kn / hi) | Hard-code English in a component |

---

## Design QA checklist (run for every screen change)

**Contrast**
- [ ] `npm run contrast` passes; any new text/background pair has been added to `src/theme/contrastPairs.ts`.
- [ ] No `primarySoft` / `fog` text; status text uses `*Deep` variants.

**Language switch**
- [ ] No truncated segmented-control labels in ಕನ್ನಡ / हिंदी (or English) at the largest font size: labels shrink, then wrap to two lines.
- [ ] Switch EN → ಕನ್ನಡ → हिंदी: nothing clips (matras, conjuncts), headers don't jump, buttons wrap rather than truncate.
- [ ] Serif appears only on display text; body is sans in each script.

**Small screen**
- [ ] 320 pt wide (e.g. iPhone SE / small Android): no horizontal scroll, two-up grids still fit, and the tab bar labels fit.
- [ ] Content isn't hidden under the glass toolbar or tab bar; the safe areas are respected.

**Large text**
- [ ] OS font size at maximum (AppText caps scaling at 1.6×): layout still works, nothing overlaps.
- [ ] Touch targets ≥ 48 × 48.

**Offline / slow network**
- [ ] Loading state shown (not a blank screen); failure shows a plain message plus a retry where relevant.
- [ ] Optimistic actions (dose taken, check-in) roll back with a message on failure.

**Empty state**
- [ ] Empty lists show an illustration + one short sentence (+ an action if there is one).

**Accessibility**
- [ ] Icons ≥ 3:1 against their own surface (disc, panel, inset well, glass); status glyphs use `*Deep` variants.
- [ ] Every icon-only button has an `accessibilityLabel`; toggles and tiles expose checked/selected state.
- [ ] Reduce-motion on: no scaling/sliding, and the state is still clear.
- [ ] Consent / diagnostic cards have the audio badge.

**Consistency**
- [ ] Depth language followed (raised = pressable, inset = holds / shows); strength tiers correct; ≤ 2 nesting levels.
- [ ] Critical actions use `CriticalButton` and are the highest-contrast element on the screen.
- [ ] Pressed state of every raised control goes to inset.
- [ ] No raw colours outside `src/theme/` (grep for `#[0-9A-Fa-f]{3,8}` and `rgba(`).

---

## Doctor portal: how the four principles apply

Clinicians use the portal on a desktop for many consultations a day, often on slow clinic networks, while switching between English, Kannada and Hindi. The principles are the same; the reading is denser and keyboard-first. Token and component details: [design_system_tokens.md § 11](design_system_tokens.md#11-web-doctor-portal).

### 1. Calm over clever (clinician reading)

| Do | Don't |
|---|---|
| Keep the queue, chart and records on SOFT panels with grooved rows; reserve STRONG depth for controls, filters, tabs and critical actions | Give every card and row its own strong shadow; it turns a dense screen into noise |
| Use one toast at a time, worded plainly, without bouncing; status updates (consent granted, patient answered) appear in place | Ping, pulse or bounce for attention (reduced motion turns these off, but they should not be needed) |
| Load everything from the app's own bundle: self-hosted fonts and icons, no CDN | Depend on third-party font / icon / script CDNs that stall on a clinic network |

### 2. Show, don't tell (clinician reading)

| Do | Don't |
|---|---|
| Lead each row with an icon + status colour + one word (Urgent, Follow-up, Locked, Decrypted), then the detail | Put the triage level or consent state in a sentence |
| Use `Badge` with the tone's tint and deep text; dots only next to a word | Rely on a coloured dot alone |
| Show loading, empty and error states with a small illustration and one sentence (Phase 2) | Leave a blank panel or a raw server error |

### 3. Consent is sacred (clinician reading)

| Do | Don't |
|---|---|
| Send consent requests, start / end calls and sign notes with `CriticalButton` (solid deep fill, white icon + label, the highest-contrast element) | Make "Send consent request" or "End call" a ghost or tinted button |
| State patient, record, purpose and duration before the action; purpose is logged and visible to the patient | Hide the purpose or duration behind a disclosure |
| Keep dialogs keyboard-safe: focus moves in, Tab stays inside, Esc cancels, focus returns to the button that opened it | Let focus wander behind a modal, or close a consent dialog on a stray click without the clinician noticing |
| Show locked records as locked (sand surface, lock icon, "Consent required"), never blurred previews of the content | Hint at protected content before consent is granted |

### 4. One look everywhere (clinician reading)

| Do | Don't |
|---|---|
| Build with `src/components/ui` and the `neu-*` / `glass*` / `critical*` classes | Re-create depth with ad-hoc shadows on a screen |
| Use token classes only (`text-ink-muted`, `bg-success-tint`); no hex anywhere outside `src/styles/` | Paste a hex value or an Apple colour "just for this screen" |
| Use the `<Icon>` registry; regular = inactive, duotone = active | Import Phosphor in a screen, or use an emoji as an icon |
| Put every string in `src/utils/translations.ts` and test en / kn / hi | Hard-code English (screen readers then read it with a Kannada or Hindi voice, because `<html lang>` follows the selected language) |

---

## Desktop QA checklist (Doctor portal, run for every screen change)

**Contrast**
- [ ] `npm run check:contrast` passes; any new text / icon / focus pair is added to `src/styles/contrastPairs.ts`.
- [ ] No `primary-soft` / `fog` text; status text and icons use `*-deep`; status fills behind text use `*-tint`.
- [ ] On `night` surfaces: white / `ice` text, base `success` / `warning` / `danger` icons (the deep colours are too dark there).
- [ ] `grep -rnE "#[0-9A-Fa-f]{3,8}\b|rgba?\(" src --include=*.ts --include=*.tsx` finds nothing outside `src/styles/`.

**Language switch**
- [ ] Switch EN → ಕನ್ನಡ → हिंदी with the header button: `<html lang>` changes, nothing clips (matras, conjuncts), labels wrap instead of truncating, the header does not shift.
- [ ] Indic text is ≥ 14px and weight ≥ 500; no letter-spacing on Indic text.
- [ ] Latin names, drug names and numbers inside kn / hi screens render in DM Sans (Fraunces in display text).
- [ ] Serif only on `h1` / `h2` / hero numbers.

**Widths**
- [ ] 1024, 1280, 1440 and 1920 px wide: no horizontal page scroll and no clipped controls (header included).
- [ ] 768 px: content reflows without horizontal scroll.

**Keyboard-only pass**
- [ ] Every action is reachable with Tab and works with Enter / Space; the order follows the visual order.
- [ ] Dialogs: focus moves in on open, Tab is trapped, Esc closes, focus returns to the opener.
- [ ] Segmented controls use the arrow keys; rows in a `DataTable` open with Enter.

**Focus visible**
- [ ] A 2px primary ring with a 2px offset on every focused control (ice on night surfaces); never hidden by `outline-none`.

**Names and targets**
- [ ] Every icon-only button has an `aria-label`; toggles expose `aria-pressed` / `aria-checked`; the active nav item has `aria-current`.
- [ ] Every form field has a visible, linked label.
- [ ] Click targets ≥ 36px (critical ≥ 44px).

**Reduced motion / transparency**
- [ ] With `prefers-reduced-motion: reduce`, nothing slides, pings or bounces, and the state is still clear.
- [ ] With `prefers-reduced-transparency: reduce` (or no `backdrop-filter`), glass becomes a solid fill and text stays readable.

**Network**
- [ ] DevTools → Network shows no requests to third-party hosts (fonts, icons and CSS are bundled).
