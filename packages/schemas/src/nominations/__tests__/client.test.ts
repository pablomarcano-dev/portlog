import {
  NominationClientCreateSchema,
  NominationClientUpdateSchema,
  normalizeNominationClientDirectoryLinks,
} from '../client';
const ID = 'cms2268fg00cspz6hc0dz4yac';
describe('unified nomination clients', () => {
  it.each(['Charterer', 'Shipper', 'Commercial Operator', 'Receivers', 'Head Owner'])(
    'accepts any Client for %s',
    (type) => {
      expect(
        NominationClientCreateSchema.parse({ type, name: 'Company', clientId: ID }).clientId,
      ).toBe(ID);
    },
  );
  it('supports manual names', () =>
    expect(
      NominationClientCreateSchema.parse({ type: 'Receivers', name: 'Manual' }).clientId,
    ).toBeUndefined());
  it('rejects two linked companies', () =>
    expect(
      NominationClientCreateSchema.safeParse({
        type: 'Shipper',
        name: 'A',
        clientId: ID,
        ownerId: ID,
      }).success,
    ).toBe(false));
  it('rejects malformed ids', () =>
    expect(NominationClientUpdateSchema.safeParse({ clientId: 'wrong' }).success).toBe(false));
  it('keeps identity on a role change', () =>
    expect(
      normalizeNominationClientDirectoryLinks(
        { type: 'Shipper' },
        { type: 'Charterer', clientId: ID },
      ),
    ).toEqual({ type: 'Shipper' }));
  it('switches an Owner selection to a Client atomically', () =>
    expect(normalizeNominationClientDirectoryLinks({ clientId: ID }, { ownerId: ID })).toEqual({
      clientId: ID,
      ownerId: null,
    }));
  it('switches a Client selection to an Owner atomically', () =>
    expect(normalizeNominationClientDirectoryLinks({ ownerId: ID }, { clientId: ID })).toEqual({
      ownerId: ID,
      clientId: null,
    }));
  it('checks merged partial state', () =>
    expect(() =>
      normalizeNominationClientDirectoryLinks({ type: 'Other' }, { clientId: ID, ownerId: ID }),
    ).toThrow());
  it('permits explicit unlink', () =>
    expect(normalizeNominationClientDirectoryLinks({ clientId: null }, { clientId: ID })).toEqual({
      clientId: null,
    }));
});
