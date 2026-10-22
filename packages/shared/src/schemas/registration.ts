import { z } from 'zod';
import type { DishType } from '../enums';
import type { AdminDayWindow, EmployeeDayWindow } from '../rules/registration';
import { EmployeeCodeSchema } from './auth';
import { DateStringSchema } from './menu';

/**
 * BR-20: one line of a day's selection. Integer and sign are checked by `validateDaySelection`
 * so the API can report them per line; the bound below only keeps values inside the database
 * column, it is not a portion limit.
 */
export const SelectionLineSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().finite().max(1_000_000),
});

/** A day's complete selection: lines not listed keep quantity 0 (BR-20: no row = no meal). */
export const DaySelectionSchema = z.object({
  lines: z.array(SelectionLineSchema).max(50),
});
export type DaySelection = z.infer<typeof DaySelectionSchema>;

/** /week: save several days at once (BR-22, BR-23). Days not listed are left as they are. */
export const MyWeekSaveSchema = z.object({
  weekStart: DateStringSchema,
  days: z
    .array(z.object({ date: DateStringSchema, lines: DaySelectionSchema.shape.lines }))
    .min(1)
    .max(7),
});
export type MyWeekSave = z.infer<typeof MyWeekSaveSchema>;

/** Bulk-entry grid: one day of one org unit, saved as a whole batch (plan 4.1). */
export const GridDaySaveSchema = z.object({
  canteenId: z.string().min(1),
  rows: z
    .array(z.object({ employeeCode: EmployeeCodeSchema, lines: DaySelectionSchema.shape.lines }))
    .min(1)
    .max(1000),
});
export type GridDaySave = z.infer<typeof GridDaySaveSchema>;

/** BR-25: an admin adds meals after the lock; flagged "Extra", reason required. */
export const ExtraMealSchema = z.object({
  date: DateStringSchema,
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(1).max(500),
});
export type ExtraMeal = z.infer<typeof ExtraMealSchema>;

export interface RegistrationLineView {
  menuItemId: string;
  displayName: string;
  type: DishType;
  /** Current active quantity (0 = not registered). */
  quantity: number;
  /** Quantity in the forecast snapshot; 0 when the forecast is taken but had none. */
  forecast: number;
}

export interface MyDayView {
  date: string;
  window: EmployeeDayWindow;
  /** When the day locks for employees (day.lockTime, BR-24). */
  lockAt: string;
  items: RegistrationLineView[];
  /** BR-14: meals on a removed dish, waiting to be reselected before the lock. */
  needsReselect: Array<{ displayName: string; quantity: number }>;
  /** Display-only (BR-11). */
  desserts: string[];
  actualTotal: number;
  /** Null until the forecast snapshot exists (BR-07). */
  forecastTotal: number | null;
  /** BR-23: true when the day differs from the forecast. */
  changed: boolean;
  /** BR-25: an admin added meals after the lock. */
  extra: boolean;
}

export type MyRegistrationWeekView =
  | { state: 'UNASSIGNED'; weekStart: string }
  | { state: 'NOT_PUBLISHED'; weekStart: string; canteenName: string }
  | {
      state: 'PUBLISHED';
      weekStart: string;
      canteenName: string;
      closeAt: string;
      /** BR-07: the forecast snapshot exists; changes are now differences from it. */
      forecastTaken: boolean;
      days: MyDayView[];
      totalMeals: number;
    };

export type MyDayRegistrationView =
  | { state: 'UNASSIGNED'; date: string }
  | { state: 'NO_MENU'; date: string; canteenName: string }
  | {
      state: 'DAY';
      date: string;
      canteenName: string;
      closeAt: string;
      forecastTaken: boolean;
      day: MyDayView;
    };

export interface HistoryDayView {
  date: string;
  /** Null when no forecast was taken for that week. */
  forecast: number | null;
  actual: number;
  meals: Array<{ displayName: string; forecast: number; actual: number; cancelled: number }>;
  status: 'REGISTERED' | 'NOT_REGISTERED' | 'CANCELLED';
}

/** BR-27: only name, dish, quantity and eating / not eating; never a reason. */
export interface TeamMemberView {
  key: string;
  name: string;
  meals: Array<{ displayName: string; quantity: number }>;
  eating: boolean;
}

export interface TeamDayView {
  date: string;
  unitId: string;
  unitName: string;
  members: TeamMemberView[];
}

export interface RegistrationUnitOption {
  id: string;
  name: string;
  pathName: string;
  level: number;
  isMealUnit: boolean;
  /** Employees below this node who can register (BR-60, BR-63). */
  employeeCount: number;
}

export interface RegistrationProgressView {
  weekStart: string;
  units: Array<{
    mealUnitId: string;
    name: string;
    pathName: string;
    canteenName: string | null;
    published: boolean;
    headcount: number;
    registered: number;
    notRegistered: number;
    meals: number;
  }>;
}

export interface NotRegisteredView {
  weekStart: string;
  date: string | null;
  total: number;
  items: Array<{ employeeCode: string; name: string; orgPath: string; mealUnitName: string }>;
}

export interface GridCellView {
  quantities: Record<string, number>;
  /** Null until the forecast snapshot exists. */
  forecast: Record<string, number> | null;
  extra: boolean;
  needsReselect: number;
  /** BR-36: the employee has left on or before this day. */
  blocked: boolean;
}

export interface RegistrationGridView {
  state: 'PUBLISHED' | 'NOT_PUBLISHED' | 'NO_EMPLOYEES';
  orgUnit: { id: string; name: string; pathName: string };
  weekStart: string;
  canteens: Array<{ id: string; name: string }>;
  canteenId: string | null;
  canteenName: string | null;
  closeAt: string | null;
  forecastTaken: boolean;
  days: Array<{
    date: string;
    window: AdminDayWindow;
    lockAt: string;
    items: Array<{ id: string; displayName: string; type: DishType }>;
  }>;
  rows: Array<{
    employeeCode: string;
    name: string;
    orgPath: string;
    cells: Record<string, GridCellView>;
  }>;
  /** Employees below the node left out of this grid. */
  skipped: { otherCanteen: number; cannotRegister: number };
}

export interface GridSaveResult {
  changedEmployees: number;
  meals: number;
}

export interface SaveRegistrationResult<T> {
  view: T;
  changedDays: string[];
}
