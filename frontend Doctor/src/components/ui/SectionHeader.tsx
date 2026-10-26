import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { Badge } from './Badge';
import type { Domain } from './tones';

export interface SectionHeaderProps {
  title: string;
  icon?: IconName;
  domain?: Domain;
  count?: number;
  action?: ReactNode;
  className?: string;
}

/**
 * SectionHeader: icon + title + count + optional action, used everywhere.
 */
export function SectionHeader({
  title,
  icon,
  domain,
  count,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cx('flex items-center justify-between gap-3 py-2', className)}>
      <div className="flex items-center gap-2">
        {icon && (
          <Icon
            name={icon}
            size={18}
            tone={domain === 'medications' ? 'teal' : domain === 'privacy' ? 'navy' : domain === 'records' ? 'gold' : domain === 'emergency' ? 'danger' : 'primary'}
            weight="duotone"
          />
        )}
        <h2 className="text-sm font-bold text-ink tracking-tight uppercase">{title}</h2>
        {count !== undefined && (
          <Badge tone={domain === 'medications' ? 'teal' : domain === 'privacy' ? 'navy' : domain === 'records' ? 'gold' : 'primary'}>
            {count}
          </Badge>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
