import { NominationCreateSchema, NominationUpdateSchema } from '../schemas.js';
import { formatVesselVoyageNumber } from '../vessel-voyage.js';

const create = {
  shipParticularId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
  branchId: 'clyyyyyyyyyyyyyyyyyyyyyyyy',
  dateNominated: '2026-11-24T00:00:00.000Z',
  voyageNumber: '21',
};

describe('explicit vessel VOY', () => {
  it('keeps the vessel voyage independent of the internal identifier', () => {
    const parsed = NominationCreateSchema.parse({ ...create, vesselVoyageNumber: ' 005-26 ' });
    expect(parsed.vesselVoyageNumber).toBe('005-26');
    expect(parsed.voyageNumber).toBe('21');
  });

  it('does not infer or insert a voyage in legacy requests and unrelated patches', () => {
    expect(NominationCreateSchema.parse(create).vesselVoyageNumber).toBeUndefined();
    expect(NominationUpdateSchema.parse({ referenceNo: 'REF' })).not.toHaveProperty(
      'vesselVoyageNumber',
    );
  });

  it('clears a saved voyage with blank or null without changing the old identifier', () => {
    expect(NominationUpdateSchema.parse({ vesselVoyageNumber: '  ' })).toEqual({
      vesselVoyageNumber: null,
    });
    expect(NominationUpdateSchema.parse({ vesselVoyageNumber: null })).toEqual({
      vesselVoyageNumber: null,
    });
  });

  it('rejects excessively long or non-text voyage values', () => {
    expect(NominationUpdateSchema.safeParse({ vesselVoyageNumber: 'x'.repeat(101) }).success).toBe(
      false,
    );
    expect(NominationUpdateSchema.safeParse({ vesselVoyageNumber: 21 }).success).toBe(false);
  });

  it.each([null, undefined, '', '   '])('renders unknown %s as TBC', (value) => {
    expect(formatVesselVoyageNumber(value)).toBe('TBC');
  });

  it('rejects multiline values destined for notice headers', () => {
    expect(NominationUpdateSchema.safeParse({ vesselVoyageNumber: '005\n26' }).success).toBe(false);
  });

  it('renders only the supplied voyage value', () => {
    expect(formatVesselVoyageNumber(' 005-26 ')).toBe('005-26');
  });
});
