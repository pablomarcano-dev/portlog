import { PdfModule } from '../pdf/pdf.module.js';
import { NominationFilesService } from './nomination-files.service.js';
import { NominationFilesController } from './nomination-files.controller.js';
import { Module } from '@nestjs/common';
import { NominationsController } from './nominations.controller.js';
import { NominationsService } from './nominations.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EmailModule } from '../email/email.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { EmailTemplatesModule } from '../email-templates/email-templates.module.js';
import { NominationInstructionsDocxService } from './nomination-instructions-docx.service.js';

@Module({
  imports: [PdfModule, PrismaModule, EmailModule, AttachmentsModule, EmailTemplatesModule],
  controllers: [NominationsController, NominationFilesController],
  providers: [NominationFilesService, NominationsService, NominationInstructionsDocxService],
  exports: [NominationsService],
})
export class NominationsModule {}
