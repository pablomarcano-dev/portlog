import { Module } from '@nestjs/common';
import { EmailService } from './email.service.js';
import { TestEmailController } from './test-email.controller.js';

const isTestMode = process.env['NODE_ENV'] === 'test';

@Module({
  controllers: isTestMode ? [TestEmailController] : [],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
