/**
 * The parts of an outgoing notice that are written in the browser.
 *
 * A notice is assembled from both ends: the backend renders the Handlebars
 * templates under `backend/templates`, and the modals here rewrite the pieces
 * the operator typed *after* that draft was composed. Every function below
 * therefore has a counterpart on the server it has to agree with, and each one
 * names it — the two halves land in the same email, and a divergence reads as
 * one document written twice.
 *
 * All pure, and none of them keeps its own clock: `now` is always passed in, so
 * a countdown can be tested and so the label is stamped at the moment the agent
 * sends rather than re-derived while a drawer sits open.
 *
 * 24-hour throughout. Nothing here formats an hour, and nothing here should
 * start: times arrive as the operator typed them ("HH:mm") and pass through.
 */

import { etaNoticeLabel, formatCargoFigure, formatNoticeDate } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// ETA notices
// ---------------------------------------------------------------------------

/**
 * The notice phrase an ETA subject ends with: a countdown ("96 Hours ETA
 * Notice", "6 DAYS ETA Notice") or the fixed wording the templates carried
 * before the countdown was computed.
 *
 * Deliberately a closed list rather than "whatever follows the last dash". The
 * text in front is the reference line — charter reference, vessel, terminal and
 * the SN/OT number every email in the thread is filed under — and guessing at
 * where it ends would quietly truncate it. An unrecognised ending is left
 * whole and the label appended instead.
 */
const ETA_NOTICE_TAIL =
  /(?:^|\s*-\s*)(?:\d+\s+(?:hours?|days?)\s+eta\s+notice|eta\s+forwarded\s+to\s+terminal)\s*$/i;

/**
 * The countdown label an ETA notice is titled with, or `null` when there is no
 * ETA to count down to.
 *
 * The caller supplies the captain's latest reported ETA when available and the
 * nomination ETA as fallback. A missing ETA returns null so the caller leaves
 * the subject as composed rather than titling a notice "NaN Hours ETA Notice".
 */
export function etaCountdownLabel(eta: Date | null | undefined, now: Date): string | null {
  if (!eta || Number.isNaN(eta.getTime())) return null;
  return etaNoticeLabel(now, eta);
}

/**
 * A composed ETA subject re-titled with `label`, keeping its reference line.
 *
 * The server renders the title from the template's own Subject comment, which
 * spells out a fixed phrase ("96 Hours ETA Notice" on the reply to master,
 * "ETA Forwarded to Terminal" on the terminal notice) regardless of how far out
 * the vessel actually is. The agency titles these by the countdown they have
 * reached, so the phrase is replaced — and only the phrase.
 *
 * Re-titling an already-computed subject is a no-op in substance: the countdown
 * matches the same closed list, so this stays idempotent if the template starts
 * computing it too. `vesselName` titles the notice only when nothing was
 * composed at all (the draft failed to load).
 */
export function withEtaNoticeLabel(
  composedSubject: string,
  label: string,
  vesselName = '',
): string {
  const stripped = composedSubject
    .trim()
    .replace(ETA_NOTICE_TAIL, '')
    // A template that rendered its own countdown as empty leaves the separator
    // behind ("… SN1522/26/JSE - "); one dash, not two.
    .replace(/\s*-\s*$/, '')
    .trim();
  const ref = stripped || vesselName.trim();
  return ref ? `${ref} - ${label}` : label;
}

// ---------------------------------------------------------------------------
// Cargo update
// ---------------------------------------------------------------------------

/**
 * The words the Cargo Update stamp follows, straight out of the template's own
 * Subject comment in `02_statement_of_facts/07_cargo_update.hbs`:
 *
 *     {{ref_line}} - Cargo Update {{update_date}} {{update_time}} Hrs
 */
const CARGO_UPDATE_MARKER = 'Cargo Update';

/**
 * A composed Cargo Update subject re-stamped with the dialog's Date Update and
 * Time.
 *
 * The server stamps the subject with `new Date()` at compose time — the moment
 * the draft was fetched, not the moment being reported on — while the body is
 * rebuilt in the modal from the Date Update / Time fields. Left alone the two
 * disagree, and the agency reported exactly that: a subject reading
 * "Cargo Update Aug-05th, 2026 19:35 Hrs" over a body reading
 * "Jul-13th, 2026 00:01 Cargo Update". The typed values win on both.
 *
 * The reference line in front of the marker is kept verbatim, and the time is
 * passed through as typed (24-hour) rather than reformatted.
 */
export function cargoUpdateSubject(
  composedSubject: string,
  dateUpdate: Date | null | undefined,
  timeUpdate: string,
): string {
  const date = formatNoticeDate(dateUpdate);
  const time = timeUpdate.trim();
  // "Hrs" labels the time; with no time there is nothing for it to label.
  const stamp = [date, time && `${time} Hrs`].filter(Boolean).join(' ');
  const titled = stamp ? `${CARGO_UPDATE_MARKER} ${stamp}` : CARGO_UPDATE_MARKER;

  const at = composedSubject.lastIndexOf(CARGO_UPDATE_MARKER);
  if (at < 0) {
    // No marker to re-stamp — a template edited elsewhere. Append rather than
    // leave the subject carrying a timestamp the body contradicts.
    const ref = composedSubject.trim();
    return ref ? `${ref} - ${titled}` : titled;
  }
  return `${composedSubject.slice(0, at)}${titled}`;
}

/**
 * Width of the figure column on a cargo update, in characters.
 *
 * The figures are right-aligned into it so decimal points and thousands commas
 * stack under each other in the monospace body:
 *
 *     Quantity         :   1,900,000.00 Bbls
 *     Quantity On Board:     950,000.00 Bbls
 *     Loading Rate     :      25,000.00 Bbls/Hr
 *
 * MUST STAY IN SYNC with the same column in the backend template — the width is
 * spelled out in `backend/templates/_partials/figure_col.hbs`, which
 * `02_statement_of_facts/07_cargo_update.hbs` pads its figures through. That
 * template renders the header and the tail this block is spliced between, so
 * both halves are read as one table in the same email; changing one width
 * without the other puts a step in the middle of the notice.
 *
 * 14 is wide enough for "199,000,000.00" without pushing the unit out of line.
 */
export const CARGO_FIGURE_WIDTH = 14;

/**
 * Width of the label column, up to (not including) the colon. Also fixed by the
 * template, whose longest label is "Quantity On Board".
 */
const CARGO_LABEL_WIDTH = 17;

/**
 * A cargo figure padded into {@link CARGO_FIGURE_WIDTH}.
 *
 * Only the alignment is added — the figure keeps the grouped, two-decimal form
 * every other notice quotes it in. A figure wider than the column overflows it
 * rather than being truncated: a misaligned line is a cosmetic fault, a clipped
 * quantity is a wrong one.
 */
export function alignCargoFigure(value: unknown): string {
  return formatCargoFigure(value).padStart(CARGO_FIGURE_WIDTH);
}

/**
 * One "Label : figure unit" line of a cargo update parcel block.
 *
 * The unit follows the figure with a single space, so a parcel with no unit
 * recorded leaves the trailing space the template also leaves — the two blocks
 * stay byte-identical.
 */
export function cargoFigureLine(label: string, value: unknown, unit: string): string {
  return `${label.padEnd(CARGO_LABEL_WIDTH)}: ${alignCargoFigure(value)} ${unit}`;
}
