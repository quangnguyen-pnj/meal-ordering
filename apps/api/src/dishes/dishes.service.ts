import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  mealDisplayName,
  type DessertInput,
  type DessertView,
  type DishInput,
  type DishView,
} from '@meal/shared';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../clock/clock.service';
import { notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

type Library = 'dish' | 'dessert';

/**
 * BR-10: main-dish and dessert libraries, reused across weeks. Retired entries are archived and
 * can be restored; they are never deleted. Archived entries cannot be put on a new menu.
 */
@Injectable()
export class DishesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  async listDishes(factoryId: string, includeArchived: boolean): Promise<DishView[]> {
    const rows = await this.prisma.dish.findMany({
      where: { factoryId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toDishView);
  }

  async listDesserts(factoryId: string, includeArchived: boolean): Promise<DessertView[]> {
    const rows = await this.prisma.dessert.findMany({
      where: { factoryId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      archivedAt: r.archivedAt?.toISOString() ?? null,
    }));
  }

  async createDish(actorId: string, factoryId: string, input: DishInput): Promise<DishView> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.dish.create({ data: { factoryId, ...input } });
      await this.audit.log(
        { actorId, action: 'dish.created', entityType: 'Dish', entityId: row.id, after: input },
        tx,
      );
      return toDishView(row);
    });
  }

  async updateDish(
    actorId: string,
    factoryId: string,
    id: string,
    input: DishInput,
  ): Promise<DishView> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.dish.findUnique({ where: { id } });
      if (!current || current.factoryId !== factoryId) throw notFound('Dish not found');
      const row = await tx.dish.update({ where: { id }, data: input });
      await this.audit.log(
        {
          actorId,
          action: 'dish.updated',
          entityType: 'Dish',
          entityId: id,
          before: { name: current.name, type: current.type, sessions: current.sessions },
          after: input,
        },
        tx,
      );
      return toDishView(row);
    });
  }

  async createDessert(
    actorId: string,
    factoryId: string,
    input: DessertInput,
  ): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.dessert.create({ data: { factoryId, ...input } });
      await this.audit.log(
        {
          actorId,
          action: 'dessert.created',
          entityType: 'Dessert',
          entityId: row.id,
          after: input,
        },
        tx,
      );
      return { id: row.id };
    });
  }

  async updateDessert(actorId: string, factoryId: string, id: string, input: DessertInput) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.dessert.findUnique({ where: { id } });
      if (!current || current.factoryId !== factoryId) throw notFound('Dessert not found');
      await tx.dessert.update({ where: { id }, data: input });
      await this.audit.log(
        {
          actorId,
          action: 'dessert.updated',
          entityType: 'Dessert',
          entityId: id,
          before: { name: current.name },
          after: input,
        },
        tx,
      );
      return { id };
    });
  }

  /** Archive (`archived = true`) or restore. Menus already built keep the entry. */
  async setArchived(
    library: Library,
    actorId: string,
    factoryId: string,
    id: string,
    archived: boolean,
  ): Promise<{ id: string; archivedAt: string | null }> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current =
        library === 'dish'
          ? await tx.dish.findUnique({ where: { id } })
          : await tx.dessert.findUnique({ where: { id } });
      if (!current || current.factoryId !== factoryId) throw notFound();
      if ((current.archivedAt !== null) === archived) {
        return { id, archivedAt: current.archivedAt?.toISOString() ?? null };
      }
      const archivedAt = archived ? this.clock.now() : null;
      if (library === 'dish') await tx.dish.update({ where: { id }, data: { archivedAt } });
      else await tx.dessert.update({ where: { id }, data: { archivedAt } });
      await this.audit.log(
        {
          actorId,
          action: `${library}.${archived ? 'archived' : 'restored'}`,
          entityType: library === 'dish' ? 'Dish' : 'Dessert',
          entityId: id,
        },
        tx,
      );
      return { id, archivedAt: archivedAt?.toISOString() ?? null };
    });
  }
}

export function toDishView(row: {
  id: string;
  name: string;
  type: DishView['type'];
  sessions: DishView['sessions'];
  archivedAt: Date | null;
}): DishView {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    sessions: row.sessions,
    displayName: mealDisplayName(row.type, row.name),
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}
