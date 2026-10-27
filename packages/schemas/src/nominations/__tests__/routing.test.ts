import { NominationUpdateSchema } from '../schemas';
import { NominationClientEmailContextSchema } from '../client';
describe('optional nomination routing contracts', () => {
  it('retains omission versus clearing and does not invent routing for existing nominations', () => {
    expect(NominationUpdateSchema.parse({ master: 'Existing Captain' })).not.toHaveProperty(
      'masterContactId',
    );
    const cleared = NominationUpdateSchema.parse({
      masterContactId: null,
      firstMessageGroupId: null,
      alwaysCopyGroupId: null,
    });
    expect(cleared).toEqual({
      masterContactId: null,
      firstMessageGroupId: null,
      alwaysCopyGroupId: null,
    });
    expect(
      NominationClientEmailContextSchema.parse({ clientIds: [], messageGroups: [] }).captainSource,
    ).toBe('none');
  });
  it('accepts contact/group IDs and rejects accidentally supplied email addresses', () => {
    expect(
      NominationUpdateSchema.safeParse({
        masterContactId: 'ccontactqa000000000000001',
        firstMessageGroupId: 'cgroupqa00000000000000001',
      }).success,
    ).toBe(true);
    expect(
      NominationUpdateSchema.safeParse({ masterContactId: 'captain@example.test' }).success,
    ).toBe(false);
    expect(
      NominationUpdateSchema.safeParse({ alwaysCopyGroupId: 'copy@example.test' }).success,
    ).toBe(false);
  });
});
