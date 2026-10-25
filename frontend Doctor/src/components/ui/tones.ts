export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'gold' | 'neutral';

/** Tint fill + deep text + duotone icon in the same tone (all ≥ 4.5:1, see check:contrast). */
export const TONE_CLASS: Record<Tone, { pill: string; dot: string; icon: 'primary' | 'success' | 'warning' | 'danger' | 'gold' | 'muted' }> = {
  primary: { pill: 'bg-primary-tint text-primary', dot: 'bg-primary', icon: 'primary' },
  success: { pill: 'bg-success-tint text-success-deep', dot: 'bg-success', icon: 'success' },
  warning: { pill: 'bg-warning-tint text-warning-deep', dot: 'bg-warning', icon: 'warning' },
  danger: { pill: 'bg-danger-tint text-danger-deep', dot: 'bg-danger', icon: 'danger' },
  gold: { pill: 'bg-gold-tint text-gold-deep', dot: 'bg-gold', icon: 'gold' },
  neutral: { pill: 'bg-ink-tint text-ink-muted', dot: 'bg-ink-muted', icon: 'muted' },
};
