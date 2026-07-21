import { Module } from '@nestjs/common';
import { SHDocumentsController } from './sh-documents.controller.js';
import { SHDocumentsService } from './sh-documents.service.js';
import { AllSentController } from './all-sent.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PdfModule } from '../pdf/pdf.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { EmailModule } from '../email/email.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';

@Module({
  imports: [PrismaModule, PdfModule, StorageModule, EmailModule, AttachmentsModule],
  controllers: [SHDocumentsController, AllSentController],
  providers: [SHDocumentsService],
  exports: [SHDocumentsService],
})
export class SHDocumentsModule {}
