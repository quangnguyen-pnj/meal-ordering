import {
  applyToWholeWeek,
  sameAsLastWeek,
  type DishType,
  type MyDayView,
  type MyWeekSave,
  type SelectionLine,
  type ShortcutDay,
  type ShortcutResult,
} from '@meal/shared';

/** Quantities the employee is editing: date → menu item → quantity. */
export type Draft = Record<string, Record<string, number>>;

export function draftFromDays(days: readonly MyDayView[]): Draft {
  return Object.fromEntries(
    days.map((d) => [d.date, Object.fromEntries(d.items.map((i) => [i.menuItemId, i.quantity]))]),
  );
}

export const isEditable = (day: MyDayView) => day.window !== 'LOCKED';

export function linesOf(quantities: Record<string, number> | undefined): SelectionLine[] {
  return Object.entries(quantities ?? {})
    .filter(([, quantity]) => quantity > 0)
    .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
}

const total = (q: Record<string, number> | undefined) =>
  Object.values(q ?? {}).reduce((s, n) => s + (n > 0 ? n : 0), 0);

export function dayTotal(draft: Draft, date: string): number {
  return total(draft[date]);
}

/** Editable days whose draft differs from what is stored. */
export function changedDates(days: readonly MyDayView[], draft: Draft): string[] {
  return days
    .filter(isEditable)
    .filter((d) => d.items.some((i) => (draft[d.date]?.[i.menuItemId] ?? 0) !== i.quantity))
    .map((d) => d.date);
}

/** The body of PUT /registrations/me/week: only the changed, editable days (BR-22, BR-23). */
export function saveBody(weekStart: string, days: readonly MyDayView[], draft: Draft): MyWeekSave {
  return {
    weekStart,
    days: changedDates(days, draft).map((date) => ({ date, lines: linesOf(draft[date]) })),
  };
}

export function setQuantity(draft: Draft, date: string, itemId: string, quantity: number): Draft {
  return { ...draft, [date]: { ...draft[date], [itemId]: Math.max(0, Math.floor(quantity)) } };
}

const shortcutDay = (d: MyDayView): ShortcutDay => ({
  date: d.date,
  items: d.items.map((i) => ({ id: i.menuItemId, type: i.type })),
});

/** Merges a BR-26 result into the draft: each filled day replaces that day's quantities. */
function merge(draft: Draft, days: readonly MyDayView[], result: ShortcutResult): Draft {
  const next = { ...draft };
  for (const day of days) {
    const lines = result.days[day.date];
    if (!lines) continue;
    next[day.date] = Object.fromEntries(day.items.map((i) => [i.menuItemId, 0]));
    for (const l of lines) next[day.date]![l.menuItemId] = l.quantity;
  }
  return next;
}

/**
 * BR-26 "Same as last week" on the editable days, from last week's stored quantities. Returns
 * the new draft and what could not be copied; nothing is saved until the user presses Save.
 */
export function applySameAsLastWeek(
  draft: Draft,
  days: readonly MyDayView[],
  lastWeek: readonly MyDayView[],
): { draft: Draft; skipped: ShortcutResult['skipped']; copied: number } {
  const types = new Map<string, DishType>();
  const selections: Record<string, SelectionLine[]> = {};
  for (const d of lastWeek) {
    for (const i of d.items) types.set(i.menuItemId, i.type);
    selections[d.date] = d.items
      .filter((i) => i.quantity > 0)
      .map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }));
  }
  const result = sameAsLastWeek({
    lastWeek: selections,
    lastWeekTypes: types,
    targets: days.filter(isEditable).map(shortcutDay),
  });
  const copied = Object.values(selections).reduce((s, lines) => s + total(toQ(lines)), 0);
  return { draft: merge(draft, days, result), skipped: result.skipped, copied };
}

/** BR-26 "Apply to whole week": copies `source`'s draft to the other editable days by type. */
export function applyDayToWeek(
  draft: Draft,
  days: readonly MyDayView[],
  source: MyDayView,
): { draft: Draft; skipped: ShortcutResult['skipped'] } {
  const result = applyToWholeWeek({
    source: shortcutDay(source),
    selection: linesOf(draft[source.date]),
    targets: days.filter(isEditable).map(shortcutDay),
  });
  return { draft: merge(draft, days, result), skipped: result.skipped };
}

function toQ(lines: readonly SelectionLine[]): Record<string, number> {
  return Object.fromEntries(lines.map((l) => [l.menuItemId, l.quantity]));
}
