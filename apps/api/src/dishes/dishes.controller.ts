import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  DessertInputSchema,
  DishInputSchema,
  type DessertInput,
  type DishInput,
} from '@meal/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentPrincipal, RequirePermission } from '../rbac/decorators';
import type { RequestPrincipal } from '../rbac/rbac.types';
import { DishesService } from './dishes.service';

const ListQuerySchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
type ListQuery = z.infer<typeof ListQuerySchema>;

const MANAGE = ['dishes.manage', { type: 'factory' }] as const;

/** /admin/dishes: main dishes and desserts (BR-10). HC admin only. */
@Controller('admin')
export class DishesController {
  constructor(private readonly dishes: DishesService) {}

  @RequirePermission(...MANAGE)
  @Get('dishes')
  async listDishes(
    @Query(new ZodValidationPipe(ListQuerySchema)) q: ListQuery,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return { items: await this.dishes.listDishes(p.factoryId, q.includeArchived) };
  }

  @RequirePermission(...MANAGE)
  @Post('dishes')
  createDish(
    @Body(new ZodValidationPipe(DishInputSchema)) body: DishInput,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.dishes.createDish(p.employeeId, p.factoryId, body);
  }

  @RequirePermission(...MANAGE)
  @Put('dishes/:id')
  updateDish(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DishInputSchema)) body: DishInput,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.dishes.updateDish(p.employeeId, p.factoryId, id, body);
  }

  @RequirePermission(...MANAGE)
  @Post('dishes/:id/archive')
  @HttpCode(HttpStatus.OK)
  archiveDish(@Param('id') id: string, @CurrentPrincipal() p: RequestPrincipal) {
    return this.dishes.setArchived('dish', p.employeeId, p.factoryId, id, true);
  }

  @RequirePermission(...MANAGE)
  @Post('dishes/:id/restore')
  @HttpCode(HttpStatus.OK)
  restoreDish(@Param('id') id: string, @CurrentPrincipal() p: RequestPrincipal) {
    return this.dishes.setArchived('dish', p.employeeId, p.factoryId, id, false);
  }

  @RequirePermission(...MANAGE)
  @Get('desserts')
  async listDesserts(
    @Query(new ZodValidationPipe(ListQuerySchema)) q: ListQuery,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return { items: await this.dishes.listDesserts(p.factoryId, q.includeArchived) };
  }

  @RequirePermission(...MANAGE)
  @Post('desserts')
  createDessert(
    @Body(new ZodValidationPipe(DessertInputSchema)) body: DessertInput,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.dishes.createDessert(p.employeeId, p.factoryId, body);
  }

  @RequirePermission(...MANAGE)
  @Put('desserts/:id')
  updateDessert(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DessertInputSchema)) body: DessertInput,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.dishes.updateDessert(p.employeeId, p.factoryId, id, body);
  }

  @RequirePermission(...MANAGE)
  @Post('desserts/:id/archive')
  @HttpCode(HttpStatus.OK)
  archiveDessert(@Param('id') id: string, @CurrentPrincipal() p: RequestPrincipal) {
    return this.dishes.setArchived('dessert', p.employeeId, p.factoryId, id, true);
  }

  @RequirePermission(...MANAGE)
  @Post('desserts/:id/restore')
  @HttpCode(HttpStatus.OK)
  restoreDessert(@Param('id') id: string, @CurrentPrincipal() p: RequestPrincipal) {
    return this.dishes.setArchived('dessert', p.employeeId, p.factoryId, id, false);
  }
}
