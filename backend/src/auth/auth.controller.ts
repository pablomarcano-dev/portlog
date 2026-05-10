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
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './public.decorator.js';
import { type RequestUser } from './jwt.strategy.js';

const REFRESH_COOKIE = 'refresh_token';

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
function refreshCookieOptions(isProd: boolean) {
  return {
    httpOnly: true,
    secure: isProd,
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
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isProd = process.env['NODE_ENV'] === 'production';
    void reply.setCookie(REFRESH_COOKIE, result.rawRefreshToken, refreshCookieOptions(isProd));

    return result.loginResponse;
  }

  /**
   * POST /api/auth/refresh
   * Reads the refresh_token cookie, rotates the token pair, returns new access token.
   * Returns 401 if cookie is missing, token is invalid, expired, or revoked.
   */
  @Public()
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

    const isProd = process.env['NODE_ENV'] === 'production';
    void reply.setCookie(REFRESH_COOKIE, result.rawRefreshToken, refreshCookieOptions(isProd));

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

    const isProd = process.env['NODE_ENV'] === 'production';
    void reply.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
    });
  }

  /**
   * GET /api/auth/me
   * Returns the current authenticated user's profile.
   * Requires a valid access token (not @Public).
   */
  @Get('me')
  async me(@Req() req: FastifyRequest & { user: RequestUser }) {
    return this.authService.getCurrentUser(req.user.sub);
  }
}
