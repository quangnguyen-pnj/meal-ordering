import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../rbac/decorators';

@Controller('system')
export class SystemController {
  constructor(private readonly prisma: PrismaService) {}

  /** Sync logs: HC admin (factory) and system admin only (plan section 3). */
  @RequirePermission('sync.manage', { type: 'factory' })
  @Get('sync-runs')
  async syncRuns() {
    const items = await this.prisma.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 50 });
    return { items };
  }
}
