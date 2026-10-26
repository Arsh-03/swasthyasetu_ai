export type Tone = 'primary' | 'teal' | 'navy' | 'success' | 'warning' | 'danger' | 'gold' | 'neutral';

export type Domain = 'appointments' | 'medications' | 'records' | 'privacy' | 'followup' | 'emergency';

export const DOMAIN_TO_TONE: Record<Domain, Tone> = {
  appointments: 'primary',
  medications: 'teal',
  records: 'gold',
  privacy: 'navy',
  followup: 'warning',
  emergency: 'danger',
};

/** Tint fill + deep text + duotone icon in the same tone (all ≥ 4.5:1 text, ≥ 3:1 icon). */
export const TONE_CLASS: Record<
  Tone,
  { pill: string; dot: string; icon: 'primary' | 'teal' | 'navy' | 'success' | 'warning' | 'danger' | 'gold' | 'muted' }
> = {
  primary: { pill: 'bg-primary-tint text-primary-deep', dot: 'bg-primary', icon: 'primary' },
  teal: { pill: 'bg-teal-tint text-teal-deep', dot: 'bg-teal', icon: 'teal' },
  navy: { pill: 'bg-navy-tint text-navy-deep', dot: 'bg-navy', icon: 'navy' },
  success: { pill: 'bg-success-tint text-success-deep', dot: 'bg-success', icon: 'success' },
  warning: { pill: 'bg-warning-tint text-warning-deep', dot: 'bg-warning', icon: 'warning' },
  danger: { pill: 'bg-danger-tint text-danger-deep', dot: 'bg-danger', icon: 'danger' },
  gold: { pill: 'bg-gold-tint text-gold-deep', dot: 'bg-gold', icon: 'gold' },
  neutral: { pill: 'bg-ink-tint text-ink-muted', dot: 'bg-ink-muted', icon: 'muted' },
};
