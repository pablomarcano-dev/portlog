import { EmailGroupSchema } from '../email-group';
import { ClientCreateSchema, ClientUpdateSchema } from '../client';
import { ContactCreateSchema } from '../contact';
import { addressFor, formatPhones } from '../communication';
const ID = 'cms2268fg00cspz6hc0dz4yac';
describe('canonical Client and Contact fields', () => {
  it.each(['CLIENT', 'CHARTERER', 'SHIPPER', 'OPERATOR'])(
    'uses the same fields for %s',
    (entityType) => {
      const row = ClientCreateSchema.parse({
        name: ' Company ',
        entityType,
        instructions: ' Standing instructions ',
        notes: ' Internal ',
        phones: [
          { kind: 'BUSINESS', number: '+598 1' },
          { kind: 'BUSINESS', number: '+598 2' },
        ],
        emails: ['OPS@example.test', 'ops@example.test'],
      });
      expect(row.name).toBe('Company');
      expect(row.instructions).toBe('Standing instructions');
      expect(row.emails).toEqual(['ops@example.test']);
      expect(row.phones).toHaveLength(2);
    },
  );
  it('distinguishes omitted collections and explicit clearing', () => {
    expect(ClientUpdateSchema.parse({ name: 'Changed' })).not.toHaveProperty('phones');
    expect(ClientUpdateSchema.parse({ phones: [], instructions: '' })).toEqual({
      phones: [],
      instructions: null,
    });
  });
  it('rejects duplicate address purposes and unlabelled Other addresses', () => {
    expect(
      ClientCreateSchema.safeParse({
        name: 'A',
        addresses: [
          { purpose: 'BILLING', text: 'One' },
          { purpose: 'BILLING', text: 'Two' },
        ],
      }).success,
    ).toBe(false);
    expect(
      ContactCreateSchema.safeParse({ name: 'A', addresses: [{ purpose: 'OTHER', text: 'One' }] })
        .success,
    ).toBe(false);
  });
  it('does not accept legacy fields or child IDs', () => {
    expect(ClientCreateSchema.safeParse({ name: 'A', phone2: '1' }).success).toBe(false);
    expect(
      ClientUpdateSchema.safeParse({ phones: [{ id: ID, kind: 'MOBILE', number: '1' }] }).success,
    ).toBe(false);
    expect(ContactCreateSchema.safeParse({ name: 'A', operatorId: ID }).success).toBe(false);
  });
  it('enforces one group per slot while allowing one group in multiple slots', () => {
    expect(
      ClientCreateSchema.safeParse({
        name: 'A',
        emailGroups: [
          { slot: 'FIRST_MESSAGE', emailGroupId: ID },
          { slot: 'SECOND_MESSAGE', emailGroupId: ID },
        ],
      }).success,
    ).toBe(true);
    expect(
      ClientCreateSchema.safeParse({
        name: 'A',
        emailGroups: [
          { slot: 'FIRST_MESSAGE', emailGroupId: ID },
          { slot: 'FIRST_MESSAGE', emailGroupId: ID },
        ],
      }).success,
    ).toBe(false);
  });
  it('formats phones and selects addresses by purpose', () => {
    expect(formatPhones([{ kind: 'MOBILE', number: '123', sortOrder: 0 }])).toBe('mobile: 123');
    expect(
      addressFor([{ purpose: 'TAX', text: 'Tax office', sortOrder: 0 }], 'BILLING', 'TAX'),
    ).toBe('Tax office');
  });
});

describe('email group recipient resolution', () => {
  it('accepts persisted members with no display name', () => {
    const group = EmailGroupSchema.parse({
      id: 'group',
      name: 'First message',
      description: null,
      comments: null,
      members: [{ id: 'member', email: 'operations@example.test', displayName: null, order: 0 }],
      createdAt: '2026-09-10T00:00:00Z',
      updatedAt: '2026-09-10T00:00:00Z',
    });
    expect(group.members.map((member) => member.email)).toEqual(['operations@example.test']);
  });
});
