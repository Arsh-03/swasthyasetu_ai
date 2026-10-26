import React, { useState } from 'react';
import { DOMAIN_TO_TONE, type Domain, type Tone } from './tones';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number; // size in px, e.g. 28, 36, 40, 64, 72
  className?: string;
  domain?: Domain;
  tone?: Tone;
  alt?: string;
  title?: string;
}

// 6 deterministic domain tones for initials fallback
const FALLBACK_TONES: Tone[] = ['primary', 'teal', 'navy', 'gold', 'success', 'warning'];

function getInitials(name: string): string {
  if (!name) return '?';
  // Strip titles like Dr. or Shri or Smt
  const clean = name.replace(/^(Dr\.|Dr|Shri|Smt|Mr\.|Mr|Mrs\.|Mrs|Ms\.)\s+/i, '').trim();
  // Strip bracketed text e.g. (ರಮೇಶ್ ಗೌಡ)
  const base = clean.replace(/\s*\([^)]*\)/g, '').trim() || clean;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getDeterministicTone(name: string): Tone {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % FALLBACK_TONES.length;
  return FALLBACK_TONES[index];
}

const TONE_STYLES: Record<Tone, string> = {
  primary: 'bg-primary-tint text-primary-deep border-primary/25',
  teal: 'bg-teal-tint text-teal-deep border-teal/25',
  navy: 'bg-navy-tint text-navy-deep border-navy/25',
  success: 'bg-success-tint text-success-deep border-success/25',
  warning: 'bg-warning-tint text-warning-deep border-warning/25',
  danger: 'bg-danger-tint text-danger-deep border-danger/25',
  gold: 'bg-gold-tint text-gold-deep border-gold/25',
  neutral: 'bg-ink-tint text-ink-muted border-ink/15',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 40,
  className = '',
  domain,
  tone,
  alt,
  title,
}) => {
  const [hasError, setHasError] = useState(false);

  // Pick tone: prop tone > domain tone > deterministic from name
  const effectiveTone: Tone = tone || (domain ? DOMAIN_TO_TONE[domain] : getDeterministicTone(name || ''));
  const toneStyle = TONE_STYLES[effectiveTone] || TONE_STYLES.primary;
  const initials = getInitials(name);

  // Compute font size relative to avatar diameter
  const fontSize = Math.max(10, Math.round(size * 0.36));

  if (!src || hasError) {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-bold uppercase tracking-wider shrink-0 select-none border shadow-2xs ${toneStyle} ${className}`}
        style={{ width: size, height: size, fontSize }}
        title={title || name}
        aria-label={alt || name}
        role="img"
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 select-none ring-1 ring-ink/10 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={alt || name}
        title={title || name}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
};
