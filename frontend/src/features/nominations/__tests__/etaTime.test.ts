import { describe, expect, it } from 'vitest';
import { formatEtaTime, withEtaTime } from '../etaTime';

describe('24-hour ETA entry', () => {
  it.each(['00:00', '12:00', '15:00', '20:00', '23:59'])(
    'accepts %s without changing the date or mutating the original',
    (time) => {
      const original = new Date(2026, 9, 26, 9, 12, 34, 567);
      const before = original.getTime();
      const result = withEtaTime(original, time)!;
      expect(formatEtaTime(result)).toBe(time);
      expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual([2026, 9, 26]);
      expect(original.getTime()).toBe(before);
      expect(result.getSeconds()).toBe(0);
    },
  );
  it.each(['24:00', '20:60', '2:00', '20:', '', '12:00 PM', '-1:00'])(
    'rejects incomplete or invalid time %s',
    (time) => {
      expect(withEtaTime(new Date(), time)).toBeNull();
    },
  );
  it('formats an absent optional date as empty', () => expect(formatEtaTime(null)).toBe(''));
});
