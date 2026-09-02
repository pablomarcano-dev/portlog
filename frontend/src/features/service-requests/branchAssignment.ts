import type { Role } from '@portlog/schemas';

export interface BranchAssignmentGuidance {
  message: string;
  canManageUsers: boolean;
}

/** Copy and available action shown wherever service-request creation is gated. */
export function getBranchAssignmentGuidance(role: Role): BranchAssignmentGuidance {
  if (role === 'ADM') {
    return {
      message:
        'Assign a default branch to your account in Admin → Users before creating a request.',
      canManageUsers: true,
    };
  }

  return {
    message:
      'Ask an administrator to assign a default branch to your account before creating a request.',
    canManageUsers: false,
  };
}
