import { Module } from '@nestjs/common';
import { ServiceRequestsController } from './service-requests.controller.js';
import { ServiceRequestsService } from './service-requests.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PdfModule } from '../pdf/pdf.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { EmailModule } from '../email/email.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { OperationalOrderDocxService } from './operational-order-docx.service.js';

@Module({
  imports: [PrismaModule, PdfModule, StorageModule, EmailModule, AttachmentsModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService, OperationalOrderDocxService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
