import { describe, it, expect } from 'vitest';
import { formatEtc, parseEtc, toEtcParts } from '../parcelEtc';

describe('toEtcParts', () => {
  it('splits a picked date into the stored zone-less pair', () => {
    expect(toEtcParts(new Date(2026, 7, 2, 2, 0))).toEqual({
      etcDate: '2026-08-02',
      etcTime: '02:00',
    });
  });

  it('reads the local calendar day, not the UTC one', () => {
    // 23:30 local on the 2nd is already the 3rd in UTC anywhere east of GMT.
    // Storing the UTC day would move the ETC to the wrong date.
    expect(toEtcParts(new Date(2026, 7, 2, 23, 30)).etcDate).toBe('2026-08-02');
  });

  it('blanks both halves when the picker is cleared', () => {
    expect(toEtcParts(null)).toEqual({ etcDate: '', etcTime: '' });
  });
});

describe('parseEtc', () => {
  it('round-trips a stored pair back into the picker', () => {
    const picked = new Date(2026, 7, 2, 2, 0);
    const stored = toEtcParts(picked);
    expect(parseEtc(stored.etcDate, stored.etcTime)?.getTime()).toBe(picked.getTime());
  });

  it('reads the stamp as local wall clock', () => {
    const parsed = parseEtc('2026-08-02', '02:00');
    expect(parsed?.getHours()).toBe(2);
    expect(parsed?.getDate()).toBe(2);
  });

  it('falls back to midnight when only a date was stored', () => {
    expect(parseEtc('2026-08-02', '')?.getHours()).toBe(0);
    expect(parseEtc('2026-08-02', null)?.getHours()).toBe(0);
  });

  it('returns null for legacy free-typed dates rather than guessing', () => {
    expect(parseEtc('Aug 02nd, 2026 02:00', '')).toBeNull();
    expect(parseEtc('08/02/2026', '')).toBeNull();
    expect(parseEtc('', '')).toBeNull();
    expect(parseEtc(null, null)).toBeNull();
  });
});

describe('formatEtc', () => {
  it('renders the notice stamp as DD/MM/YYYY HH:mm', () => {
    expect(formatEtc('2026-08-02', '02:00')).toBe('02/08/2026 02:00');
  });

  it('keeps the hour 24-hour — an ETC is never AM/PM on a notice', () => {
    expect(formatEtc('2026-08-02', '23:45')).toBe('02/08/2026 23:45');
  });

  it('drops the time when only a date was picked', () => {
    expect(formatEtc('2026-08-02', '')).toBe('02/08/2026');
  });

  it('renders empty when no ETC is recorded', () => {
    expect(formatEtc('', '')).toBe('');
    expect(formatEtc(null, null)).toBe('');
    expect(formatEtc(undefined, undefined)).toBe('');
  });

  it('passes legacy free-typed values through untouched', () => {
    expect(formatEtc('Aug 02nd, 2026 02:00', '')).toBe('Aug 02nd, 2026 02:00');
  });
});
