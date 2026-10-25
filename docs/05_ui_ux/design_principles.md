# Design Principles & Design QA Checklist

**Document ID:** UI-PRINCIPLES-SS-2026-V1
**Applies to:** Patient app (`frontend Patient/`). The Doctor portal still follows its previous Apple-style system; aligning it is an open decision (see [design_system_tokens.md](design_system_tokens.md)).

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
