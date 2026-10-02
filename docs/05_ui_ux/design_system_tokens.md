# Design System Tokens & Vernacular Typography Specification

**Document ID:** UI-TOKENS-CB-2026-V1  
**Project:** CareBridge India  
**Scope:** Color Palette, Spatial Grid, Vernacular Font Hierarchies, and Accessibility Tokens  

---

## 1. Color Palette Tokens

```css
:root {
  /* Brand Primary: Trust Clinical Blue */
  --cb-primary: #0b63e5;
  --cb-primary-hover: #084ebd;
  --cb-primary-subtle: #eff6ff;

  /* Secondary: Clean Care Teal */
  --cb-teal: #0d9488;
  --cb-teal-subtle: #f0fdfa;

  /* Safety & Clinical Feedback */
  --cb-success: #16a34a;       /* Approved / Healthy / Synced */
  --cb-success-bg: #f0fdf4;
  --cb-warning: #d97706;       /* Degraded Network / Pending Action */
  --cb-warning-bg: #fffbeb;
  --cb-danger: #dc2626;        /* DDI Alert / Expired Token / Revocation */
  --cb-danger-bg: #fef2f2;

  /* Neutrals */
  --cb-bg: #f8fafc;
  --cb-surface: #ffffff;
  --cb-text-main: #0f172a;
  --cb-text-muted: #64748b;
  --cb-border: #e2e8f0;

  /* Radii & Shadows */
  --radius-card: 12px;
  --radius-button: 8px;
  --radius-pill: 9999px;
  --shadow-card: 0 4px 12px -2px rgba(15, 23, 42, 0.08);
}
```

---

## 2. Vernacular Typography & Line Height Calibration

Scripts such as **Kannada** and **Devanagari** possess complex vertical vowel modifiers (*matras* and conjuncts/*ottu*). Using default English line heights clips these characters, rendering text illegible or altering clinical meaning.

### Typography Rules:
- **English Font:** `Inter`, system-ui, sans-serif (Line height: `1.5`).
- **Kannada Font:** `Noto Sans Kannada`, sans-serif (Line height calibrated to **`1.75`**; font-size scaled by **1.1x**).
- **Hindi Font:** `Noto Sans Devanagari`, sans-serif (Line height calibrated to **`1.70`**; font-size scaled by **1.05x**).

---

## 3. High-Contrast Audio Buttons
- Any card containing vital consent or diagnostic information must feature a prominent, high-contrast Audio Badge:
  - Background: `#ECFDF5` (Soft Emerald).
  - Text/Icon: `#047857` (Deep Emerald).
  - Minimum touch target: **48px x 48px** for mobile accessibility.
