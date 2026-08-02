import { describe, it, expect } from 'vitest';
import { UNIT_OPTIONS, unitSelectData } from '../parcelUnits';

describe('unitSelectData', () => {
  it('offers the canonical unit list when the row has nothing yet', () => {
    expect(unitSelectData()).toEqual(UNIT_OPTIONS);
  });

  it('folds in a stored unit that is off the canonical list', () => {
    // A product's catalog `bblUnit` is free text ("MT"), not one of our tokens
    // ("M/T"). Without this the cell would render blank while a unit is in fact
    // stored, and the notice would go out with a unit nobody saw.
    expect(unitSelectData('MT')).toContainEqual({ value: 'MT', label: 'MT' });
  });

  it('does not duplicate a unit already on the list', () => {
    const values = unitSelectData('Bbls').map((o) => o.value);
    expect(values.filter((v) => v === 'Bbls')).toHaveLength(1);
  });

  it('accepts several fallbacks and keeps their order', () => {
    const values = unitSelectData('MT', 'Drums').map((o) => o.value);
    expect(values.slice(-2)).toEqual(['MT', 'Drums']);
  });

  it('ignores blank and missing values', () => {
    expect(unitSelectData('', '   ', null, undefined)).toEqual(UNIT_OPTIONS);
  });
});
