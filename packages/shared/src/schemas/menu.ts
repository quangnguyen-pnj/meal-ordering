import { z } from 'zod';
import type { MenuWeekStatus } from '../enums';
import type { DishTypeLabel } from './master';
import type { MenuMixCheck } from '../rules/menu';
import { parseDateString } from '../rules/time';

/** A calendar date `YYYY-MM-DD` that exists (no 2027-02-30). */
export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((value) => {
    try {
      parseDateString(value);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid calendar date');

/** BR-11: the HC admin saves a whole week of one canteen at once. */
export const MenuWeekSaveSchema = z.object({
  canteenId: z.string().min(1),
  weekStart: DateStringSchema,
  days: z
    .array(
      z.object({
        date: DateStringSchema,
        isServing: z.boolean(),
        /** Main dishes in display order; `id` refers to an existing item (BR-14 replace). */
        items: z.array(z.object({ id: z.string().min(1).optional(), dishId: z.string().min(1) })),
        dessertIds: z.array(z.string().min(1)),
      }),
    )
    .min(1)
    .max(7),
  /** Optional note for the audit log, e.g. "NCC đổi món" (BR-14, BR-70). */
  reason: z.string().trim().max(500).optional(),
});
export type MenuWeekSave = z.infer<typeof MenuWeekSaveSchema>;

export interface MenuItemView {
  id: string;
  dishId: string;
  dishName: string;
  type: DishTypeLabel;
  /** BR-12 */
  displayName: string;
}

export interface MenuDayView {
  date: string;
  isServing: boolean;
  items: MenuItemView[];
  desserts: Array<{ id: string; name: string }>;
  /** BR-13: warning only, never blocks publishing. Null for non-serving days. */
  mix: MenuMixCheck | null;
}

export interface MenuWeekView {
  /** Null while nothing has been saved for this canteen and week. */
  id: string | null;
  canteenId: string;
  canteenName: string;
  weekStart: string;
  status: MenuWeekStatus | 'NEW';
  publishedAt: string | null;
  /** Stored closeAt once published; otherwise what publishing now would give (BR-03, BR-04). */
  closeAt: string;
  closeAtIsExpected: boolean;
  latePublish: boolean;
  /** Days whose lock (day.lockTime) has passed can no longer change once published. */
  lockedDates: string[];
  days: MenuDayView[];
}

export interface MenuSaveResult {
  menu: MenuWeekView;
  /** BR-14 effects of editing a published menu. */
  effects: { movedRegistrations: number; flaggedRegistrations: number; notifiedEmployees: number };
}

/** What an employee sees: only a published menu of their own meal unit's canteen (BR-02, BR-15). */
export type MyMenuWeekView =
  | { state: 'UNASSIGNED'; weekStart: string }
  | { state: 'NOT_PUBLISHED'; weekStart: string; canteenName: string }
  | { state: 'PUBLISHED'; menu: MenuWeekView };
