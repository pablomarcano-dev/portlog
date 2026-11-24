/** Operational subject display only; never use these rounded values for SOF events. */
export const UPDATE_SUBJECT_TIME_ZONE = 'America/Caracas';
const TEN_MINUTES = 10 * 60_000;

export interface UpdateSubjectParts {
  year: number;
  month: number;
  day: number;
  time: string;
  stamp: string;
}

function partsFromWallClock(clock: Date): UpdateSubjectParts {
  const year = clock.getUTCFullYear();
  const month = clock.getUTCMonth() + 1;
  const day = clock.getUTCDate();
  const two = (n: number) => String(n).padStart(2, '0');
  const time = `${two(clock.getUTCHours())}:${two(clock.getUTCMinutes())}`;
  return { year, month, day, time, stamp: `${two(day)}.${two(month)}.${year} ${time} Hrs` };
}

/**
 * Format an actual instant on the agency clock, independently of browser/server TZ.
 * Automatic subject stamps round half upward, including day/month/year rollover.
 * `round=false` supplies the unrounded agency calendar for editable UI fields.
 */
export function getUpdateSubjectParts(instant: Date, round = true): UpdateSubjectParts {
  if (!Number.isFinite(instant.getTime())) throw new RangeError('Invalid update timestamp.');
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: UPDATE_SUBJECT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map(({ type, value }) => [type, value]),
  );
  const wallTime = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
    instant.getUTCMilliseconds(),
  );
  return partsFromWallClock(
    new Date(
      round ? Math.floor((wallTime + TEN_MINUTES / 2) / TEN_MINUTES) * TEN_MINUTES : wallTime,
    ),
  );
}

export function formatUpdateSubjectTimestamp(instant: Date): string {
  return getUpdateSubjectParts(instant).stamp;
}

/** Round an unedited date/time picker value, whose Date represents a calendar day. */
export function roundUpdateSubjectWallTime(calendarDate: Date, time: string): UpdateSubjectParts {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match || !Number.isFinite(calendarDate.getTime()))
    throw new RangeError('Invalid update time.');
  const wallTime = Date.UTC(
    calendarDate.getFullYear(),
    calendarDate.getMonth(),
    calendarDate.getDate(),
    Number(match[1]),
    Number(match[2]),
  );
  return partsFromWallClock(
    new Date(Math.floor((wallTime + TEN_MINUTES / 2) / TEN_MINUTES) * TEN_MINUTES),
  );
}
