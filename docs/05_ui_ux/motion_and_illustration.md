# Motion & Illustration Guidelines

**Document ID:** UI-MOTION-SS-2026-V1
**Applies to:** Patient app (`frontend Patient/`)
**Code:** `src/theme/motion.ts`, `src/hooks/usePressScale.ts`, `src/components/illustrations/`

---

## 1. Motion

Built on `react-native-reanimated` 4 (with `react-native-worklets`, configured automatically by `babel-preset-expo` in SDK 58).

### 1.1 Tokens

| Token | Value | Use |
|---|---|---|
| `duration.press` | 150 ms | Press feedback |
| `duration.transition` | 250 ms | State changes: toggle knob, segmented thumb. (Sheet and toast entry still use their earlier RN `Animated` springs; moving them onto these tokens is part of the Phase 2 modal pass.) |
| `duration.signature` | 400 ms | **Reserved** for later signature moments; not used yet |
| `easeOut` | `cubic-bezier(0.16, 1, 0.3, 1)` via `Easing.bezier` | All timed motion (same curve as the Doctor portal's segmented control) |
| `pressSpring` | damping 18, stiffness 320, mass 0.6 | Tactile press scale: settles fast, at most a hint of overshoot |
| `PRESS_SCALE` | 0.97 (icon buttons 0.94) | How far a pressed control shrinks |

### 1.2 Rules

- Animate **only `transform` and `opacity`**. Never animate shadows, blur, colours or layout.
- Press feedback = `usePressScale()` (scale on press-in, spring back on press-out) plus a 150 ms **opacity cross-fade from the raised layer to the inset layer** (`NeuPressable`, `CriticalButton`). Shadow properties themselves never animate.
- **Reduce motion:** `usePressScale` skips scaling when the OS setting is on, and timing/spring configs use `ReduceMotion.System`. The state must still be clear without motion (colour, icon, inset).
- No looping animation except the incoming-call ring (which also stops under reduce-motion).
- Haptics accompany primary actions (light impact), selections (selection tick) and warnings (SOS, end call). They are best-effort and silently ignored where unsupported.

### 1.3 Not yet built (do not add without a design review)

- Consent "seal" moment when access is authorized.
- Dose "tick" moment when a dose is marked taken.

Both will use `duration.signature` (400 ms).

---

## 2. Illustration

### 2.1 Style

- **Soft, flat, organic.** One organic blob background plus one simple subject, with generous negative space.
- **Palette colours only** (`ice`, `fog`, `primarySoft`, `primary`, `ink`, `sand`, `success`, `warning`, `gold`). Opacity variations are allowed; new colours are not.
- Large decorative icons use `EmbossedIcon` (offset light / dark copies of the glyph), never long flat shadows.
- **No** raster images, photographic textures, 3D/clay shading, drop shadows inside illustrations, gradients used as lighting, or faces with detailed expressions.
- Drawn as `react-native-svg` components and scaled by `width` (5:4 artboard, `viewBox 0 0 200 160`).
- Always decorative: hidden from screen readers. The adjacent text carries the meaning.

### 2.2 Set (Phase 1)

| Component | Use |
|---|---|
| `AmbientBackground` | Large radial-gradient blobs (ice 70%, sand 70%, primarySoft 16%) behind every screen so glass has something to refract |
| `Blob` (3 variants) | Background shape behind headers, empty states and cards |
| `LoginHero` | Login / onboarding: shield with a check, held by two leaves |
| `EmptyRecords` | Records locker with no documents |
| `EmptyMedications` | Care plan with no active medications |
| `EmptyAppointments` | Home with no booked appointment |
| `EmptyAccessLog` | Privacy screen with no access history (also loading / error) |
| `CallWaiting` | Call screen while connecting / audio-only (on `night`) |

All of them are shown in the dev Style Guide (long-press the brand mark in a development build).

### 2.3 Adding an illustration

1. Sketch it on the 200 × 160 artboard with at most 6 shapes.
2. Use palette tokens from `src/theme/tokens.ts` (`colors.*`); never hex values.
3. Add it to `ILLUSTRATIONS` in `Illustrations.tsx` so the Style Guide shows it.
4. Check it next to text in all three languages and at the smallest screen width.
