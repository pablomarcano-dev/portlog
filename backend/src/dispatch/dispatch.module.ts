import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DispatchController } from './dispatch.controller.js';
import { DispatchService } from './dispatch.service.js';
import { EtaAlertCron } from './eta-alert.cron.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EmailModule } from '../email/email.module.js';
import { PdfModule } from '../pdf/pdf.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    EmailModule,
    PdfModule,
    StorageModule,
    AttachmentsModule,
  ],
  controllers: [DispatchController],
  providers: [DispatchService, EtaAlertCron],
  exports: [DispatchService],
})
export class DispatchModule {}
