import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  className?: string;
}

interface DataTableProps<Row> {
  caption: string;
  hideCaption?: boolean;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  selectedKey?: string;
  empty?: ReactNode;
  className?: string;
}

/**
 * Dense clinician table: white card container (#FFFFFF) with 1px border (#DCE5EA) and e1 shadow.
 * Hairline dividers, desktop rows min 44px, tabular numbers, selected row = ice tint + 3px primary accent bar.
 */
export function DataTable<Row>({
  caption,
  hideCaption,
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  empty,
  className,
}: DataTableProps<Row>) {
  const onKey = (e: KeyboardEvent, row: Row) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div className={cx('surface-card overflow-x-auto rounded-panel border border-card-border shadow-e1', className)}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className={cx('px-4 pt-3 pb-1 text-left text-footnote font-semibold text-ink-muted', hideCaption && 'sr-only')}>
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-card-border bg-[#F8FAFC]">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cx('px-4 py-2.5 text-2xs font-semibold text-ink-muted uppercase tracking-wider', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-card-border">
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-ink-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              const selected = key === selectedKey;
              return (
                <tr
                  key={key}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-selected={onRowClick ? selected : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}
                  className={cx(
                    'min-h-[44px] transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-black/[0.02]',
                    selected && 'bg-ice/70 [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-primary)] font-medium',
                    'focus-visible:-outline-offset-2',
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cx('px-4 py-2.5 align-middle text-ink font-tabular', c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export const ListRow = DataTable;
