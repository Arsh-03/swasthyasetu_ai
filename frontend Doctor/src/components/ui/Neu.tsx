import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type BoxProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  compact?: boolean;
  children?: ReactNode;
};

/** Card / Panel: pure white (#FFFFFF), 1px border (#DCE5EA), e1 elevation. */
export function NeuPanel({ as: Tag = 'section', className, ...rest }: BoxProps) {
  return <Tag className={cx('surface-card rounded-panel p-4', className)} {...rest} />;
}

export function NeuRaised({ as: Tag = 'div', className, ...rest }: BoxProps) {
  return <Tag className={cx('surface-card rounded-control p-3', className)} {...rest} />;
}

/** Inset / Well: clean flat surface with input border. */
export function NeuInset({
  as: Tag = 'div',
  className,
  ...rest
}: BoxProps & { strength?: 'soft' | 'strong' }) {
  return <Tag className={cx('surface-well rounded-control p-3', className)} {...rest} />;
}

/** Hairline divider. */
export function Groove({ vertical = false, className }: { vertical?: boolean; className?: string }) {
  return vertical ? (
    <span role="separator" aria-orientation="vertical" className={cx('divider-v', className)} />
  ) : (
    <hr className={cx('divider', className)} />
  );
}

/* Neutral aliases */
export const Card = NeuPanel;
export const Panel = NeuPanel;
export const Well = NeuInset;
export const Divider = Groove;
