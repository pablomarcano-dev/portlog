import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { type LoginResponse, type RefreshResponse, type CurrentUser } from '@portlog/schemas';
import { type JwtPayload } from './jwt.strategy.js';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';

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
  ) {}

  /**
   * Validates email + password. Returns the safe user record on success.
   * Returns null on failure (wrong email, wrong password, or inactive account).
   * Uniform behaviour: callers cannot distinguish which field was wrong.
   */
  async validateUser(email: string, password: string) {
    const record = await this.prisma.user.findUnique({
      where: { email },
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
  ): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const tokenHash = hashToken(raw);

    const ttlDays = parseInt(this.configService.get<string>('JWT_REFRESH_TTL_DAYS') ?? '30', 10);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ip: context.ip,
        userAgent: context.userAgent,
      },
    });

    return raw;
  }

  async login(email: string, password: string, ctx: LoginContext): Promise<LoginResult | null> {
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
      return null;
    }

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.issueAccessToken(payload);
    const rawRefreshToken = await this.issueRefreshToken(user.id, ctx);

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

    const loginResponse: LoginResponse = {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
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
      include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
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
      throw new UnauthorizedException('Refresh token reuse detected. Please log in again.');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired.');
    }

    if (!record.user.isActive) {
      throw new UnauthorizedException('Account is inactive.');
    }

    // Revoke the old token.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    // Issue new tokens.
    const payload: JwtPayload = {
      sub: record.user.id,
      email: record.user.email,
      role: record.user.role,
    };
    const accessToken = this.issueAccessToken(payload);
    const newRawRefreshToken = await this.issueRefreshToken(record.user.id, ctx);

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
  }

  async getCurrentUser(userId: string): Promise<CurrentUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
