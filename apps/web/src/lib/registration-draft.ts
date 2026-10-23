import type { MyDayView, MyWeekSave, SelectionLine } from '@meal/shared';

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
