import { z } from 'zod';
import { MEAL_SESSIONS } from '../enums';
import type { LibraryRow, LibraryRowError } from '../rules/library-import';
import { normalizeLibraryName } from '../rules/menu';

const Name = z.string().trim().min(1).max(120);
const Code = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, dot, dash or underscore');

const LibraryName = Name.transform(normalizeLibraryName);
const Id = z.string().trim().min(1).max(64);
const PerDay = z.number().int().min(0).max(20).nullable();

/** `#RRGGBB`, the colour a dish type is drawn in next to the dish name. */
export const HexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB')
  .transform((v) => v.toLowerCase());

/**
 * BR-10: dish types are master data the HC admin adds and edits (product owner, 2026-10-23), e.g.
 * Mặn, Chay, Cháo, Eat clean. Each has a colour and optional usual bounds per day (BR-13).
 */
export const DishTypeInputSchema = z
  .object({
    code: Code,
    name: z.string().trim().min(1).max(40),
    color: HexColorSchema,
    sortOrder: z.number().int().min(0).max(9999).default(0),
    minPerDay: PerDay.default(null),
    maxPerDay: PerDay.default(null),
  })
  .refine((v) => v.minPerDay === null || v.maxPerDay === null || v.minPerDay <= v.maxPerDay, {
    path: ['maxPerDay'],
    message: 'maxPerDay must be at least minPerDay',
  });
export const DishTypeUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    color: HexColorSchema,
    sortOrder: z.number().int().min(0).max(9999),
    minPerDay: PerDay,
    maxPerDay: PerDay,
    active: z.boolean(),
  })
  .partial();
export type DishTypeInput = z.infer<typeof DishTypeInputSchema>;
export type DishTypeUpdate = z.infer<typeof DishTypeUpdateSchema>;

/** What a menu, registration or library row needs to draw a dish type. */
export interface DishTypeLabel {
  id: string;
  name: string;
  color: string;
}

export interface DishTypeView extends DishTypeLabel {
  code: string;
  sortOrder: number;
  minPerDay: number | null;
  maxPerDay: number | null;
  active: boolean;
  /** Library dishes (archived included) of this type. */
  dishCount: number;
}

/** BR-10: main dish. Each library belongs to one canteen (product owner, 2026-10-23). */
export const DishInputSchema = z.object({
  canteenId: Id,
  name: LibraryName,
  typeId: Id,
  sessions: z.array(z.enum(MEAL_SESSIONS)).min(1),
});
export type DishInput = z.infer<typeof DishInputSchema>;
/** A dish stays in its canteen's library; only name, type and sessions change. */
export const DishUpdateSchema = DishInputSchema.omit({ canteenId: true });
export type DishUpdate = z.infer<typeof DishUpdateSchema>;

/** BR-10: dessert, in one canteen's library. */
export const DessertInputSchema = z.object({ canteenId: Id, name: LibraryName });
export type DessertInput = z.infer<typeof DessertInputSchema>;
export const DessertUpdateSchema = DessertInputSchema.omit({ canteenId: true });
export type DessertUpdate = z.infer<typeof DessertUpdateSchema>;

export interface DishView {
  id: string;
  canteenId: string;
  name: string;
  typeId: string;
  type: DishTypeLabel;
  sessions: Array<(typeof MEAL_SESSIONS)[number]>;
  /** BR-12 */
  displayName: string;
  archivedAt: string | null;
}

export interface DessertView {
  id: string;
  canteenId: string;
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

/** Result of uploading a dish-library file: a dry run (PREVIEW) or the applied import. */
export interface LibraryImportView {
  status: 'PREVIEW' | 'APPLIED' | 'REJECTED';
  rowCount: number;
  errors: LibraryRowError[];
  /** Rows that are (or, in a preview, would be) added. */
  toCreate: LibraryRow[];
  /** Rows skipped because the library already has them. */
  alreadyInLibrary: number;
}
