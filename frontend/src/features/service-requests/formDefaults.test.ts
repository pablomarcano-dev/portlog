import { describe, expect, it } from 'vitest';
import { defaultScheduledAt, isMidnight, withTime } from './formDefaults';

describe('service request scheduling helpers', () => {
  it('defaults to the next whole local hour', () => {
    expect(defaultScheduledAt(new Date(2026, 8, 2, 14, 37, 22))).toEqual(
      new Date(2026, 8, 2, 15, 0, 0),
    );
  });

  it('rolls the default into the next day', () => {
    expect(defaultScheduledAt(new Date(2026, 8, 2, 23, 37))).toEqual(new Date(2026, 8, 3, 0, 0, 0));
  });

  it('commits a typed time while retaining the selected date', () => {
    expect(withTime(new Date(2026, 8, 3, 0, 0), '12:45')).toEqual(new Date(2026, 8, 3, 12, 45, 0));
  });

  it('does not reject an intentional midnight', () => {
    const midnight = withTime(new Date(2026, 8, 3, 12, 45), '00:00');
    expect(midnight).toEqual(new Date(2026, 8, 3, 0, 0, 0));
    expect(isMidnight(midnight)).toBe(true);
  });

  it('ignores incomplete native time values', () => {
    const date = new Date(2026, 8, 3, 12, 45);
    expect(withTime(date, '12:')).toBe(date);
  });
});
