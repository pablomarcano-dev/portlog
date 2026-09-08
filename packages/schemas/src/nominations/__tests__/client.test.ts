import {
  NominationClientCreateSchema,
  NominationClientUpdateSchema,
  normalizeNominationClientDirectoryLinks,
} from '../client';

const ENTITY_ID = 'cms2268fg00cspz6hc0dz4yac';

describe('NominationClientCreateSchema directory links', () => {
  it.each(['chartererId', 'ownerId', 'operatorId', 'shipperId'] as const)(
    'accepts a selected master-data record in %s',
    (idField) => {
      const result = NominationClientCreateSchema.parse({
        type: 'Directory party',
        name: 'Catalog Company',
        [idField]: ENTITY_ID,
      });

      expect(result[idField]).toBe(ENTITY_ID);
      expect(result.name).toBe('Catalog Company');
    },
  );

  it('keeps a manually entered legacy row valid without a directory link', () => {
    expect(
      NominationClientCreateSchema.parse({
        type: 'Receivers',
        name: 'Free-form receiver',
      }),
    ).toMatchObject({ type: 'Receivers', name: 'Free-form receiver' });
  });

  it('rejects malformed directory ids', () => {
    expect(
      NominationClientCreateSchema.safeParse({
        type: 'Charterer',
        name: 'Catalog Company',
        chartererId: 'not-an-id',
      }).success,
    ).toBe(false);
  });

  it('rejects more than one directory reference', () => {
    const result = NominationClientCreateSchema.safeParse({
      type: 'Charterer',
      name: 'Catalog Company',
      chartererId: ENTITY_ID,
      ownerId: 'cms2268fg00cspz6hc0dz4yad',
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ['Charterer', 'ownerId'],
    ['Disponent Owner', 'operatorId'],
    ['Commercial Operator', 'shipperId'],
    ['Shipper', 'chartererId'],
  ] as const)('rejects an incompatible %s → %s link', (type, idField) => {
    expect(
      NominationClientCreateSchema.safeParse({
        type,
        name: 'Catalog Company',
        [idField]: ENTITY_ID,
      }).success,
    ).toBe(false);
  });

  it('validates a partial update when type and link are supplied together', () => {
    expect(
      NominationClientUpdateSchema.safeParse({ type: 'Head Owner', shipperId: ENTITY_ID }).success,
    ).toBe(false);
  });
});

describe('normalizeNominationClientDirectoryLinks', () => {
  it('clears stale directory links when a compatible record is selected', () => {
    expect(
      normalizeNominationClientDirectoryLinks(
        { ownerId: ENTITY_ID },
        { type: 'Disponent Owner', chartererId: 'cms2268fg00cspz6hc0dz4yad' },
      ),
    ).toEqual({
      chartererId: null,
      ownerId: ENTITY_ID,
      operatorId: null,
      shipperId: null,
    });
  });

  it('clears an old link when a row changes to another known type', () => {
    expect(
      normalizeNominationClientDirectoryLinks(
        { type: 'Commercial Operator' },
        { type: 'Charterer', chartererId: ENTITY_ID },
      ),
    ).toEqual({
      type: 'Commercial Operator',
      chartererId: null,
      ownerId: null,
      shipperId: null,
    });
  });

  it('preserves an unknown legacy row during an unrelated update', () => {
    expect(
      normalizeNominationClientDirectoryLinks(
        { name: 'Updated legacy name' },
        {
          type: 'Receivers',
          chartererId: ENTITY_ID,
          ownerId: 'cms2268fg00cspz6hc0dz4yad',
        },
      ),
    ).toEqual({ name: 'Updated legacy name' });
  });
});
