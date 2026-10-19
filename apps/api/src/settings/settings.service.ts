import { Injectable, Logger } from '@nestjs/common';
import {
  defaultSettingValue,
  parseSettingValue,
  type SettingKey,
  type SettingValue,
} from '@meal/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Per-factory settings with the plan 6.4 defaults. Deadlines are never hardcoded (rule 3). */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get<K extends SettingKey>(factoryId: string, key: K): Promise<SettingValue<K>> {
    const row = await this.prisma.setting.findUnique({
      where: { factoryId_key: { factoryId, key } },
    });
    if (!row) return defaultSettingValue(key);
    try {
      return parseSettingValue(key, row.value);
    } catch {
      this.logger.warn(`Setting "${key}" of factory ${factoryId} is malformed; using the default`);
      return defaultSettingValue(key);
    }
  }
}
