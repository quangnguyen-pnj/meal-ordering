import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { PinAuthService } from '../auth/pin-auth.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentPrincipal, RequirePermission } from '../rbac/decorators';
import type { AuthedRequest, RequestPrincipal } from '../rbac/rbac.types';
import { EmployeesService } from './employees.service';

const ListQuerySchema = z.object({
  q: z.string().trim().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const ResetPinBodySchema = z.object({ reason: z.string().trim().max(500).optional() }).default({});

@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly pinAuth: PinAuthService,
  ) {}

  /** Employee finder. Gated by the closest matrix row ("Reset PIN": units / factory / system). */
  @RequirePermission('pin.reset', { type: 'list' })
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListQuerySchema)) query: z.infer<typeof ListQuerySchema>,
    @Req() req: AuthedRequest,
  ) {
    const scope = req.listScope ?? { kind: 'none' as const };
    return { items: await this.employees.list(scope, query.q, query.limit) };
  }

  @RequirePermission('pin.reset', { type: 'employeeParam', param: 'code' })
  @Post(':code/pin/reset')
  @HttpCode(HttpStatus.OK)
  resetPin(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(ResetPinBodySchema)) body: z.infer<typeof ResetPinBodySchema>,
    @CurrentPrincipal() principal: RequestPrincipal,
  ) {
    return this.pinAuth.resetPin(principal.employeeId, code, body.reason);
  }
}
