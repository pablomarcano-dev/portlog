import { ForbiddenException } from '@nestjs/common';
import { assignedBranchIds, resolveBranchContext } from './branch-context.js';
import type { SafeUser } from '../users/users.service.js';

const user = {
  id: 'agent',
  role: 'OPS',
  branchId: 'plc',
  branchAssignments: [{ branchId: 'mbo', branch: { id: 'mbo', name: 'Maracaibo', code: 'MBO' } }],
} as SafeUser;

describe('authorized branch context', () => {
  it('enters the primary branch directly and allows assigned branch switching', () => {
    expect(resolveBranchContext(user)).toBe('plc');
    expect(resolveBranchContext(user, 'mbo')).toBe('mbo');
    expect(assignedBranchIds(user)).toEqual(['plc', 'mbo']);
  });
  it('rejects another branch and national selection for an agent', () => {
    expect(() => resolveBranchContext(user, 'pbo')).toThrow(ForbiddenException);
    expect(() => resolveBranchContext(user, null)).toThrow(ForbiddenException);
    expect(() => resolveBranchContext({ ...user, branchId: null, branchAssignments: [] })).toThrow(
      ForbiddenException,
    );
  });
  it.each(['ADM', 'FLT'] as const)('allows national or selected context for %s', (role) => {
    expect(resolveBranchContext({ ...user, role }, null)).toBeNull();
    expect(resolveBranchContext({ ...user, role }, 'pbo')).toBe('pbo');
  });
  it('does not grant management rights from a job title', () => {
    expect(() => resolveBranchContext({ ...user, jobTitle: 'Fleet Manager' }, 'pbo')).toThrow(
      ForbiddenException,
    );
  });
});
