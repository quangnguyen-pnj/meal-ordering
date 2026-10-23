import { z } from 'zod';
import type { MappingRowError, MappingTargetType } from '../rules/mapping-import';
import type { MealAssignmentStatus } from '../rules/mapping';
import { EmployeeCodeSchema } from './auth';

const NullableId = z.string().min(1).nullable();

/** BR-60 / BR-62: meal-unit flag and the node's own floor, canteen and cost center (null = inherit). */
export const OrgUnitUpdateSchema = z
  .object({
    isMealUnit: z.boolean(),
    floorId: NullableId,
    canteenId: NullableId,
    costCenterId: NullableId,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type OrgUnitUpdate = z.infer<typeof OrgUnitUpdateSchema>;

export const AssignDeptAdminSchema = z.object({ employeeCode: EmployeeCodeSchema });

/**
 * BR-63: the floor one employee picks up their meal on (null goes back to the meal unit's floor).
 * Replaces the cost-center override (2026-10-23): cost center now follows the org tree.
 */
export const FloorOverrideSchema = z.object({
  floorId: NullableId,
  reason: z.string().trim().min(1).max(500),
});

export const PrivilegedRoleSchema = z.object({
  employeeCode: EmployeeCodeSchema,
  role: z.enum(['HC_ADMIN', 'SYS_ADMIN']),
});

export interface ResolvedValueView {
  id: string | null;
  /** Node that supplies the value; differs from the node itself when inherited (BR-62). */
  sourceNodeId: string | null;
  inherited: boolean;
}

export interface OrgUnitView {
  id: string;
  dmpCode: string;
  name: string;
  level: number;
  dmpLevelName: string;
  parentId: string | null;
  active: boolean;
  isMealUnit: boolean;
  own: { floorId: string | null; canteenId: string | null; costCenterId: string | null };
  resolved: { floor: ResolvedValueView; canteen: ResolvedValueView; costCenter: ResolvedValueView };
  /** BR-60: the nearest meal unit at or above this node, i.e. the one its employees belong to. */
  mealUnitId: string | null;
  /** BR-63: only meaningful for meal units. */
  mealUnitValid: boolean | null;
  /** Employees attached directly to this node. */
  directHeadcount: number;
  deptAdmins: Array<{ assignmentId: string; employeeCode: string; name: string }>;
}

export interface EmployeeMappingView {
  employeeCode: string;
  name: string;
  status: 'ACTIVE' | 'LEFT';
  orgUnitId: string;
  /** "Khối Sản xuất / Xưởng Chế tác / ..." (BR-61: screens show the full path). */
  orgPath: string;
  mealUnitId: string | null;
  mealUnitName: string | null;
  mealStatus: MealAssignmentStatus;
  missing: Array<'floor' | 'canteen'>;
  floorId: string | null;
  floorName: string | null;
  /** OVERRIDE: the HC admin set this employee's pick-up floor (`floorOverrideId`). */
  floorSource: 'MEAL_UNIT' | 'OVERRIDE' | null;
  floorOverrideId: string | null;
  canteenId: string | null;
  canteenName: string | null;
  costCenterId: string | null;
  costCenterName: string | null;
  /** Cost center follows the org tree (MAPPING); DMP is the default when no node has one. */
  costCenterSource: 'MAPPING' | 'DMP' | null;
  roles: string[];
}

export interface MappingImportView {
  id: string;
  fileName: string;
  status: 'PREVIEW' | 'REJECTED' | 'APPLIED';
  rowCount: number;
  errorCount: number;
  errors: MappingRowError[];
  /** One entry per row that changes something; rows identical to the current mapping are skipped. */
  changes: Array<{
    rowNumber: number;
    type: MappingTargetType;
    code: string;
    name: string;
    before: { floorCode: string | null; canteenCode: string | null; costCenterCode: string | null };
    after: { floorCode: string | null; canteenCode: string | null; costCenterCode: string | null };
  }>;
  appliedAt: string | null;
}
