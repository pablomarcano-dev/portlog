import { AgentCreateSchema, AgentListQuerySchema, AgentUpdateSchema } from '../agent';

const CUID = 'clbranch000000001';

describe('agent schemas', () => {
  it('normalises a cleared branch to null on update', () => {
    expect(AgentUpdateSchema.parse({ branchId: '' })).toEqual({ branchId: null });
    expect(AgentUpdateSchema.parse({ branchId: null })).toEqual({ branchId: null });
  });

  it('normalises a cleared mobile to null on update', () => {
    expect(AgentUpdateSchema.parse({ mobile: '' })).toEqual({ mobile: null });
    expect(AgentUpdateSchema.parse({ mobile: '   ' })).toEqual({ mobile: null });
    expect(AgentUpdateSchema.parse({ mobile: null })).toEqual({ mobile: null });
  });

  it('keeps an omitted mobile absent on update', () => {
    expect(AgentUpdateSchema.parse({})).not.toHaveProperty('mobile');
  });

  it('accepts branch and operational-role list filters', () => {
    expect(
      AgentListQuerySchema.parse({ branchId: CUID, operationalRole: 'SHIPPING_AGENT' }),
    ).toMatchObject({
      branchId: CUID,
      operationalRole: 'SHIPPING_AGENT',
      limit: 50,
    });
  });

  it('rejects invalid agent-list filters', () => {
    expect(AgentListQuerySchema.safeParse({ branchId: 'not-a-cuid' }).success).toBe(false);
    expect(AgentListQuerySchema.safeParse({ operationalRole: 'CAPTAIN' }).success).toBe(false);
  });

  it('allows an unassigned agent on create', () => {
    expect(AgentCreateSchema.parse({ name: 'Port Agent', branchId: '' })).toEqual({
      name: 'Port Agent',
      branchId: null,
    });
  });
});
