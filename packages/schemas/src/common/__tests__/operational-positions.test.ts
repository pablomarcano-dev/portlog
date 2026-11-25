import { CreateUserSchema, UpdateUserSchema } from '../../admin';
import { CurrentUserSchema, hasManagementAccess } from '../../auth';
import { AgentCreateSchema } from '../../master-data/agent';
import { OPERATIONAL_POSITION_OPTIONS } from '../operational-positions';

describe('descriptive operational positions', () => {
  it.each(OPERATIONAL_POSITION_OPTIONS)(
    'supports $value without granting management access',
    ({ value }) => {
      expect(
        CreateUserSchema.parse({
          email: 'person@example.test',
          password: 'long-enough',
          role: 'OPS',
          operationalRole: value,
        }).operationalRole,
      ).toBe(value);
      expect(UpdateUserSchema.parse({ operationalRole: value })).not.toHaveProperty('role');
      expect(
        AgentCreateSchema.parse({ name: 'Person', operationalRole: value }).operationalRole,
      ).toBe(value);
      const user = CurrentUserSchema.parse({
        id: 'person',
        email: 'person@example.test',
        role: 'OPS',
        operationalRole: value,
        isActive: true,
      });
      expect(hasManagementAccess(user)).toBe(false);
    },
  );
  it('requires the explicit access role for Fleet Manager privileges', () => {
    expect(hasManagementAccess({ role: 'FLT' })).toBe(true);
    expect(hasManagementAccess({ role: 'ADM' })).toBe(true);
    expect(hasManagementAccess(null)).toBe(false);
  });
});
