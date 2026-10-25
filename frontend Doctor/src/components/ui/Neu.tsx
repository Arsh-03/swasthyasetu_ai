import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

/**
 * Depth primitives (design_system_tokens.md § 5 / § 11).
 * RAISED = actionable, INSET = holds / shows / receives. STRONG = controls, SOFT = panels, rows, wells.
 * The look comes from CSS classes in src/styles/utilities.css; these components only pick the class.
 */

type BoxProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  /** Halved shadow offsets for elements < 48px. */
  compact?: boolean;
  children?: ReactNode;
};

/** SOFT raised panel: grouped content, tables, cards (radius 20). */
export function NeuPanel({ as: Tag = 'section', compact, className, ...rest }: BoxProps) {
  return <Tag className={cx(compact ? 'neu-panel-sm' : 'neu-panel', 'rounded-panel', className)} {...rest} />;
}

/** STRONG raised surface (static). For anything clickable use NeuButton. */
export function NeuRaised({ as: Tag = 'div', compact, className, ...rest }: BoxProps) {
  return <Tag className={cx(compact ? 'neu-raised-sm' : 'neu-raised', 'rounded-control', className)} {...rest} />;
}

/** INSET: `strong` for inputs / tracks, `soft` (default) for read-only text wells and trays. */
export function NeuInset({
  as: Tag = 'div',
  compact,
  strength = 'soft',
  className,
  ...rest
}: BoxProps & { strength?: 'soft' | 'strong' }) {
  const cls = strength === 'strong' ? (compact ? 'neu-inset-sm' : 'neu-inset') : compact ? 'neu-well-sm' : 'neu-well';
  return <Tag className={cx(cls, 'rounded-control', className)} {...rest} />;
}

/** Debossed divider: 1px dark line with 1px white right below (or beside, when vertical). */
export function Groove({ vertical = false, className }: { vertical?: boolean; className?: string }) {
  return vertical ? (
    <span role="separator" aria-orientation="vertical" className={cx('groove-v', className)} />
  ) : (
    <hr className={cx('groove', className)} />
  );
}
