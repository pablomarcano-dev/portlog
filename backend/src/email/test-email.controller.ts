import { Controller, Delete, Get, HttpCode } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { EmailService } from './email.service.js';

/**
 * Test-only controller — exposes the in-memory sent-emails store for Cypress assertions.
 * This controller is only registered when NODE_ENV=test (see TestEmailModule).
 *
 * Endpoints:
 *   GET  /api/test/__sent-emails  — returns the list of captured sent emails
 *   DELETE /api/test/__sent-emails — clears the list
 */
@Controller('test/__sent-emails')
@Public()
export class TestEmailController {
  constructor(private readonly email: EmailService) {}

  @Get()
  getSentEmails() {
    return this.email.sentEmails;
  }

  @Delete()
  @HttpCode(204)
  clearSentEmails() {
    this.email.clearSentEmails();
  }
}
