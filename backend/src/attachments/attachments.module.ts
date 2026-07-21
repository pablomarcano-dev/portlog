import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { AttachmentsCleanupCron } from './attachments-cleanup.cron.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [AttachmentsController],
  // ScheduleModule.forRoot() is initialised app-wide (dispatch module); the
  // @Cron in AttachmentsCleanupCron is discovered globally, no re-forRoot here.
  providers: [AttachmentsService, AttachmentsCleanupCron],
  // Exported so dispatch/sh-documents/nominations can resolve + link attachments at send time.
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
