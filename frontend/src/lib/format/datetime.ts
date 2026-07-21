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
