import { addDays, isoWeekdayOf, type DateString } from './time';

/**
 * BR-12: a meal is shown as its type in brackets, then the dish name, e.g.
 * "[Chay] Gạo lứt muối mè". The brackets are literal (product owner's choice, 2026-10-21). Dish
 * types are master data since 2026-10-23, so the label is the type's own name; screens also draw
 * it in the type's colour.
 */
export function mealDisplayName(typeName: string, dishName: string): string {
  return `[${typeName.trim()}] ${dishName.trim()}`;
}

/** Library names are stored trimmed with single spaces, so "Cá  kho " and "Cá kho" are one dish. */
export function normalizeLibraryName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Case-insensitive key that decides whether two library entries are the same (no duplicates). */
export function libraryNameKey(name: string): string {
  return normalizeLibraryName(name).toLocaleLowerCase('vi');
}

/**
 * BR-13: how many dishes of a type a serving day usually has. Each dish type (master data) carries
 * its own optional bounds; a type with neither bound is not checked. The seed keeps the plan's mix:
 * Chay 1, Cháo 1, Mặn 2–3. A different mix only warns; it never blocks publishing.
 */
export interface MenuMixRule {
  typeId: string;
  typeName: string;
  minPerDay: number | null;
  maxPerDay: number | null;
}

export interface MenuMixIssue {
  typeId: string;
  typeName: string;
  actual: number;
  min: number | null;
  max: number | null;
}

export interface MenuMixCheck {
  usual: boolean;
  /** Dishes per type id. */
  counts: Record<string, number>;
  issues: MenuMixIssue[];
}

/** BR-13: compares one day's main-dish types (ids) with each type's usual bounds. */
export function checkMenuMix(
  typeIds: readonly string[],
  rules: readonly MenuMixRule[],
): MenuMixCheck {
  const counts: Record<string, number> = {};
  for (const id of typeIds) counts[id] = (counts[id] ?? 0) + 1;
  const issues: MenuMixIssue[] = [];
  for (const rule of rules) {
    if (rule.minPerDay === null && rule.maxPerDay === null) continue;
    const actual = counts[rule.typeId] ?? 0;
    if (
      (rule.minPerDay !== null && actual < rule.minPerDay) ||
      (rule.maxPerDay !== null && actual > rule.maxPerDay)
    ) {
      issues.push({
        typeId: rule.typeId,
        typeName: rule.typeName,
        actual,
        min: rule.minPerDay,
        max: rule.maxPerDay,
      });
    }
  }
  return { usual: issues.length === 0, counts, issues };
}

export type MenuDayGap = 'MAIN' | 'DESSERT';

/**
 * A week can be published only when every serving day has at least one main dish and at least one
 * dessert (product owner, 2026-10-23). Days that do not serve are skipped. The same check guards
 * edits of a published day, so a published day never loses its last main dish or dessert.
 */
export function menuDayGaps(day: {
  isServing: boolean;
  mainCount: number;
  dessertCount: number;
}): MenuDayGap[] {
  if (!day.isServing) return [];
  const gaps: MenuDayGap[] = [];
  if (day.mainCount < 1) gaps.push('MAIN');
  if (day.dessertCount < 1) gaps.push('DESSERT');
  return gaps;
}

/** Every serving day with what it lacks; empty when the week can be published. */
export function menuWeekGaps(
  days: ReadonlyArray<{
    date: DateString;
    isServing: boolean;
    mainCount: number;
    dessertCount: number;
  }>,
): Array<{ date: DateString; gaps: MenuDayGap[] }> {
  return days.map((d) => ({ date: d.date, gaps: menuDayGaps(d) })).filter((d) => d.gaps.length > 0);
}

/**
 * BR-08: the days a menu week offers. Monday–Sunday are always listed so the HC admin can turn
 * Saturday or Sunday on per week (product owner, 2026-10-23: Sunday was missing). Which days serve
 * by default still comes from the `servingDays` setting (`isDefaultServingDay`).
 */
export function menuWeekDates(weekStart: DateString): DateString[] {
  if (isoWeekdayOf(weekStart) !== 1) {
    throw new RangeError(`weekStart must be a Monday, got ${weekStart}`);
  }
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(weekStart, offset));
}

/** BR-08: a day serves by default when its weekday is in the `servingDays` setting. */
export function isDefaultServingDay(date: DateString, servingDays: readonly number[]): boolean {
  return servingDays.includes(isoWeekdayOf(date));
}

export interface MenuItemRef {
  id: string;
  dishId: string;
}

export interface DesiredMenuItem {
  /** Existing item id; omitted for a new item. */
  id?: string;
  dishId: string;
}

export type MenuDayEditError =
  | { code: 'UNKNOWN_ITEM'; itemId: string }
  | { code: 'DUPLICATE_ITEM'; itemId: string }
  | { code: 'DUPLICATE_DISH'; dishId: string };

export interface MenuDayEditPlan {
  /** Items whose dish is unchanged; only their order may move. */
  keep: Array<{ id: string; sortOrder: number }>;
  /** BR-14: the dish of an existing item changes; its registrations move to the replacement. */
  replace: Array<{ fromId: string; fromDishId: string; toDishId: string; sortOrder: number }>;
  /** BR-14: the item is removed; its registrations need reselection. */
  remove: Array<{ id: string; dishId: string }>;
  add: Array<{ dishId: string; sortOrder: number }>;
}

/**
 * BR-11 / BR-14: turns the saved list of a day's main dishes into keep / replace / remove / add
 * steps. An entry that carries an existing item id with a different dish is a replacement; an
 * existing item missing from the list is a removal. The same dish cannot appear twice on a day.
 */
export function planMenuDayEdit(
  existing: readonly MenuItemRef[],
  desired: readonly DesiredMenuItem[],
): { ok: true; plan: MenuDayEditPlan } | { ok: false; errors: MenuDayEditError[] } {
  const byId = new Map(existing.map((i) => [i.id, i]));
  const errors: MenuDayEditError[] = [];
  const seenIds = new Set<string>();
  const seenDishes = new Set<string>();
  for (const item of desired) {
    if (item.id !== undefined) {
      if (!byId.has(item.id)) errors.push({ code: 'UNKNOWN_ITEM', itemId: item.id });
      else if (seenIds.has(item.id)) errors.push({ code: 'DUPLICATE_ITEM', itemId: item.id });
      seenIds.add(item.id);
    }
    if (seenDishes.has(item.dishId)) errors.push({ code: 'DUPLICATE_DISH', dishId: item.dishId });
    seenDishes.add(item.dishId);
  }
  if (errors.length > 0) return { ok: false, errors };

  const plan: MenuDayEditPlan = { keep: [], replace: [], remove: [], add: [] };
  desired.forEach((item, sortOrder) => {
    const current = item.id === undefined ? undefined : byId.get(item.id);
    if (!current) plan.add.push({ dishId: item.dishId, sortOrder });
    else if (current.dishId === item.dishId) plan.keep.push({ id: current.id, sortOrder });
    else
      plan.replace.push({
        fromId: current.id,
        fromDishId: current.dishId,
        toDishId: item.dishId,
        sortOrder,
      });
  });
  for (const item of existing) {
    if (!seenIds.has(item.id)) plan.remove.push({ id: item.id, dishId: item.dishId });
  }
  return { ok: true, plan };
}
