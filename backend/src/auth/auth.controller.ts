import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  VerifyEmailCodeSchema,
  TwoFactorChangeSchema,
  type VerifyEmailCode,
} from '@portlog/schemas';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './public.decorator.js';
import { type RequestUser } from './jwt.strategy.js';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_SECURE = process.env['COOKIE_SECURE'] !== 'false';

/**
 * Cookie-augmented Fastify types.
 * @fastify/cookie augments the global fastify module at runtime, but its
 * declare-module augmentation is not always picked up in strict nodenext
 * resolution depending on where the package resolves. We redeclare only the
 * properties we use to avoid relying on implicit module augmentation.
 */
type FastifyRequestWithCookies = FastifyRequest & {
  cookies: Record<string, string | undefined>;
};

type FastifyReplyWithCookies = FastifyReply & {
  setCookie(name: string, value: string, options?: object): FastifyReply;
  clearCookie(name: string, options?: object): FastifyReply;
};

/**
 * Cookie options for the refresh token.
 * SameSite=Lax: protects against CSRF for top-level navigations while allowing
 * cross-site GET requests (e.g., OAuth redirects). Sufficient for an internal app.
 * Secure is only set in production to avoid HTTPS requirements in local dev.
 */
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    // maxAge in seconds: 30 days
    maxAge: 30 * 24 * 60 * 60,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Rate-limited: 5 attempts per 15 minutes per IP (ttl is in milliseconds).
   * Returns LoginResponse body + sets refresh_token httpOnly cookie.
   * Uniform 401 on any failure — does not reveal whether email exists.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequestWithCookies,
    @Res({ passthrough: true }) reply: FastifyReplyWithCookies,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const result = await this.authService.login(dto.email, dto.password, {
      email: dto.email,
      ip,
      userAgent,
    });

    if (!result) {
      throw new UnauthorizedException('Invalid username, email or password.');
    }

    if ('challengeResponse' in result) {
      void reply.clearCookie(REFRESH_COOKIE, { path: '/' });
      return result.challengeResponse;
    }
    void reply.setCookie(REFRESH_COOKIE, result.rawRefreshToken, refreshCookieOptions());

    return result.loginResponse;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @Post('two-factor/verify')
  async verifyCode(
    @Body(new ZodValidationPipe(VerifyEmailCodeSchema)) body: VerifyEmailCode,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReplyWithCookies,
  ) {
    const result = await this.authService.verifyLoginCode(body.challengeId, body.code, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? 'unknown',
    });
    void reply.setCookie(REFRESH_COOKIE, result.rawRefreshToken, refreshCookieOptions());
    return result.loginResponse;
  }

  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @Post('two-factor/change')
  async requestTwoFactorChange(
    @Body(new ZodValidationPipe(TwoFactorChangeSchema))
    body: { password: string; enabled: boolean },
    @Req() req: FastifyRequest & { user: RequestUser },
  ) {
    return this.authService.requestTwoFactorChange(req.user.sub, body.password, body.enabled);
  }

  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @Post('two-factor/confirm')
  async confirmTwoFactorChange(
    @Body(new ZodValidationPipe(VerifyEmailCodeSchema.extend({ enabled: z.boolean() })))
    body: VerifyEmailCode & { enabled: boolean },
    @Req() req: FastifyRequest & { user: RequestUser },
    @Res({ passthrough: true }) reply: FastifyReplyWithCookies,
  ) {
    const result = await this.authService.confirmTwoFactorChange(
      req.user.sub,
      body.challengeId,
      body.code,
      body.enabled,
    );
    void reply.clearCookie(REFRESH_COOKIE, { path: '/' });
    return result;
  }

  /**
   * POST /api/auth/refresh
   * Reads the refresh_token cookie, rotates the token pair, returns new access token.
   * Returns 401 if cookie is missing, token is invalid, expired, or revoked.
   */
  @Public()
  // Unauthenticated and token-guessing surface, so it does not belong on the
  // global 60/min default. More generous than login because a legitimate client
  // refreshes on a timer and several tabs can refresh at once.
  @Throttle({ default: { limit: 20, ttl: 15 * 60 * 1000 } })
  @Post('refresh')
  async refresh(
    @Req() req: FastifyRequestWithCookies,
    @Res({ passthrough: true }) reply: FastifyReplyWithCookies,
  ) {
    const rawToken: string | undefined = req.cookies[REFRESH_COOKIE];

    if (!rawToken) {
      throw new UnauthorizedException('No refresh token provided.');
    }

    const ip = req.ip;
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const result = await this.authService.refresh(rawToken, { ip, userAgent });

    void reply.setCookie(REFRESH_COOKIE, result.rawRefreshToken, refreshCookieOptions());

    return result.refreshResponse;
  }

  /**
   * POST /api/auth/logout
   * Revokes the current refresh token and clears the cookie.
   * Returns 204 No Content.
   * Requires a valid access token (not @Public).
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: FastifyRequestWithCookies & { user: RequestUser },
    @Res({ passthrough: true }) reply: FastifyReplyWithCookies,
  ) {
    const rawToken: string | undefined = req.cookies[REFRESH_COOKIE];

    if (rawToken) {
      await this.authService.logout(req.user.sub, rawToken);
    }

    void reply.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax' as const,
      path: '/',
    });
  }

  @Post('branch')
  async switchBranch(
    @Body(new ZodValidationPipe(z.object({ branchId: z.string().cuid().nullable() }).strict()))
    body: { branchId: string | null },
    @Req() req: FastifyRequestWithCookies & { user: RequestUser },
    @Res({ passthrough: true }) reply: FastifyReplyWithCookies,
  ) {
    const rawToken = req.cookies[REFRESH_COOKIE];
    if (!rawToken) throw new UnauthorizedException('A valid session is required.');
    const result = await this.authService.switchBranch(req.user.sub, body.branchId, rawToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? 'unknown',
    });
    void reply.setCookie(REFRESH_COOKIE, result.rawRefreshToken, refreshCookieOptions());
    return result.loginResponse;
  }

  /**
   * GET /api/auth/me
   * Returns the current authenticated user's profile.
   * Requires a valid access token (not @Public).
   */
  @Get('me')
  async me(@Req() req: FastifyRequest & { user: RequestUser }) {
    return this.authService.getCurrentUser(req.user.sub, req.user.branchId);
  }
}
