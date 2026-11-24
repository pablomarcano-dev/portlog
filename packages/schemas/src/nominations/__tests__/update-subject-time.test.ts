import {
  formatUpdateSubjectTimestamp,
  getUpdateSubjectParts,
  roundUpdateSubjectWallTime,
} from '../update-subject-time.js';

describe('automatic operational subject timestamps', () => {
  it.each([
    ['2026-09-18T10:02:00.000Z', '18.09.2026 06:00 Hrs'],
    ['2026-09-18T10:04:59.999Z', '18.09.2026 06:00 Hrs'],
    ['2026-09-18T10:05:00.000Z', '18.09.2026 06:10 Hrs'],
    ['2026-09-18T10:55:00.000Z', '18.09.2026 07:00 Hrs'],
    ['2027-01-01T03:55:00.000Z', '01.01.2027 00:00 Hrs'],
    ['2026-03-01T03:55:00.000Z', '01.03.2026 00:00 Hrs'],
  ])('formats %s on the Caracas clock as %s', (input, expected) => {
    const instant = new Date(input);
    expect(formatUpdateSubjectTimestamp(instant)).toBe(expected);
    expect(instant.toISOString()).toBe(input);
  });

  it('can initialize editable fields to the exact agency time instead of rounded display', () => {
    expect(getUpdateSubjectParts(new Date('2026-09-18T10:02:00Z'), false)).toEqual({
      year: 2026,
      month: 9,
      day: 18,
      time: '06:02',
      stamp: '18.09.2026 06:02 Hrs',
    });
  });

  it('does not depend on the execution host timezone', () => {
    const previous = process.env.TZ;
    try {
      for (const zone of ['UTC', 'America/Montevideo', 'Asia/Tokyo']) {
        process.env.TZ = zone;
        expect(formatUpdateSubjectTimestamp(new Date('2026-09-18T10:05:00Z'))).toBe(
          '18.09.2026 06:10 Hrs',
        );
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it('rejects invalid instants instead of inventing a date', () => {
    expect(() => formatUpdateSubjectTimestamp(new Date('invalid'))).toThrow(RangeError);
    expect(() => roundUpdateSubjectWallTime(new Date(2026, 8, 18), '25:00')).toThrow(RangeError);
  });
});
