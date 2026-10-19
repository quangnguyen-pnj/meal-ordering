import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ListScope } from '@meal/shared';
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

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: ListScope, q: string | undefined, limit: number) {
    const search: Prisma.EmployeeWhereInput = q
      ? {
          OR: [
            { employeeCode: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    const rows = await this.prisma.employee.findMany({
      where: { AND: [employeeScopeWhere(scope), search] },
      orderBy: { employeeCode: 'asc' },
      take: limit,
      select: {
        employeeCode: true,
        name: true,
        status: true,
        orgUnit: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => ({
      employeeCode: r.employeeCode,
      name: r.name,
      status: r.status,
      orgUnitId: r.orgUnit.id,
      orgUnitName: r.orgUnit.name,
    }));
  }
}
