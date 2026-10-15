import { EmailDeliveryService } from './email-delivery.service.js';
import { EmailSendInterceptor } from './email-send.interceptor.js';
import { Module } from '@nestjs/common';
import { EmailService } from './email.service.js';
import { TestEmailController } from './test-email.controller.js';

const isTestMode = process.env['NODE_ENV'] === 'test';

@Module({
  controllers: isTestMode ? [TestEmailController] : [],
  providers: [EmailService, EmailDeliveryService, EmailSendInterceptor],
  exports: [EmailService, EmailDeliveryService, EmailSendInterceptor],
})
export class EmailModule {}
