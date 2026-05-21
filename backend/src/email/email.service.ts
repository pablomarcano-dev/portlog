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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const smtpUser = this.config.get<string>('SMTP_USER');
    this.from = this.config.get<string>('SMTP_FROM', 'portlog@localhost');

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
  }
}
