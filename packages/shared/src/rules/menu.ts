import type { DishType } from '../enums';
import { addDays, isoWeekdayOf, type DateString } from './time';

/** BR-12: type labels used in a meal's display name. */
export const DISH_TYPE_LABELS: Readonly<Record<DishType, string>> = {
  CHAY: 'Chay',
  CHAO: 'Cháo',
  MAN: 'Mặn',
};

/**
 * BR-12: a meal is shown as its type in brackets, then the dish name, e.g.
 * "[Chay] Gạo lứt muối mè". The brackets are literal (product owner's choice, 2026-10-21).
 */
export function mealDisplayName(type: DishType, dishName: string): string {
  return `[${DISH_TYPE_LABELS[type]}] ${dishName.trim()}`;
}

/**
 * BR-13: the usual mix of a serving day. A different mix only warns; it never blocks publishing.
 */
export const USUAL_MENU_MIX: Readonly<Record<DishType, { min: number; max: number }>> = {
  CHAY: { min: 1, max: 1 },
  CHAO: { min: 1, max: 1 },
  MAN: { min: 2, max: 3 },
};

export interface MenuMixIssue {
  type: DishType;
  actual: number;
  min: number;
  max: number;
}

export interface MenuMixCheck {
  usual: boolean;
  counts: Record<DishType, number>;
  issues: MenuMixIssue[];
}

/** BR-13: compares one day's main-dish types with the usual 1 Chay + 1 Cháo + 2–3 Mặn. */
export function checkMenuMix(types: readonly DishType[]): MenuMixCheck {
  const counts: Record<DishType, number> = { CHAY: 0, CHAO: 0, MAN: 0 };
  for (const type of types) counts[type] += 1;
  const issues: MenuMixIssue[] = [];
  for (const type of Object.keys(USUAL_MENU_MIX) as DishType[]) {
    const { min, max } = USUAL_MENU_MIX[type];
    if (counts[type] < min || counts[type] > max) {
      issues.push({ type, actual: counts[type], min, max });
    }
  }
  return { usual: issues.length === 0, counts, issues };
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
