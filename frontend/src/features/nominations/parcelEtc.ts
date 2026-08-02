/**
 * ETC (estimated time of completion) on a cargo parcel.
 *
 * A parcel stores its ETC split across `etcDate` (`YYYY-MM-DD`) and `etcTime`
 * (`HH:mm`), both deliberately zone-less: an ETC is a *port-local wall clock*,
 * not an instant. Serialising it as a UTC timestamp would let the reader's
 * timezone shift the hour — or the day — on a legally binding notice.
 *
 * `formatEtc` mirrors `formatEtcStamp` in the backend nominations service, so
 * the ETC previewed in the compose drawer is the ETC the template renders.
 */

/** Rebuilds a picker value from the stored pair, or `null` when nothing parses. */
export function parseEtc(date?: string | null, time?: string | null): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const hhmm = time && /^\d{2}:\d{2}$/.test(time) ? time : '00:00';
  // Zone-less literal — the `Date` constructor reads it as local wall clock,
  // which is exactly what was stored.
  const parsed = new Date(`${date}T${hhmm}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * ETC as it appears in the notice, e.g. "02/08/2026 02:00". Reordered
 * textually rather than parsed, and anything that isn't a stored pair (legacy
 * free-typed dates) passes through untouched. 24-hour, never AM/PM.
 */
export function formatEtc(date?: string | null, time?: string | null): string {
  const rawDate = (date ?? '').trim();
  const rawTime = (time ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);

  return [iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : rawDate, rawTime].filter(Boolean).join(' ');
}

/** Splits a picked date into the stored pair. A cleared picker blanks both. */
export function toEtcParts(value: Date | null): { etcDate: string; etcTime: string } {
  if (!value) return { etcDate: '', etcTime: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    etcDate: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    etcTime: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
}
