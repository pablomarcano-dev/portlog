import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Role } from '@portlog/schemas';
import { ROLES_KEY } from './roles.decorator.js';
import { type RequestUser } from './jwt.strategy.js';

/**
 * Global roles guard.
 * If a route has no @Roles() decorator, access is granted to any authenticated user.
 * If @Roles('ADM') is present, only users with role ADM may proceed (403 otherwise).
 *
 * Golden Rule 5: This guard is the sole enforcement point for role-based access.
 * Frontend role-checks are UI-only and must never be trusted.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator — any authenticated user is allowed.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    return true;
  }
}
