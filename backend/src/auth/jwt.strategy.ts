import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { type Role } from '@portlog/schemas';

/**
 * JWT payload shape stored in access tokens.
 * sub: user CUID, email: lowercased, role: OPS | ADM, permissions: string[].
 */
export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  permissions: string[];
};

/**
 * The validated user object attached to request.user after JwtAuthGuard passes.
 * This is what controllers and RolesGuard read from.
 */
export type RequestUser = JwtPayload;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET env var is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      // Pin the accepted algorithm rather than trusting the token's own header.
      // Not exploitable today — the secret is symmetric, so jsonwebtoken already
      // restricts verification to the HS family and rejects alg: none — but that
      // protection is incidental. The day this moves to an asymmetric key it
      // disappears silently, and RS256-to-HS256 confusion becomes live.
      algorithms: ['HS256'],
    });
  }

  /**
   * Called after JWT signature is verified. Return value becomes request.user.
   * We return the payload as-is since it already contains the fields we need.
   */
  validate(payload: JwtPayload): RequestUser {
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions ?? [],
    };
  }
}
