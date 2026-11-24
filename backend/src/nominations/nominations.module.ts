import { DocxPreviewService } from './docx-preview.service.js';
import { NominationInstructionsPreviewController } from './nomination-instructions-preview.controller.js';
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
import { AdministrativeNominationBillingController } from './administrative-nomination-billing.controller.js';
import { AdministrativeNominationBillingService } from './administrative-nomination-billing.service.js';
import { AdministrativeNominationInstructionsController } from './administrative-nomination-instructions.controller.js';
import { AdministrativeNominationInstructionsDocxService } from './administrative-nomination-instructions-docx.service.js';
import { AdministrativeNominationInstructionsService } from './administrative-nomination-instructions.service.js';

@Module({
  imports: [PdfModule, PrismaModule, EmailModule, AttachmentsModule, EmailTemplatesModule],
  controllers: [
    NominationsController,
    NominationInstructionsPreviewController,
    NominationFilesController,
    AdministrativeNominationBillingController,
    AdministrativeNominationInstructionsController,
  ],
  providers: [
    NominationFilesService,
    NominationsService,
    DocxPreviewService,
    NominationInstructionsDocxService,
    AdministrativeNominationBillingService,
    AdministrativeNominationInstructionsDocxService,
    AdministrativeNominationInstructionsService,
  ],
  exports: [NominationsService],
})
export class NominationsModule {}
