import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const perm = this.reflector.get<string>('required_permission', ctx.getHandler());
    if (!perm) return true;
    // ADM role does NOT automatically grant owner.financial — permissions and roles are orthogonal.
    const { user } = ctx.switchToHttp().getRequest<{ user: { permissions?: string[] } }>();
    return Array.isArray(user?.permissions) && user.permissions.includes(perm);
  }
}
