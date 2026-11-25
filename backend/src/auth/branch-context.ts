import { ForbiddenException } from '@nestjs/common';
import { hasManagementAccess } from '@portlog/schemas';
import type { SafeUser } from '../users/users.service.js';

export function assignedBranchIds(user: SafeUser): string[] {
  return [
    ...new Set([
      ...(user.branchId ? [user.branchId] : []),
      ...(user.branchAssignments ?? []).map((a) => a.branchId),
    ]),
  ];
}

/** undefined means legacy/default context; null means national view. */
export function resolveBranchContext(user: SafeUser, requested?: string | null): string | null {
  const selected = requested === undefined ? user.branchId : requested;
  if (hasManagementAccess(user)) return selected ?? null;
  if (!selected || !assignedBranchIds(user).includes(selected)) {
    throw new ForbiddenException('An authorized branch assignment is required.');
  }
  return selected;
}
