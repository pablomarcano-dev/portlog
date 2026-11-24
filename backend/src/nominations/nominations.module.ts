import { SofSubjectActivitiesService } from './sof-subject-activities.service.js';
import { SofSubjectActivitiesController } from './sof-subject-activities.controller.js';
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
    SofSubjectActivitiesController,
    NominationsController,
    NominationFilesController,
    AdministrativeNominationBillingController,
    AdministrativeNominationInstructionsController,
  ],
  providers: [
    SofSubjectActivitiesService,
    NominationFilesService,
    NominationsService,
    NominationInstructionsDocxService,
    AdministrativeNominationBillingService,
    AdministrativeNominationInstructionsDocxService,
    AdministrativeNominationInstructionsService,
  ],
  exports: [NominationsService],
})
export class NominationsModule {}
