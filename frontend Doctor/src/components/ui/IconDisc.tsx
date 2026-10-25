import { cx } from './cx';
import { Icon, type IconName, type IconTone } from './Icon';

export type DiscTone = Extract<IconTone, 'primary' | 'success' | 'warning' | 'danger' | 'gold' | 'muted'>;

interface IconDiscProps {
  icon: IconName;
  tone?: DiscTone;
  /** px, default 40. Discs < 48 use the compact (halved) shadows. */
  size?: number;
  /** RAISED = tappable (wrap in a button). INSET = informational (status, metric, list leading). */
  variant?: 'raised' | 'inset';
  shape?: 'circle' | 'square';
  /** Duotone glyph (default); pass false for the regular weight (inactive). */
  active?: boolean;
  /** Accessible name when the disc is meaningful on its own; otherwise decorative. */
  label?: string;
  className?: string;
}

/** Phosphor glyph on a neumorphic disc. Static: put it inside a NeuButton / button for taps. */
export function IconDisc({ icon, tone = 'primary', size = 40, variant = 'inset', shape = 'circle', active = true, label, className }: IconDiscProps) {
  const compact = size < 48;
  const depth = variant === 'raised' ? (compact ? 'neu-raised-sm' : 'neu-raised') : compact ? 'neu-well-sm' : 'neu-well';
  return (
    <span
      className={cx(depth, 'inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : Math.round(size * 0.32) }}
    >
      <Icon name={icon} size={Math.round(size * 0.52)} tone={tone} weight={active ? 'duotone' : 'regular'} label={label} />
    </span>
  );
}

interface EmbossedIconProps {
  icon: IconName;
  /** Decorative sizes only (≥ 32). */
  size?: number;
  tone?: Extract<IconTone, 'primary' | 'ink' | 'success' | 'warning' | 'danger'>;
  className?: string;
}

const EMBOSS = 1.5;

/**
 * Large decorative icon with an extruded look: a white copy offset up-left and a shadow copy
 * offset down-right sit under the main glyph. The main glyph stays primary / ink / a deep status
 * colour (≥ 3:1), never white-on-white. Hidden from assistive tech: adjacent text carries the meaning.
 */
export function EmbossedIcon({ icon, size = 48, tone = 'primary', className }: EmbossedIconProps) {
  const s = Math.max(32, size);
  return (
    <span aria-hidden className={cx('relative inline-block shrink-0', className)} style={{ width: s + EMBOSS * 2, height: s + EMBOSS * 2 }}>
      <span className="absolute top-0 left-0 text-white">
        <Icon name={icon} size={s} weight="duotone" />
      </span>
      <span className="absolute text-(--neu-dark)" style={{ left: EMBOSS * 2, top: EMBOSS * 2 }}>
        <Icon name={icon} size={s} weight="duotone" />
      </span>
      <span className="absolute" style={{ left: EMBOSS, top: EMBOSS }}>
        <Icon name={icon} size={s} tone={tone} weight="duotone" />
      </span>
    </span>
  );
}
