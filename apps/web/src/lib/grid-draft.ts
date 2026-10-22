import type { RegistrationGridView, SelectionLine } from '@meal/shared';

/** Cell text by employee code, then menu item id. Empty means 0, like a blank paper cell. */
export type GridValues = Record<string, Record<string, string>>;

export function gridValues(view: RegistrationGridView, date: string): GridValues {
  const day = view.days.find((d) => d.date === date);
  const out: GridValues = {};
  for (const row of view.rows) {
    const cell = row.cells[date];
    out[row.employeeCode] = Object.fromEntries(
      (day?.items ?? []).map((i) => {
        const q = cell?.quantities[i.id] ?? 0;
        return [i.id, q > 0 ? String(q) : ''];
      }),
    );
  }
  return out;
}

/** BR-20 in the grid: a blank or a whole number from 0; anything else is invalid (null). */
export function parseCell(text: string): number | null {
  const v = text.trim();
  if (v === '') return 0;
  return /^\d+$/.test(v) ? Number(v) : null;
}

export interface GridChanges {
  /** Changed rows with their complete selection for the day (the API replaces the day). */
  rows: Array<{ employeeCode: string; lines: SelectionLine[] }>;
  /** Invalid cells by employee code (menu item ids). */
  invalid: Record<string, string[]>;
}

export function gridChanges(
  view: RegistrationGridView,
  date: string,
  values: GridValues,
): GridChanges {
  const day = view.days.find((d) => d.date === date);
  const result: GridChanges = { rows: [], invalid: {} };
  if (!day) return result;
  for (const row of view.rows) {
    const stored = row.cells[date]?.quantities ?? {};
    const lines: SelectionLine[] = [];
    let changed = false;
    for (const item of day.items) {
      const q = parseCell(values[row.employeeCode]?.[item.id] ?? '');
      if (q === null) {
        (result.invalid[row.employeeCode] ??= []).push(item.id);
        continue;
      }
      if (q !== (stored[item.id] ?? 0)) changed = true;
      if (q > 0) lines.push({ menuItemId: item.id, quantity: q });
    }
    if (changed && !result.invalid[row.employeeCode]) {
      result.rows.push({ employeeCode: row.employeeCode, lines });
    }
  }
  return result;
}

/** Column totals of the current values, ignoring invalid cells. */
export function columnTotals(
  view: RegistrationGridView,
  date: string,
  values: GridValues,
): Record<string, number> {
  const day = view.days.find((d) => d.date === date);
  const totals: Record<string, number> = {};
  for (const item of day?.items ?? []) {
    totals[item.id] = view.rows.reduce(
      (s, r) => s + (parseCell(values[r.employeeCode]?.[item.id] ?? '') ?? 0),
      0,
    );
  }
  return totals;
}
