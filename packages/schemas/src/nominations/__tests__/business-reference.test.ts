import { formatNewNominationReference, resolveNominationReference } from '../business-reference.js';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const legacy = {
  correlative: 21,
  dateNominated: new Date('2026-12-31T00:00:00Z'),
  kind: 'SN' as const,
  branch: { code: 'MBO' },
};

describe('business nomination references', () => {
  it.each([
    ['SN', 3140, 'SN3140/26/PBO'],
    ['OT', 125, 'OT0125/26/PBO'],
    ['SN', 12345, 'SN12345/26/PBO'],
  ] as const)('formats assigned %s numbers without truncating digits', (kind, number, expected) => {
    expect(formatNewNominationReference(number, legacy.dateNominated, kind, ' pbo ')).toBe(
      expected,
    );
  });

  it('uses the opening year in UTC rather than sailing date or host timezone', () => {
    expect(formatNewNominationReference(1, new Date('2027-01-01T00:00:00Z'), 'SN', 'PLC')).toBe(
      'SN0001/27/PLC',
    );
    expect(formatNewNominationReference(1, legacy.dateNominated, 'SN', 'PLC')).toBe(
      'SN0001/26/PLC',
    );
  });

  it('retains legacy renderings and explicitly saved historic formats', () => {
    expect(resolveNominationReference(legacy)).toBe('SN-26/0021');
    expect(resolveNominationReference(legacy, 'notice')).toBe('SN21/26/MBO');
    expect(resolveNominationReference({ ...legacy, administrativeSnOt: 'SN3092/26/MBO' })).toBe(
      'SN3092/26/MBO',
    );
  });

  it('keeps the issued snapshot after branch/date edits, without inferring provenance', () => {
    const source = {
      ...legacy,
      dateNominated: new Date('2027-01-20T00:00:00Z'),
      branch: { code: 'PLC' },
      businessReference: 'SN3140/26/PBO',
    };
    expect(resolveNominationReference(source)).toBe('SN3140/26/PBO');
    expect(resolveNominationReference(source, 'notice')).toBe('SN3140/26/PBO');
    expect(resolveNominationReference({ ...source, administrativeSnOt: 'SN1/27/PLC' })).toBe(
      'SN3140/26/PBO',
    );
  });

  it('rejects unassigned numbers and missing branch codes', () => {
    expect(() => formatNewNominationReference(0, legacy.dateNominated, 'SN', 'PLC')).toThrow();
    expect(() => formatNewNominationReference(1, legacy.dateNominated, 'SN', '')).toThrow();
    expect(() => formatNewNominationReference(1, new Date('bad'), 'SN', 'PLC')).toThrow();
  });

  it('preserves legacy local/UTC conventions across New Year while new issuance is host-independent', () => {
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `
      const { resolveNominationReference, formatNewNominationReference } = require(${JSON.stringify(resolve(__dirname, '../../../dist/nominations/business-reference.js'))});
      const dateNominated = new Date('2027-01-01T00:00:00Z');
      const source = { correlative: 1, dateNominated, kind: 'SN', branch: { code: 'PLC' } };
      process.stdout.write(JSON.stringify([
        resolveNominationReference(source), resolveNominationReference(source, 'notice'),
        resolveNominationReference(source, 'internal-utc'),
        formatNewNominationReference(1, dateNominated, 'SN', 'PLC')
      ]));
    `,
      ],
      { env: { ...process.env, TZ: 'America/Caracas' }, encoding: 'utf8' },
    );
    expect(JSON.parse(output)).toEqual(['SN-26/0001', 'SN1/26/PLC', 'SN-27/0001', 'SN0001/27/PLC']);
  });
});
