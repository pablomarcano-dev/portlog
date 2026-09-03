import { Module } from '@nestjs/common';
import { NominationsController } from './nominations.controller.js';
import { NominationsService } from './nominations.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EmailModule } from '../email/email.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { EmailTemplatesModule } from '../email-templates/email-templates.module.js';
import { NominationInstructionsDocxService } from './nomination-instructions-docx.service.js';

@Module({
  imports: [PrismaModule, EmailModule, AttachmentsModule, EmailTemplatesModule],
  controllers: [NominationsController],
  providers: [NominationsService, NominationInstructionsDocxService],
  exports: [NominationsService],
})
export class NominationsModule {}
