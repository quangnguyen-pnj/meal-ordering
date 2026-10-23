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
  Req,
} from '@nestjs/common';
import {
  DateStringSchema,
  DaySelectionSchema,
  ExtraMealSchema,
  GridDaySaveSchema,
  MyWeekSaveSchema,
  type DaySelection,
  type ExtraMeal,
  type GridDaySave,
  type MyWeekSave,
  upcomingWeekStart,
} from '@meal/shared';
import { z } from 'zod';
import { ClockService } from '../clock/clock.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentPrincipal, RequirePermission } from '../rbac/decorators';
import type { AuthedRequest, RequestPrincipal } from '../rbac/rbac.types';
import { AdminRegistrationsService } from './admin-registrations.service';
import { MyRegistrationsService } from './my-registrations.service';

const DateParam = new ZodValidationPipe(DateStringSchema);
const WeekQuerySchema = z.object({ weekStart: DateStringSchema.optional() });
const DayQuerySchema = z.object({ date: DateStringSchema.optional() });
const HistoryQuerySchema = z.object({
  from: DateStringSchema.optional(),
  to: DateStringSchema.optional(),
});
const SearchQuerySchema = z.object({ q: z.string().trim().max(64).optional() });
const AdminWeekQuerySchema = z.object({ weekStart: DateStringSchema });
const NotRegisteredQuerySchema = z.object({
  weekStart: DateStringSchema,
  date: DateStringSchema.optional(),
});
const GridQuerySchema = z.object({
  weekStart: DateStringSchema,
  canteenId: z.string().min(1).optional(),
});

const OWN = ['menu.registerOwn', { type: 'self' }] as const;

/** /week, /today, /history: the signed-in employee's own meals (BR-20 to BR-24). */
@Controller('registrations/me')
export class MyRegistrationsController {
  constructor(private readonly regs: MyRegistrationsService) {}

  @RequirePermission(...OWN)
  @Get('week')
  async week(
    @Query(new ZodValidationPipe(WeekQuerySchema)) q: z.infer<typeof WeekQuerySchema>,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.regs.week(p, q.weekStart ?? (await this.regs.defaultWeekStart(p)));
  }

  @RequirePermission(...OWN)
  @Put('week')
  saveWeek(
    @Body(new ZodValidationPipe(MyWeekSaveSchema)) body: MyWeekSave,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.regs.saveWeek(p, body);
  }

  @RequirePermission(...OWN)
  @Get('day')
  day(
    @Query(new ZodValidationPipe(DayQuerySchema)) q: z.infer<typeof DayQuerySchema>,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.regs.day(p, q.date);
  }

  @RequirePermission(...OWN)
  @Put('days/:date')
  saveDay(
    @Param('date', DateParam) date: string,
    @Body(new ZodValidationPipe(DaySelectionSchema)) body: DaySelection,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.regs.saveDay(p, date, body.lines);
  }

  @RequirePermission(...OWN)
  @Get('history')
  history(
    @Query(new ZodValidationPipe(HistoryQuerySchema)) q: z.infer<typeof HistoryQuerySchema>,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.regs.history(p, q.from, q.to);
  }
}

/** /team: colleagues' meals today (BR-27). Employees see their own meal unit only. */
@Controller('team')
export class TeamController {
  constructor(private readonly regs: MyRegistrationsService) {}

  /** The caller's own meal unit, which is always inside their OWN_UNIT grant. */
  @RequirePermission('team.view', { type: 'list' })
  @Get()
  own(
    @Query(new ZodValidationPipe(SearchQuerySchema)) q: z.infer<typeof SearchQuerySchema>,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.regs.team(p, null, q.q);
  }

  @RequirePermission('team.view', { type: 'orgUnitParam', param: 'orgUnitId' })
  @Get('units/:orgUnitId')
  unit(
    @Param('orgUnitId') orgUnitId: string,
    @Query(new ZodValidationPipe(SearchQuerySchema)) q: z.infer<typeof SearchQuerySchema>,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.regs.team(p, orgUnitId, q.q);
  }
}

const ON_BEHALF_UNIT = [
  'registration.onBehalf',
  { type: 'orgUnitParam', param: 'orgUnitId' },
] as const;

/** /admin/registrations and /admin/print (dept admins: their units; HC admins: the factory). */
@Controller('admin/registrations')
export class AdminRegistrationsController {
  constructor(
    private readonly admin: AdminRegistrationsService,
    private readonly clock: ClockService,
  ) {}

  @RequirePermission('registration.onBehalf', { type: 'list' })
  @Get('units')
  async units(@Req() req: AuthedRequest, @CurrentPrincipal() p: RequestPrincipal) {
    return {
      items: await this.admin.units(req.listScope ?? { kind: 'none' }, p.factoryId),
      // Screens default to the coming week by server time (fake time in dev and tests).
      upcomingWeekStart: upcomingWeekStart(this.clock.now()),
    };
  }

  @RequirePermission('registration.onBehalf', { type: 'list' })
  @Get('progress')
  progress(
    @Query(new ZodValidationPipe(AdminWeekQuerySchema)) q: z.infer<typeof AdminWeekQuerySchema>,
    @Req() req: AuthedRequest,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.admin.progress(req.listScope ?? { kind: 'none' }, p.factoryId, q.weekStart);
  }

  /** BR-21: who has not registered yet. */
  @RequirePermission('registration.notRegisteredList', { type: 'list' })
  @Get('not-registered')
  notRegistered(
    @Query(new ZodValidationPipe(NotRegisteredQuerySchema))
    q: z.infer<typeof NotRegisteredQuerySchema>,
    @Req() req: AuthedRequest,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.admin.notRegistered(
      req.listScope ?? { kind: 'none' },
      p.factoryId,
      q.weekStart,
      q.date ?? null,
    );
  }

  @RequirePermission(...ON_BEHALF_UNIT)
  @Get('units/:orgUnitId/grid')
  grid(
    @Param('orgUnitId') orgUnitId: string,
    @Query(new ZodValidationPipe(GridQuerySchema)) q: z.infer<typeof GridQuerySchema>,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.admin.grid(p.factoryId, orgUnitId, q.weekStart, q.canteenId);
  }

  @RequirePermission(...ON_BEHALF_UNIT)
  @Put('units/:orgUnitId/days/:date')
  saveGridDay(
    @Param('orgUnitId') orgUnitId: string,
    @Param('date', DateParam) date: string,
    @Body(new ZodValidationPipe(GridDaySaveSchema)) body: GridDaySave,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.admin.saveGridDay(p.employeeId, p.factoryId, orgUnitId, date, body);
  }

  /** BR-25: extra meals after the lock, with a reason. */
  @RequirePermission('registration.addExtra', { type: 'employeeParam', param: 'code' })
  @Post('employees/:code/extras')
  @HttpCode(HttpStatus.OK)
  addExtra(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(ExtraMealSchema)) body: ExtraMeal,
    @CurrentPrincipal() p: RequestPrincipal,
  ) {
    return this.admin.addExtra(p.employeeId, p.factoryId, code, body);
  }
}
