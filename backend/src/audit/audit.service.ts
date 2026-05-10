import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuditContext = {
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an audit event. INSERT-only — no update or delete.
   *
   * If the write fails, the error is logged at `error` level but NOT re-thrown.
   * Auth must remain available even if audit storage is unavailable.
   */
  async record(event: AuditEvent, ctx: AuditContext = {}): Promise<void> {
    const { userId, email, ip, userAgent, metadata } = ctx;
    try {
      await this.prisma.auditLog.create({
        data: {
          event,
          userId: userId ?? null,
          email: email ?? null,
          ip: ip ?? null,
          userAgent: userAgent ?? null,
          metadata: metadata ?? Prisma.JsonNull,
        },
      });
    } catch (err) {
      this.logger.error({ err, event, userId, email }, 'audit.record failed — audit drop');
    }
  }
}
