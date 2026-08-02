/**
 * Shared date/time display formatters.
 *
 * Portlog produces legally binding port documents where 12-hour (AM/PM) times
 * are ambiguous and unacceptable. Every rendered time MUST use 24-hour format.
 * Do not call `toLocaleString`/`toLocaleTimeString` with a time component
 * inline — funnel through these helpers so `hour12: false` is guaranteed.
 *
 * For Mantine date/time pickers, pin `valueFormat="DD/MM/YYYY HH:mm"` (24-hour)
 * rather than relying on component defaults.
 */

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

/**
 * Formats a date+time in 24-hour format (never AM/PM).
 *
 * @param value  A Date, ISO string, or epoch-millis number.
 * @param locale Optional BCP 47 locale; defaults to the browser locale. The
 *               hour cycle is always forced to 24-hour regardless of locale.
 */
export function formatDateTime(value: Date | string | number, locale?: string): string {
  return new Date(value).toLocaleString(locale, DATE_TIME_OPTIONS);
}

/**
 * Serialises a Date to the `YYYY-MM-DD` form used in URL search params, reading the **local**
 * calendar date.
 *
 * `toISOString().slice(0, 10)` is wrong here: a date picker yields local midnight, which in
 * GMT-3 is 03:00 UTC the same day but in GMT+2 is 22:00 UTC the *previous* day — so the URL
 * would carry a different day than the one the user clicked.
 */
export function toDateParam(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a `YYYY-MM-DD` search param back into a Date at **local** midnight.
 *
 * `new Date('2026-07-01')` parses as UTC midnight, which renders as 30 June in any negative
 * offset — the picker would show the day before the one in the URL.
 */
export function fromDateParam(value: string | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Parses a typed `DD/MM/YYYY` date into a Date at **local** midnight.
 *
 * Pass to a Mantine `DateInput` as `dateParser`. `valueFormat` governs only how
 * a date is *displayed*: left to itself the component hands the typed text to
 * dayjs, which reads "02/08/2026" as February 8th. That put a wrong ETD on a
 * cargo notice while the field still read back correctly, so anywhere a date can
 * be typed the parse must be pinned to the same order it is displayed in.
 *
 * Returns null on anything unparseable, which leaves the picker empty rather
 * than inventing a date. Day/month overflow is rejected rather than rolled over,
 * since `new Date(2026, 1, 31)` would otherwise silently become 3 March.
 */
export function parseDateInput(input: string): Date | null {
  const match = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(input);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}
