import { Module } from '@nestjs/common';
import { MeModule } from '../me/me.module';
import { OrgModule } from '../org/org.module';
import { JobsService } from './jobs.service';

@Module({ imports: [OrgModule, MeModule], providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
