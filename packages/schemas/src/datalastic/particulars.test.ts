import { vesselParticularsSchema } from './index';
describe('Datalastic consumed vessel particulars', () => {
  it('accepts the documented fields despite unrelated string-valued provider metadata', () => {
    expect(
      vesselParticularsSchema.parse({
        imo: '1234567',
        deadweight: 74999,
        gross_tonnage: 43693,
        length: 228.4,
        teu: '0',
        year_built: '2012',
      }),
    ).toEqual({ imo: '1234567', deadweight: 74999, gross_tonnage: 43693, length: 228.4 });
  });
  it('preserves zero and missing/null measurements without making up values', () => {
    expect(vesselParticularsSchema.parse({ deadweight: 0, length: null })).toEqual({
      deadweight: 0,
      length: null,
    });
  });
  it.each([-1, '74999', Infinity])(
    'rejects malformed or negative provider measurements: %s',
    (value) => {
      expect(vesselParticularsSchema.safeParse({ deadweight: value }).success).toBe(false);
    },
  );
});
