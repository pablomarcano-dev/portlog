/**
 * Formatters for the figures and dates printed on outgoing notices.
 *
 * These live in the shared package because a notice is assembled from both
 * sides: the backend renders the Handlebars templates under `backend/templates`,
 * while the Cargo Update modal builds its parcel blocks in the browser. Both
 * halves land in the same email, so a divergence here shows up as one document
 * written in two different house styles.
 *
 * The forms are pinned to the agency's legacy output, which is the reference the
 * recipients are used to reading:
 *
 *     Jul-18th, 2026 06:00 Cargo Update - Merey 16 Crude Oil
 *     Quantity On Board :  1,950,210.00 BBLS
 *     Loading Rate      :     29,051.00 BBLS/HR
 *     Laydays : Jul. 06th, 2026 - Jul. 10th, 2026
 */

/** Three-letter month names, as the notices spell them. */
export const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  const last = day % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
}

/** Zero-padded day with its ordinal suffix, e.g. 2 -> "02nd". */
export function ordinalDay(day: number): string {
  return `${String(day).padStart(2, '0')}${ordinalSuffix(day)}`;
}

/**
 * A date as a notice writes it, e.g. "Jul-18th, 2026".
 *
 * Calendar parts are read in local time, matching how the agency reads a date
 * off the fixture rather than off a UTC instant. Null renders empty so a missing
 * date drops its line instead of printing "Invalid Date".
 */
export function formatNoticeDate(d: Date | null | undefined): string {
  if (!d) return '';
  return `${MONTH_ABBR[d.getMonth()]}-${ordinalDay(d.getDate())}, ${d.getFullYear()}`;
}

/**
 * A laycan as a notice writes it, e.g. "Jun. 22nd - Jun. 26th, 2026".
 *
 * The month is repeated on both ends — a laycan is the figure a demurrage claim
 * is argued from, so the end date is never left to be inferred from the start.
 * The year is written once, at the end, and only repeated when the range
 * actually crosses into another year. Either end may be missing; a single date
 * renders on its own.
 */
export function formatNoticeDateRange(
  first: Date | null | undefined,
  last: Date | null | undefined,
): string {
  const dayPart = (d: Date) => `${MONTH_ABBR[d.getMonth()]}. ${ordinalDay(d.getDate())}`;
  const full = (d: Date) => `${dayPart(d)}, ${d.getFullYear()}`;

  if (first && last) {
    if (first.getFullYear() !== last.getFullYear()) return `${full(first)} - ${full(last)}`;
    return `${dayPart(first)} - ${full(last)}`;
  }

  const only = first ?? last;
  return only ? full(only) : '';
}

/**
 * A cargo figure as a notice writes it, e.g. 1950000 -> "1,950,000.00".
 *
 * Grouped with commas and always carrying two decimals, matching the legacy
 * output. The locale is pinned so a rendered notice never depends on the
 * server's environment. Anything non-numeric passes through untouched rather
 * than becoming "NaN"; empty stays empty so a blank field prints nothing.
 */
export function formatCargoFigure(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * The unit a transfer rate is quoted in, e.g. "Bbls/Hr".
 *
 * A rate is always "cargo unit per hour", so it is derived from the parcel's own
 * unit rather than assumed — a crude parcel loads in Bbls/Hr but a grain parcel
 * moves in MT/Hr, and labelling wheat in barrels would be wrong on the face of
 * the notice. An explicitly entered unit always wins; barrels are the fallback
 * only when nothing at all is recorded, since the agency's tanker work is the
 * common case.
 */
export function resolveTransferRateUnit(
  explicitUnit: string | null | undefined,
  cargoUnit: string | null | undefined,
): string {
  const explicit = explicitUnit?.trim();
  if (explicit) return explicit;
  const cargo = cargoUnit?.trim();
  return cargo ? `${cargo}/Hr` : 'Bbls/Hr';
}
