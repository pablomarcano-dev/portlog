import { Module } from '@nestjs/common';
import { SHDocumentsController } from './sh-documents.controller.js';
import { SHDocumentsService } from './sh-documents.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PdfModule } from '../pdf/pdf.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [PrismaModule, PdfModule, StorageModule],
  controllers: [SHDocumentsController],
  providers: [SHDocumentsService],
  exports: [SHDocumentsService],
})
export class SHDocumentsModule {}
