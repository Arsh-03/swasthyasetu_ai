import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** Tailwind width / alignment classes for the column, e.g. 'w-40 text-right'. */
  className?: string;
}

interface DataTableProps<Row> {
  caption: string;
  /** Visually hide the caption (it is still read by screen readers). */
  hideCaption?: boolean;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Makes rows keyboard-operable (Tab to a row, Enter / Space to open). */
  onRowClick?: (row: Row) => void;
  selectedKey?: string;
  empty?: ReactNode;
  className?: string;
}

/**
 * Clinician density rule: one SOFT raised panel, rows separated by debossed grooves,
 * NO per-row shadows. Hover = faint ink tint; selected row = primary tint + 3px primary accent bar.
 */
export function DataTable<Row>({ caption, hideCaption, columns, rows, rowKey, onRowClick, selectedKey, empty, className }: DataTableProps<Row>) {
  const onKey = (e: KeyboardEvent, row: Row) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick?.(row);
    }
  };
  return (
    <div className={cx('neu-panel overflow-x-auto rounded-panel', className)}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className={cx('px-4 pt-3 pb-1 text-left text-footnote font-semibold text-ink-muted', hideCaption && 'sr-only')}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cx('px-4 py-2.5 text-2xs font-semibold text-ink-muted', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="groove-rows">
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
                    onRowClick && 'cursor-pointer hover:bg-ink-tint',
                    selected && 'bg-primary-tint [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-primary),inset_0_1px_0_var(--neu-groove-light)]',
                    'focus-visible:-outline-offset-2',
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cx('px-4 py-2.5 align-middle text-ink', c.className)}>
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
