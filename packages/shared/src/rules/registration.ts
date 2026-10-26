import { dayLockAt } from './deadlines';
import { addDays, vnToUtc, type DateString } from './time';

/** One registration line: a quantity of one menu item (a meal) on one day (BR-20). */
export interface SelectionLine {
  menuItemId: string;
  quantity: number;
}

export const SELECTION_ERROR_CODES = [
  /** BR-20: quantities are non-negative. */
  'QUANTITY_NEGATIVE',
  /** BR-20: quantities are integers. */
  'QUANTITY_NOT_INTEGER',
  /** BR-20: the item must be a published menu item of that day and canteen. */
  'ITEM_NOT_ON_MENU',
  /** The same item twice in one selection is ambiguous. */
  'DUPLICATE_ITEM',
  /** Only when a cap is configured; the MVP has none (BR-20). */
  'OVER_LIMIT',
] as const;
export type SelectionErrorCode = (typeof SELECTION_ERROR_CODES)[number];

export interface SelectionError {
  code: SelectionErrorCode;
  menuItemId: string;
}

/**
 * BR-20: no portion limit. Per employee, day and session an employee may pick any dishes on that
 * day's menu, several dishes and several types, each with a non-negative integer quantity. Zero
 * or no line means not registered.
 *
 * `maxPerDay` is the hook BR-20 keeps for a future cap; it is null (no cap) everywhere today.
 */
export function validateDaySelection(
  lines: readonly SelectionLine[],
  menuItemIds: ReadonlySet<string>,
  options: { maxPerDay?: number | null } = {},
): { ok: true } | { ok: false; errors: SelectionError[] } {
  const errors: SelectionError[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.menuItemId)) {
      errors.push({ code: 'DUPLICATE_ITEM', menuItemId: line.menuItemId });
      continue;
    }
    seen.add(line.menuItemId);
    if (!Number.isInteger(line.quantity)) {
      errors.push({ code: 'QUANTITY_NOT_INTEGER', menuItemId: line.menuItemId });
    } else if (line.quantity < 0) {
      errors.push({ code: 'QUANTITY_NEGATIVE', menuItemId: line.menuItemId });
    }
    if (!menuItemIds.has(line.menuItemId)) {
      errors.push({ code: 'ITEM_NOT_ON_MENU', menuItemId: line.menuItemId });
    }
  }
  const max = options.maxPerDay ?? null;
  if (errors.length === 0 && max !== null && totalMeals(lines) > max) {
    errors.push({ code: 'OVER_LIMIT', menuItemId: lines[lines.length - 1]?.menuItemId ?? '' });
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function totalMeals(lines: readonly SelectionLine[]): number {
  return lines.reduce((sum, l) => sum + (l.quantity > 0 ? l.quantity : 0), 0);
}

/**
 * What an employee may do with their own meals of serving day `date` (BR-22 to BR-24):
 * - OPEN: before closeAt and before the day's lock; changes form the forecast (BR-22).
 * - AFTER_CLOSE: closeAt has passed (or the forecast was already taken) but the day's lock has
 *   not; add, change and remove are still allowed, also without a forecast, and every change is
 *   a difference from the forecast (BR-23).
 * - LOCKED: at or after `day.lockTime` on day D, employees cannot change anything (BR-24). A late
 *   closeAt never pushes a day past its own lock (BR-05).
 */
export type EmployeeDayWindow = 'OPEN' | 'AFTER_CLOSE' | 'LOCKED';

export function employeeDayWindow(args: {
  now: Date;
  date: DateString;
  closeAt: Date;
  lockTime: string;
  /** True once the forecast snapshot exists (BR-07), even if `now` reads earlier. */
  forecastTaken?: boolean;
}): EmployeeDayWindow {
  const t = args.now.getTime();
  if (t >= dayLockAt(args.date, args.lockTime).getTime()) return 'LOCKED';
  if (args.forecastTaken || t >= args.closeAt.getTime()) return 'AFTER_CLOSE';
  return 'OPEN';
}

/**
 * What a dept or HC admin may do for an employee's day:
 * - ON_BEHALF: until the day's lock, register and edit on behalf like the employee (BR-21).
 * - EXTRA: after the lock and before finalization, only add meals flagged "Extra" with a reason
 *   (BR-25). Editing or reducing after the lock is /admin/today (P3).
 * - CLOSED: nothing through registration; later changes go through adjustments (BR-46, P4).
 *
 * TODO(BR-25): finalization (DayClose) arrives in P4. Until then the extra window also ends when
 * day D ends in Vietnam time, so past days never change (open-questions Q20).
 */
export type AdminDayWindow = 'ON_BEHALF' | 'EXTRA' | 'CLOSED';

export function adminDayWindow(args: {
  now: Date;
  date: DateString;
  lockTime: string;
  finalized: boolean;
}): AdminDayWindow {
  const t = args.now.getTime();
  if (t < dayLockAt(args.date, args.lockTime).getTime()) return 'ON_BEHALF';
  if (args.finalized) return 'CLOSED';
  return t < vnToUtc(addDays(args.date, 1), '00:00').getTime() ? 'EXTRA' : 'CLOSED';
}

export interface RegistrationLike {
  menuItemId: string;
  quantity: number;
  status: 'ACTIVE' | 'NEEDS_RESELECT' | 'CANCELLED';
}

/**
 * BR-07 / BR-22: the registrations that make the forecast at closeAt: active lines with a
 * positive quantity. A line waiting for reselection (BR-14) is not a meal anyone chose from the
 * current menu, so it is left out (open-questions Q21).
 */
export function forecastLinesOf<T extends RegistrationLike>(registrations: readonly T[]): T[] {
  return registrations.filter((r) => r.status === 'ACTIVE' && r.quantity > 0);
}

export interface ForecastComparisonLine {
  menuItemId: string;
  forecast: number;
  actual: number;
  /** actual - forecast */
  difference: number;
}

/**
 * BR-23: after closeAt every change is a difference from the immutable forecast. Compares one
 * employee's (or one unit's) forecast with the current active lines, per menu item.
 */
export function compareWithForecast(
  forecast: readonly SelectionLine[],
  actual: readonly SelectionLine[],
): {
  lines: ForecastComparisonLine[];
  changed: boolean;
  forecastTotal: number;
  actualTotal: number;
} {
  const byItem = new Map<string, ForecastComparisonLine>();
  const line = (id: string) => {
    let l = byItem.get(id);
    if (!l) {
      l = { menuItemId: id, forecast: 0, actual: 0, difference: 0 };
      byItem.set(id, l);
    }
    return l;
  };
  for (const f of forecast) line(f.menuItemId).forecast += f.quantity;
  for (const a of actual) line(a.menuItemId).actual += Math.max(a.quantity, 0);
  const lines = [...byItem.values()]
    .map((l) => ({ ...l, difference: l.actual - l.forecast }))
    .filter((l) => l.forecast !== 0 || l.actual !== 0);
  return {
    lines,
    changed: lines.some((l) => l.difference !== 0),
    forecastTotal: totalMeals(forecast),
    actualTotal: totalMeals(actual),
  };
}

/**
 * BR-36: an employee who leaves loses all meals from their end date. Registrations of a day whose
 * lock has already passed are left to reconciliation, so locked days never change silently.
 */
export function isLostByLeaver(args: {
  date: DateString;
  endDate: DateString;
  now: Date;
  lockTime: string;
}): boolean {
  return (
    args.date >= args.endDate && args.now.getTime() < dayLockAt(args.date, args.lockTime).getTime()
  );
}
