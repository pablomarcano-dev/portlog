import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  type LoginResponse,
  type RefreshResponse,
  type CurrentUser,
  hasManagementAccess,
} from '@portlog/schemas';
import { type JwtPayload } from './jwt.strategy.js';
import { AuditEvent } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';
import { resolveBranchContext } from './branch-context.js';
import { EmailTwoFactorService } from './email-two-factor.service.js';
import type { EmailCodeChallenge } from '@portlog/schemas';
import type { SafeUser } from '../users/users.service.js';

type LoginContext = {
  email: string;
  ip: string;
  userAgent: string;
};

type LoginResult = {
  loginResponse: LoginResponse;
  rawRefreshToken: string;
};

type RefreshResult = {
  refreshResponse: RefreshResponse;
  rawRefreshToken: string;
};

/**
 * Hashes a raw refresh token with SHA-256 for storage in the DB.
 * The raw token is only ever sent to the client via httpOnly cookie.
 */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly twoFactor: EmailTwoFactorService,
  ) {}

  /**
   * Validates email + password. Returns the safe user record on success.
   * Returns null on failure (wrong email, wrong password, or inactive account).
   * Uniform behaviour: callers cannot distinguish which field was wrong.
   */
  async validateUser(email: string, password: string) {
    const record = await this.prisma.user.findUnique({
      where: email.includes('@') ? { email } : { username: email },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (!record || !record.isActive) {
      // Still compare a dummy hash to prevent timing attacks.
      await bcrypt.compare(password, '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      return null;
    }

    const valid = await bcrypt.compare(password, record.passwordHash);
    if (!valid) return null;

    return this.usersService.findById(record.id);
  }

  issueAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  /**
   * Issues a new refresh token record in the DB.
   * Returns the raw token (to be set as httpOnly cookie) — never stored raw.
   */
  async issueRefreshToken(
    userId: string,
    context: { ip: string; userAgent: string },
    branchId: string | null = null,
    authVersion = 0,
  ): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const tokenHash = hashToken(raw);

    const ttlDays = parseInt(this.configService.get<string>('JWT_REFRESH_TTL_DAYS') ?? '30', 10);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        branchId,
        authVersion,
        tokenHash,
        expiresAt,
        ip: context.ip,
        userAgent: context.userAgent,
      },
    });

    return raw;
  }

  async login(
    email: string,
    password: string,
    ctx: LoginContext,
  ): Promise<
    | LoginResult
    | { challengeResponse: EmailCodeChallenge; loginResponse?: never; rawRefreshToken?: never }
    | null
  > {
    const user = await this.validateUser(email, password);

    if (!user) {
      // Golden Rule 8: log failure without leaking which field was wrong
      this.logger.log({
        event: 'auth.login',
        email,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        success: false,
      });
      void this.auditService.record(AuditEvent.LOGIN_FAILURE, {
        email,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return null;
    }

    if (user.twoFactorEnabled) {
      return { challengeResponse: await this.twoFactor.issue(user.id, 'login') };
    }
    return this.completeLogin(user, ctx);
  }

  private async completeLogin(user: SafeUser, ctx: LoginContext): Promise<LoginResult> {
    const email = user.email;
    const branchId = resolveBranchContext(user);
    const payload: JwtPayload = {
      branchId,
      sub: user.id,
      authVersion: user.authVersion ?? 0,
      email: user.email,
      role: user.role,
      permissions: user.permissions ?? [],
    };
    const accessToken = this.issueAccessToken(payload);
    const rawRefreshToken = await this.issueRefreshToken(
      user.id,
      ctx,
      branchId,
      user.authVersion ?? 0,
    );

    // Update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log({
      event: 'auth.login',
      userId: user.id,
      email,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      success: true,
    });
    void this.auditService.record(AuditEvent.LOGIN_SUCCESS, {
      userId: user.id,
      email,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const loginResponse: LoginResponse = {
      accessToken,
      user: await this.currentUserResponse(user, branchId),
    };

    return { loginResponse, rawRefreshToken };
  }

  /**
   * Refresh-token rotation:
   * 1. Look up the token hash in DB.
   * 2. If not found or revoked: if the tokenHash exists but is revoked, this is
   *    a reuse attempt — revoke the entire user's refresh session (all tokens).
   * 3. If expired: reject with 401.
   * 4. Otherwise: revoke old token, issue new access + refresh tokens.
   */
  async refresh(rawToken: string, ctx: { ip: string; userAgent: string }): Promise<RefreshResult> {
    const tokenHash = hashToken(rawToken);

    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true, permissions: true } },
      },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    // Reuse detection: token was already revoked — revoke the entire user session.
    if (record.revokedAt !== null) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      void this.auditService.record(AuditEvent.REFRESH_TOKEN_REUSE, {
        userId: record.userId,
        email: record.user.email,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Refresh token reuse detected. Please log in again.');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired.');
    }

    if (!record.user.isActive) {
      throw new UnauthorizedException('Account is inactive.');
    }

    const current = await this.usersService.findById(record.userId);
    if (!current || !current.isActive) throw new UnauthorizedException('Account is inactive.');
    if ((record.authVersion ?? 0) !== (current.authVersion ?? 0))
      throw new UnauthorizedException('Please sign in again.');
    const branchId = resolveBranchContext(current, record.branchId);

    // Revoke the old token.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    // Issue new tokens.
    const payload: JwtPayload = {
      sub: current.id,
      authVersion: current.authVersion ?? 0,
      email: current.email,
      role: current.role,
      permissions: current.permissions ?? [],
      branchId,
    };
    const accessToken = this.issueAccessToken(payload);
    const newRawRefreshToken = await this.issueRefreshToken(
      record.user.id,
      ctx,
      branchId,
      current.authVersion ?? 0,
    );

    this.logger.log({
      event: 'auth.refresh',
      userId: record.user.id,
      email: record.user.email,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return {
      refreshResponse: { accessToken },
      rawRefreshToken: newRawRefreshToken,
    };
  }

  async verifyLoginCode(
    challengeId: string,
    code: string,
    ctx: { ip: string; userAgent: string },
  ): Promise<LoginResult> {
    const proof = await this.twoFactor.consume(challengeId, code, 'login');
    const user = await this.usersService.findById(proof.userId);
    if (!user || !user.isActive || !user.twoFactorEnabled || user.authVersion !== proof.authVersion)
      throw new UnauthorizedException('Please sign in again.');
    return this.completeLogin(user, { ...ctx, email: user.email });
  }

  async requestTwoFactorChange(userId: string, password: string, enabled: boolean) {
    const record = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, isActive: true },
    });
    if (!record?.isActive || !(await bcrypt.compare(password, record.passwordHash)))
      throw new UnauthorizedException('Invalid password.');
    return this.twoFactor.issue(userId, enabled ? 'enable' : 'disable');
  }

  async confirmTwoFactorChange(
    userId: string,
    challengeId: string,
    code: string,
    enabled: boolean,
  ) {
    await this.twoFactor.consume(challengeId, code, enabled ? 'enable' : 'disable', userId);
    await this.auditService.record(
      enabled ? AuditEvent.TWO_FACTOR_ENABLED : AuditEvent.TWO_FACTOR_DISABLED,
      { userId },
    );
    return { twoFactorEnabled: enabled };
  }

  async logout(userId: string, rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    // Revoke only the specific token (not the whole session — user may have other devices).
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log({
      event: 'auth.logout',
      userId,
    });
    void this.auditService.record(AuditEvent.LOGOUT, { userId });
  }

  async getCurrentUser(userId: string, selectedBranchId?: string | null): Promise<CurrentUser> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) throw new UnauthorizedException('User not found.');
    return this.currentUserResponse(user, resolveBranchContext(user, selectedBranchId));
  }

  private async currentUserResponse(user: SafeUser, branchId: string | null): Promise<CurrentUser> {
    const branches = hasManagementAccess(user)
      ? await this.prisma.branch.findMany({
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
        })
      : [
          ...new Map(
            [
              ...(user.branch ? [user.branch] : []),
              ...(user.branchAssignments ?? []).map((a) => a.branch),
            ].map((b) => [b.id, b]),
          ).values(),
        ];
    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      role: user.role,
      operationalRole: user.operationalRole,
      isActive: user.isActive,
      permissions: user.permissions ?? [],
      branchId,
      branchCode: branches.find((b) => b.id === branchId)?.code ?? null,
      primaryBranchId: user.branchId,
      branches,
    };
  }

  async switchBranch(
    userId: string,
    requested: string | null,
    rawToken: string,
    ctx: { ip: string; userAgent: string },
  ): Promise<LoginResult> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!record || record.userId !== userId || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('A valid session is required.');
    }
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive || (record.authVersion ?? 0) !== (user.authVersion ?? 0))
      throw new UnauthorizedException('Please sign in again.');
    const branchId = resolveBranchContext(user, requested);
    if (
      branchId &&
      !(await this.prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } }))
    ) {
      throw new UnauthorizedException('Branch is unavailable.');
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    const accessToken = this.issueAccessToken({
      sub: user.id,
      authVersion: user.authVersion ?? 0,
      email: user.email,
      role: user.role,
      permissions: user.permissions ?? [],
      branchId,
    });
    return {
      loginResponse: { accessToken, user: await this.currentUserResponse(user, branchId) },
      rawRefreshToken: await this.issueRefreshToken(user.id, ctx, branchId, user.authVersion ?? 0),
    };
  }
}
