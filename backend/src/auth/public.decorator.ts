import { SetMetadata } from '@nestjs/common';

/**
 * IS_PUBLIC_KEY is checked by JwtAuthGuard to bypass JWT validation.
 * Apply @Public() to any route that must be reachable without an access token
 * (e.g., login, refresh, health checks).
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
