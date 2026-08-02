import { describe, it, expect } from 'vitest';
import { parseDateInput, toDateParam, fromDateParam } from '../datetime';

describe('parseDateInput', () => {
  it('reads a typed date as day-first, not month-first', () => {
    // The bug this guards: dayjs read "02/08/2026" as February 8th, putting the
    // wrong ETD on a cargo notice while the field still displayed 02/08/2026.
    const parsed = parseDateInput('02/08/2026');
    expect(parsed).not.toBeNull();
    expect(parsed?.getDate()).toBe(2);
    expect(parsed?.getMonth()).toBe(7); // August
    expect(parsed?.getFullYear()).toBe(2026);
  });

  it('accepts unpadded day and month', () => {
    const parsed = parseDateInput('2/8/2026');
    expect(parsed?.getDate()).toBe(2);
    expect(parsed?.getMonth()).toBe(7);
  });

  it('lands on local midnight, so the calendar day survives the round trip', () => {
    const parsed = parseDateInput('06/07/2026');
    expect(parsed?.getHours()).toBe(0);
    expect(parsed?.getMinutes()).toBe(0);
    expect(toDateParam(parsed as Date)).toBe('2026-07-06');
  });

  it('rejects a day that does not exist rather than rolling it over', () => {
    // new Date(2026, 1, 31) would silently become 3 March.
    expect(parseDateInput('31/02/2026')).toBeNull();
    expect(parseDateInput('32/01/2026')).toBeNull();
    expect(parseDateInput('01/13/2026')).toBeNull();
  });

  it('returns null for anything unparseable, leaving the picker empty', () => {
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('tomorrow')).toBeNull();
    expect(parseDateInput('2026-08-02')).toBeNull();
    expect(parseDateInput('02/08/26')).toBeNull();
  });

  it('round-trips through the search-param helpers', () => {
    const parsed = parseDateInput('10/07/2026') as Date;
    expect(fromDateParam(toDateParam(parsed))?.getTime()).toBe(parsed.getTime());
  });
});
