import { describe, it, expect } from 'vitest';
import { formatDateTime, toDateParam, fromDateParam } from '../datetime';

describe('formatDateTime', () => {
  // 24-hour output is a domain rule, not a preference: an AM/PM timestamp on a
  // NOR or SOF is ambiguous, and these documents carry legal weight.
  it('renders the hour in 24-hour form, never AM/PM', () => {
    const evening = formatDateTime('2026-08-02T18:30:00', 'en-GB');

    expect(evening).toContain('18:30');
    expect(evening).not.toMatch(/[AP]M/i);
  });

  it('forces 24-hour even for a locale that defaults to AM/PM', () => {
    const evening = formatDateTime('2026-08-02T18:30:00', 'en-US');

    expect(evening).not.toMatch(/[AP]M/i);
  });

  it('accepts a Date, an ISO string and epoch millis alike', () => {
    const date = new Date(2026, 7, 2, 18, 30);
    const expected = formatDateTime(date, 'en-GB');

    expect(formatDateTime(date.toISOString(), 'en-GB')).toBe(expected);
    expect(formatDateTime(date.getTime(), 'en-GB')).toBe(expected);
  });
});

describe('date search params', () => {
  it('serialises the local calendar date, not the UTC one', () => {
    // Local midnight — under a negative UTC offset toISOString() would roll
    // this back to the previous day.
    expect(toDateParam(new Date(2026, 6, 1))).toBe('2026-07-01');
  });

  it('parses back to local midnight, so the day survives a round trip', () => {
    const parsed = fromDateParam('2026-07-01');

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(6);
    expect(parsed?.getDate()).toBe(1);
    expect(parsed?.getHours()).toBe(0);
  });

  it('returns null for a missing or malformed param', () => {
    expect(fromDateParam(undefined)).toBeNull();
    expect(fromDateParam('')).toBeNull();
    expect(fromDateParam('not-a-date')).toBeNull();
  });
});
