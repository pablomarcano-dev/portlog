import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

export interface SentEmailRecord {
  to: string[];
  cc: string[];
  subject: string;
  html: string;
  attachmentFilenames: string[];
  sentAt: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly isTestMode: boolean;

  /**
   * In-memory store of sent emails — only populated when NODE_ENV=test.
   * Exposed via GET /api/test/__sent-emails for Cypress assertions.
   */
  readonly sentEmails: SentEmailRecord[] = [];

  constructor(private readonly config: ConfigService) {
    this.isTestMode = process.env['NODE_ENV'] === 'test';
    const smtpUser = this.config.get<string>('SMTP_USER');
    this.from = this.config.get<string>('SMTP_FROM', 'portlog@localhost');

    if (this.isTestMode) {
      // JSON transport: captures mail objects in memory without opening a socket.
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
    } else {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST', 'localhost'),
        port: this.config.get<number>('SMTP_PORT', 1025),
        secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
        ...(smtpUser
          ? {
              auth: {
                user: smtpUser,
                pass: this.config.get<string>('SMTP_PASSWORD', ''),
              },
            }
          : {}),
      });
    }
  }

  async send(opts: SendMailOptions): Promise<void> {
    const { to, cc, subject, html, attachments } = opts;

    this.logger.log({
      event: 'email.send',
      to,
      cc,
      subject,
    });

    await this.transporter.sendMail({
      from: this.from,
      to: to.join(', '),
      cc: cc?.join(', '),
      subject,
      html,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    if (this.isTestMode) {
      this.sentEmails.push({
        to,
        cc: cc ?? [],
        subject,
        html,
        attachmentFilenames: attachments?.map((a) => a.filename) ?? [],
        sentAt: new Date().toISOString(),
      });
    }
  }

  /** Clears the in-memory sent-emails store. Only useful in test mode. */
  clearSentEmails(): void {
    this.sentEmails.length = 0;
  }
}
