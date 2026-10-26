import type { SelectionLine } from './registration';

/**
 * Excel import of a week's registrations for a unit (product owner, 2026-10-23): the admin
 * downloads the unit's grid as a file, fills in quantities and uploads it. It follows the bulk
 * grid's rules (BR-20, BR-21): only days still open for on-behalf entry, only employees of the
 * grid, whole non-negative numbers. A blank cell means no meal. One bad cell rejects the file.
 */

/** Column key written in the template's hidden second row: `<date>|<menuItemId>`. */
export const registrationColumnKey = (date: string, menuItemId: string) => `${date}|${menuItemId}`;

export interface RawRegistrationImportRow {
  /** 1-based spreadsheet row number, for error messages. */
  rowNumber: number;
  employeeCode: string;
  /** Cell text by column key. */
  cells: Readonly<Record<string, string>>;
}

export const REGISTRATION_IMPORT_ERROR_CODES = [
  /** The column's day is locked, or the dish is no longer on that day's menu. */
  'COLUMN_NOT_EDITABLE',
  'EMPLOYEE_NOT_IN_LIST',
  'DUPLICATE_EMPLOYEE',
  'QUANTITY_INVALID',
] as const;
export type RegistrationImportErrorCode = (typeof REGISTRATION_IMPORT_ERROR_CODES)[number];

export interface RegistrationImportError {
  rowNumber: number;
  /** Column key, when the error is about one column or cell. */
  column: string | null;
  code: RegistrationImportErrorCode;
  value: string;
}

export interface RegistrationImportChange {
  employeeCode: string;
  date: string;
  /** The whole day's selection after the import (BR-20). */
  lines: SelectionLine[];
}

export const MAX_IMPORT_QUANTITY = 99;

export function validateRegistrationImport(args: {
  /** Column keys in the file, in order. */
  columns: readonly string[];
  rows: readonly RawRegistrationImportRow[];
  /** Days open for on-behalf entry, with the menu items served that day. */
  editable: ReadonlyMap<string, ReadonlySet<string>>;
  /** Employees of the grid with their current quantities by date and item. */
  current: ReadonlyMap<string, Readonly<Record<string, Readonly<Record<string, number>>>>>;
}):
  | { ok: true; changes: RegistrationImportChange[] }
  | { ok: false; errors: RegistrationImportError[] } {
  const errors: RegistrationImportError[] = [];
  const usable: Array<{ key: string; date: string; itemId: string }> = [];
  for (const key of args.columns) {
    const [date = '', itemId = ''] = key.split('|');
    if (!args.editable.get(date)?.has(itemId)) {
      errors.push({ rowNumber: 2, column: key, code: 'COLUMN_NOT_EDITABLE', value: key });
    } else usable.push({ key, date, itemId });
  }

  const changes: RegistrationImportChange[] = [];
  const seen = new Set<string>();
  for (const row of args.rows) {
    const code = row.employeeCode.trim();
    const current = args.current.get(code);
    if (!current) {
      errors.push({
        rowNumber: row.rowNumber,
        column: null,
        code: 'EMPLOYEE_NOT_IN_LIST',
        value: code,
      });
      continue;
    }
    if (seen.has(code)) {
      errors.push({
        rowNumber: row.rowNumber,
        column: null,
        code: 'DUPLICATE_EMPLOYEE',
        value: code,
      });
      continue;
    }
    seen.add(code);
    const byDate = new Map<string, Record<string, number>>();
    for (const col of usable) {
      const text = (row.cells[col.key] ?? '').trim();
      const quantity = text === '' ? 0 : Number(text);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_IMPORT_QUANTITY) {
        errors.push({
          rowNumber: row.rowNumber,
          column: col.key,
          code: 'QUANTITY_INVALID',
          value: text,
        });
        continue;
      }
      const day = byDate.get(col.date) ?? { ...(current[col.date] ?? {}) };
      day[col.itemId] = quantity;
      byDate.set(col.date, day);
    }
    for (const [date, quantities] of byDate) {
      const before = current[date] ?? {};
      const items = new Set([...Object.keys(before), ...Object.keys(quantities)]);
      const differs = [...items].some((id) => (before[id] ?? 0) !== (quantities[id] ?? 0));
      if (!differs) continue;
      changes.push({
        employeeCode: code,
        date,
        lines: Object.entries(quantities)
          .filter(([, q]) => q > 0)
          .map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
      });
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, changes };
}
