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

/** A number once its thousands separators are stripped: the shape we can regroup. */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/** Commas every three digits, left of the decimal point. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * A figure read off a stored field, with thousands commas dropped.
 *
 * Returns null when the text is not a number at all, so callers can pass such a
 * value through verbatim instead of printing "NaN".
 */
function parseFigure(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'number' ? String(value) : String(value).trim();
  if (raw === '') return null;
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * A SOF quantity as the statement writes it, e.g. "1896870" -> "1,896,870" and
 * "287912.375" -> "287,912.375".
 *
 * Unlike {@link formatCargoFigure} the decimals are kept exactly as entered —
 * a bill of lading states its own precision (three decimals on M/T, none on
 * barrels) and rounding it to two would misstate the figure. The digits are
 * never touched, only regrouped, so a trailing "0" the operator typed survives.
 *
 * Punctuation is read in the en-US convention this document family is written
 * in: "," is a thousands separator and "." is the decimal point. Anything
 * already carrying commas is therefore re-grouped rather than passed through.
 * An earlier revision refused to touch such values, guarding against SOF rows
 * captured with a *decimal* comma ("286433,463" meaning 286433.463); that guard
 * is gone because the app has no production data to protect and the passthrough
 * was leaving figures ungrouped on the face of the notice. Text that is not a
 * number ("NONE") still passes through untouched.
 */
export function formatQuantity(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (raw === '') return '';

  const normalized = raw.replace(/,/g, '');
  if (!PLAIN_NUMBER.test(normalized)) return raw;

  const negative = normalized.startsWith('-');
  const [int = '', dec] = (negative ? normalized.slice(1) : normalized).split('.');
  return `${negative ? '-' : ''}${groupThousands(int)}${dec === undefined ? '' : `.${dec}`}`;
}

/**
 * A barrel figure as a bill of lading writes it, e.g. 755553.9 -> "755,553".
 *
 * Barrels carry no decimals and the tail is *truncated*, never rounded: the
 * figure states what was measured, and rounding 755,553.9 up to 755,554 would
 * claim a barrel that was never loaded. Grouped with commas. Empty renders
 * empty so a blank field prints nothing; text that is not a number passes
 * through untouched rather than becoming "NaN".
 */
export function formatBarrels(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const n = parseFigure(value);
  if (n === null) return String(value).trim();

  const truncated = Math.trunc(n);
  const negative = truncated < 0 || Object.is(truncated, -0);
  return `${negative ? '-' : ''}${groupThousands(String(Math.abs(truncated)))}`;
}

/**
 * A tonnage as a bill of lading writes it, e.g. 114375.613 -> "114,375.613".
 *
 * M/T and L/T are always quoted to three decimals, so a whole figure is padded
 * (113460 -> "113,460.000") rather than printed bare — the trailing zeros are
 * part of the stated precision. Grouped with commas, decimal point pinned to
 * "." regardless of the server's locale. Empty renders empty; text that is not
 * a number passes through untouched.
 */
export function formatTons(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const n = parseFigure(value);
  if (n === null) return String(value).trim();

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n);
}

const MS_PER_HOUR = 3_600_000;

/**
 * The hour marks the agency serves ETA notices on, largest first.
 *
 * A notice is always titled with the mark it has *reached*, so the remaining
 * hours round down to one of these — 80 hours out is still the "72 Hours"
 * notice, because the 96-hour one went out earlier.
 */
const ETA_NOTICE_HOUR_BUCKETS = [96, 72, 48, 24, 12] as const;

/**
 * The countdown label an ETA notice is titled with, e.g. "72 Hours ETA Notice"
 * or "6 DAYS ETA Notice".
 *
 * Anchored to the nomination's ETA, not to the sending date: the recipient reads
 * the title as a statement of how far out the vessel is.
 *
 * Beyond four days the countdown is written in whole days, floored. At and
 * within four days it switches to the hour marks the agency actually serves on,
 * rounded *down* to the mark already reached. The changeover sits exactly at 96
 * hours, which reads as "96 Hours ETA Notice" — four days out is the last
 * notice written in hours, not the first written in days.
 *
 * Under twelve hours, or once the ETA has passed, the label clamps to
 * "12 Hours ETA Notice"; there is no shorter notice, and a late send must still
 * carry a title rather than count backwards.
 */
export function etaNoticeLabel(now: Date, eta: Date): string {
  const hoursRemaining = (eta.getTime() - now.getTime()) / MS_PER_HOUR;
  if (!Number.isFinite(hoursRemaining)) return '12 Hours ETA Notice';

  if (hoursRemaining > 96) {
    return `${Math.floor(hoursRemaining / 24)} DAYS ETA Notice`;
  }

  const bucket = ETA_NOTICE_HOUR_BUCKETS.find((mark) => mark <= hoursRemaining) ?? 12;
  return `${bucket} Hours ETA Notice`;
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
