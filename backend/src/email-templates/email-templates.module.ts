import { Module } from '@nestjs/common';
import { EmailTemplateService } from './email-template.service.js';

@Module({
  providers: [EmailTemplateService],
  exports: [EmailTemplateService],
})
export class EmailTemplatesModule {}
