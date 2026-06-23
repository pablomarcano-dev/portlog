import { Module } from '@nestjs/common';
import { BranchDocumentsController } from './branch-documents.controller.js';
import { BranchDocumentsService } from './branch-documents.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PdfModule } from '../pdf/pdf.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [PrismaModule, PdfModule, StorageModule],
  controllers: [BranchDocumentsController],
  providers: [BranchDocumentsService],
  exports: [BranchDocumentsService],
})
export class BranchDocumentsModule {}
