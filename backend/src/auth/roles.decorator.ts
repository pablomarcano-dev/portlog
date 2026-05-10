import { SetMetadata } from '@nestjs/common';
import { type Role } from '@portlog/schemas';

/**
 * ROLES_KEY is read by RolesGuard to enforce role-based access.
 * Usage: @Roles('ADM') or @Roles('OPS', 'ADM')
 *
 * Golden Rule 5: Authorization lives in the backend. This decorator
 * alone does nothing — RolesGuard (registered as a global guard) does
 * the enforcement.
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
