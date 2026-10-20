import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { EmployeeMappingView, ListScope } from '@meal/shared';
import { AuditService } from '../audit/audit.service';
import { invalid, notFound } from '../common/api-error';
import {
  EMPLOYEE_FOR_MAPPING_SELECT,
  costCenterIdsByCode,
  describeEmployees,
  loadMasterNames,
  loadOrg,
} from '../org/org-index';
import { PrismaService } from '../prisma/prisma.service';

/** Translates a guard-resolved list scope into a Prisma filter (plan section 3: lists are scoped). */
export function employeeScopeWhere(scope: ListScope): Prisma.EmployeeWhereInput {
  switch (scope.kind) {
    case 'all':
      return {};
    case 'factories':
      return { orgUnit: { factoryId: { in: scope.factoryIds } } };
    case 'paths':
      return { OR: scope.paths.map((path) => ({ orgUnit: { path: { startsWith: path } } })) };
    case 'self':
      return { id: scope.employeeId };
    case 'none':
      return { id: { in: [] } };
  }
}

export interface EmployeeListFilter {
  q?: string;
  /** Employees at or below this org node (BR-61: filter by org path). */
  orgUnitId?: string;
  floorId?: string;
  canteenId?: string;
  costCenterId?: string;
  mealStatus?: EmployeeMappingView['mealStatus'];
  status?: 'ACTIVE' | 'LEFT';
  offset: number;
  limit: number;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * /admin/employees: scoped finder with the resolved meal unit, floor, canteen and cost center
   * (BR-60, BR-63). Floor / canteen / cost center are inherited values, so they are filtered
   * after resolution; the factory has ~1,700 employees, which fits comfortably in memory.
   */
  async list(scope: ListScope, factoryId: string, f: EmployeeListFilter) {
    const where: Prisma.EmployeeWhereInput[] = [employeeScopeWhere(scope)];
    if (f.q) {
      where.push({
        OR: [
          { employeeCode: { contains: f.q, mode: 'insensitive' } },
          { name: { contains: f.q, mode: 'insensitive' } },
        ],
      });
    }
    if (f.status) where.push({ status: f.status });
    if (f.orgUnitId) {
      const unit = await this.prisma.orgUnit.findUnique({ where: { id: f.orgUnitId } });
      where.push(unit ? { orgUnit: { path: { startsWith: unit.path } } } : { id: { in: [] } });
    }
    const [org, rows, ccByCode, names] = await Promise.all([
      loadOrg(this.prisma, factoryId),
      this.prisma.employee.findMany({
        where: { AND: where },
        orderBy: { employeeCode: 'asc' },
        select: EMPLOYEE_FOR_MAPPING_SELECT,
      }),
      costCenterIdsByCode(this.prisma, factoryId),
      loadMasterNames(this.prisma, factoryId),
    ]);
    const described = describeEmployees(org, rows, ccByCode, names).filter(
      (e) =>
        (!f.floorId || e.floorId === f.floorId) &&
        (!f.canteenId || e.canteenId === f.canteenId) &&
        (!f.costCenterId || e.costCenterId === f.costCenterId) &&
        (!f.mealStatus || e.mealStatus === f.mealStatus),
    );
    return {
      total: described.length,
      items: described.slice(f.offset, f.offset + f.limit),
    };
  }

  /** BR-63: employee-level cost-center override (null clears it). Audited (BR-64, BR-70). */
  async setCostCenterOverride(
    actorId: string,
    factoryId: string,
    employeeCode: string,
    costCenterId: string | null,
    reason: string | undefined,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { employeeCode },
      include: { costCenterOverride: { select: { code: true } } },
    });
    if (!employee) throw notFound('Employee not found');
    let code: string | null = null;
    if (costCenterId) {
      const cc = await this.prisma.costCenter.findUnique({ where: { id: costCenterId } });
      if (!cc || cc.factoryId !== factoryId || !cc.active) {
        throw invalid('Unknown or inactive cost center', [{ path: 'costCenterId', message: 'x' }]);
      }
      code = cc.code;
    }
    if (employee.costCenterOverrideId === costCenterId) return { changed: false };
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: { costCenterOverrideId: costCenterId },
      });
      await this.audit.log(
        {
          actorId,
          action: 'employee.costCenterOverride.set',
          entityType: 'Employee',
          entityId: employee.id,
          before: { costCenterCode: employee.costCenterOverride?.code ?? null },
          after: { costCenterCode: code },
          reason,
        },
        tx,
      );
    });
    return { changed: true };
  }
}
