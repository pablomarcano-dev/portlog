import { PortCreateSchema, PortUpdateSchema } from '../port';

const BRANCH_ID = 'clzzzzzzzzzzzzzzzzzzzzzzz';

describe('optional port branch', () => {
  it('creates an unassigned port when branch is omitted', () => {
    expect(PortCreateSchema.parse({ name: 'Montevideo' })).not.toHaveProperty('branchId');
  });

  it.each([null, '', '   '])('accepts an explicitly unassigned branch: %s', (branchId) => {
    expect(PortCreateSchema.parse({ name: 'Montevideo', branchId }).branchId).toBeNull();
  });

  it('retains an assigned branch', () => {
    expect(PortCreateSchema.parse({ name: 'Montevideo', branchId: BRANCH_ID }).branchId).toBe(
      BRANCH_ID,
    );
  });

  it('rejects a nonempty invalid branch ID', () => {
    expect(PortCreateSchema.safeParse({ name: 'Montevideo', branchId: 'wrong-id' }).success).toBe(
      false,
    );
  });

  it('does not clear a stored branch when a partial update omits it', () => {
    expect(PortUpdateSchema.parse({ name: 'New name' })).not.toHaveProperty('branchId');
  });

  it('preserves explicit clearing in the serialized update payload', () => {
    expect(JSON.parse(JSON.stringify(PortUpdateSchema.parse({ branchId: '' })))).toEqual({
      branchId: null,
    });
  });
});
