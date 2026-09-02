import { describe, expect, it } from 'vitest';
import { getBranchAssignmentGuidance } from './branchAssignment';

describe('getBranchAssignmentGuidance', () => {
  it('directs administrators to user management', () => {
    expect(getBranchAssignmentGuidance('ADM')).toEqual({
      message:
        'Assign a default branch to your account in Admin → Users before creating a request.',
      canManageUsers: true,
    });
  });

  it('tells operations users who can resolve the blocker', () => {
    expect(getBranchAssignmentGuidance('OPS')).toEqual({
      message:
        'Ask an administrator to assign a default branch to your account before creating a request.',
      canManageUsers: false,
    });
  });
});
