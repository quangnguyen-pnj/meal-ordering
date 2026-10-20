import { z } from 'zod';
import { DISH_TYPES, MEAL_SESSIONS } from '../enums';

const Name = z.string().trim().min(1).max(120);
const Code = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, dot, dash or underscore');

/** BR-10: main dish. */
export const DishInputSchema = z.object({
  name: Name,
  type: z.enum(DISH_TYPES),
  sessions: z.array(z.enum(MEAL_SESSIONS)).min(1),
});
export type DishInput = z.infer<typeof DishInputSchema>;

/** BR-10: dessert. */
export const DessertInputSchema = z.object({ name: Name });
export type DessertInput = z.infer<typeof DessertInputSchema>;

export interface DishView {
  id: string;
  name: string;
  type: (typeof DISH_TYPES)[number];
  sessions: Array<(typeof MEAL_SESSIONS)[number]>;
  /** BR-12 */
  displayName: string;
  archivedAt: string | null;
}

export interface DessertView {
  id: string;
  name: string;
  archivedAt: string | null;
}

/** BR-62: canteens, floors and cost centers are added, edited and deactivated, never deleted. */
export const CanteenInputSchema = z.object({ code: Code, name: Name });
export const CanteenUpdateSchema = z.object({ name: Name, active: z.boolean() }).partial();
export const FloorInputSchema = z.object({
  code: Code,
  name: Name,
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export const FloorUpdateSchema = z
  .object({ name: Name, sortOrder: z.number().int().min(0).max(9999), active: z.boolean() })
  .partial();
export const CostCenterInputSchema = z.object({ code: Code, name: Name });
export const CostCenterUpdateSchema = z.object({ name: Name, active: z.boolean() }).partial();

export type CanteenInput = z.infer<typeof CanteenInputSchema>;
export type FloorInput = z.infer<typeof FloorInputSchema>;
export type CostCenterInput = z.infer<typeof CostCenterInputSchema>;

export interface MasterItemView {
  id: string;
  code: string;
  name: string;
  active: boolean;
  /** Floors only. */
  sortOrder?: number;
  /** Cost centers only: DMP or MANUAL. */
  source?: 'DMP' | 'MANUAL';
  /** Org nodes (and, for cost centers, employee overrides) that use this item directly. */
  usageCount: number;
}

export const SupplierUpdateSchema = z.object({
  name: Name,
  unitPrice: z.number().min(0).max(10_000_000),
});
export type SupplierUpdate = z.infer<typeof SupplierUpdateSchema>;
