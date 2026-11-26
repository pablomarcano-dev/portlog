import {
  Injectable,
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { AuditEvent } from '@prisma/client';
import type { EmailCodeChallenge } from '@portlog/schemas';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { AuditService } from '../audit/audit.service.js';

type Purpose = 'login' | 'enable' | 'disable';
const TTL = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const invalid = () =>
  new UnauthorizedException('Invalid or expired code. Start again to request a new code.');

@Injectable()
export class EmailTwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private digest(id: string, code: string): string {
    const key = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!key) throw new ServiceUnavailableException('Email verification is unavailable.');
    return createHmac('sha256', key).update(`portlog:email-2fa:${id}:${code}`).digest('hex');
  }

  async issue(userId: string, purpose: Purpose): Promise<EmailCodeChallenge> {
    const now = new Date();
    const id = randomBytes(32).toString('hex');
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(now.getTime() + TTL);
    const codeHash = this.digest(id, code);
    const recipient = await this.prisma.$transaction(async (tx) => {
      // A database claim serializes sends per account across application instances.
      const claim = await tx.user.updateMany({
        where: {
          id: userId,
          isActive: true,
          OR: [
            { twoFactorLastSentAt: null },
            { twoFactorLastSentAt: { lt: new Date(now.getTime() - 60_000) } },
          ],
        },
        data: { twoFactorLastSentAt: now },
      });
      if (claim.count !== 1)
        throw new HttpException('Please wait a minute before requesting another code.', 429);
      const recent = await tx.emailTwoFactorChallenge.count({
        where: { userId, createdAt: { gt: new Date(now.getTime() - 15 * 60_000) } },
      });
      if (recent >= 5)
        throw new HttpException('Too many codes requested. Try again in 15 minutes.', 429);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (
        (purpose === 'login' && !user.twoFactorEnabled) ||
        (purpose === 'enable' && user.twoFactorEnabled) ||
        (purpose === 'disable' && !user.twoFactorEnabled)
      ) {
        throw new BadRequestException('Two-factor settings changed. Start again.');
      }
      await tx.emailTwoFactorChallenge.deleteMany({
        where: { expiresAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60_000) } },
      });
      // Reissuing invalidates older codes for this account and purpose.
      await tx.emailTwoFactorChallenge.updateMany({
        where: { userId, purpose, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.emailTwoFactorChallenge.create({
        data: {
          id,
          userId,
          purpose,
          codeHash,
          expiresAt,
          authVersion: user.authVersion,
          credentialHash: createHash('sha256').update(user.passwordHash).digest('hex'),
        },
      });
      return user.email;
    });
    try {
      await this.email.send({
        to: [recipient],
        subject: 'Portlog verification code',
        html: `<p>Your Portlog code to ${purpose === 'login' ? 'sign in' : `${purpose} email two-factor authentication`} is:</p><p><strong>${code}</strong></p><p>This code expires in 10 minutes and can be used once. If you did not request it, do not share it.</p>`,
      });
    } catch {
      await this.prisma.emailTwoFactorChallenge.updateMany({
        where: { id },
        data: { consumedAt: new Date() },
      });
      throw new ServiceUnavailableException(
        'The verification email could not be sent. Try again later.',
      );
    }
    const [local, domain] = recipient.split('@');
    return {
      twoFactorRequired: true,
      challengeId: id,
      maskedEmail: `${local?.slice(0, 1)}***@${domain}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async consume(id: string, code: string, purpose: Purpose, userId?: string) {
    const now = new Date();
    const record = await this.prisma.emailTwoFactorChallenge.findUnique({
      where: { id },
      include: { user: true },
    });
    if (
      !record ||
      record.purpose !== purpose ||
      (userId && record.userId !== userId) ||
      record.consumedAt ||
      record.expiresAt <= now ||
      record.attempts >= MAX_ATTEMPTS ||
      !record.user.isActive ||
      record.authVersion !== record.user.authVersion ||
      record.credentialHash !==
        createHash('sha256').update(record.user.passwordHash).digest('hex') ||
      (purpose === 'enable' ? record.user.twoFactorEnabled : !record.user.twoFactorEnabled)
    )
      throw invalid();

    const valid = timingSafeEqual(
      Buffer.from(record.codeHash, 'hex'),
      Buffer.from(this.digest(id, code), 'hex'),
    );
    if (!valid) {
      await this.prisma.emailTwoFactorChallenge.updateMany({
        where: { id, consumedAt: null, attempts: { lt: MAX_ATTEMPTS } },
        data: { attempts: { increment: 1 } },
      });
      void this.audit.record(AuditEvent.TWO_FACTOR_FAILURE, {
        userId: record.userId,
        metadata: { purpose },
      });
      throw invalid();
    }
    return this.prisma.$transaction(async (tx) => {
      // Recheck under a write lock: reset, disable, or deactivate races cannot redeem stale proof.
      const userClaim = await tx.user.updateMany({
        where: {
          id: record.userId,
          isActive: true,
          authVersion: record.authVersion,
          passwordHash: record.user.passwordHash,
          twoFactorEnabled: purpose !== 'enable',
        },
        data:
          purpose === 'login'
            ? { authVersion: record.authVersion }
            : {
                twoFactorEnabled: purpose === 'enable',
                authVersion: { increment: 1 },
                twoFactorLastSentAt: null,
              },
      });
      if (userClaim.count !== 1) throw invalid();
      const claimed = await tx.emailTwoFactorChallenge.updateMany({
        where: { id, consumedAt: null, attempts: record.attempts, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) throw invalid();
      if (purpose !== 'login') {
        await tx.refreshToken.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.emailTwoFactorChallenge.updateMany({
          where: { userId: record.userId, consumedAt: null },
          data: { consumedAt: now },
        });
      }
      return { userId: record.userId, authVersion: record.authVersion };
    });
  }
}
