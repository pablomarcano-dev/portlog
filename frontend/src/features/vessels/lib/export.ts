import type { VesselInfo } from '@portlog/schemas';
import type { EnrichedVessel } from './types';

// Columns shared by all three lineup tables. Departures uses ETD in place of
// ETA; we handle that by swapping the header (see DEPARTURE_COLUMNS below).
export const LINEUP_COLUMNS = [
  'VESSEL',
  'IMO',
  'CARGO',
  'QTY',
  'ETA',
  'LOAD PORT',
  'LAST PORT',
  'NEXT PORT',
  'AGENCY',
  'LAY DAYS',
  'CHARTER',
  'OPERATOR',
  'CONTACT',
  'OWNER',
  'CONTACT 2',
  'REMARK',
] as const;

export const DEPARTURE_COLUMNS = [
  'VESSEL',
  'IMO',
  'CARGO',
  'QTY',
  'ETD',
  'LOAD PORT',
  'LAST PORT',
  'NEXT PORT',
  'AGENCY',
  'LAY DAYS',
  'CHARTER',
  'OPERATOR',
  'CONTACT',
  'OWNER',
  'CONTACT 2',
  'REMARK',
] as const;

export type LineupColumn = (typeof LINEUP_COLUMNS)[number];

export type LineupRow = Record<string, string>;

export interface LineupExtras {
  info?: VesselInfo;
}

function cleanDash(value: string | null | undefined): string {
  if (!value) return '';
  if (value === '—') return '';
  return value;
}

/**
 * Pick the most meaningful capacity number + unit for a vessel.
 * DWT is the general bulk/tanker standard; TEU for containers; GT as a last resort.
 */
function formatQty(info: VesselInfo | undefined): string {
  if (!info) return '';
  if (info.teu && info.teu > 0) return `${info.teu} TEU`;
  if (info.deadweight && info.deadweight > 0) return `${info.deadweight} DWT`;
  if (info.gross_tonnage && info.gross_tonnage > 0) return `${info.gross_tonnage} GT`;
  return '';
}

/**
 * Build a row for the lineup workbook. `timeKey` switches the time-column label
 * between "ETA" (arrivals / docked) and "ETD" (departures) so the row can be
 * rendered against either column set.
 */
export function vesselToLineupRow(
  v: EnrichedVessel,
  extras?: LineupExtras,
  timeKey: 'ETA' | 'ETD' = 'ETA',
): LineupRow {
  const eta = v.pro?.eta_UTC ?? v.eta_UTC ?? '';
  const loadPort = v.pro?.dest_port ?? '';
  const lastPort = v.pro?.dep_port ?? '';
  const nextPort = v.pro?.dest_port ?? v.destination ?? '';

  return {
    VESSEL: v.name ?? '',
    IMO: v.imo ?? '',
    CARGO: v.type_specific ?? '',
    QTY: formatQty(extras?.info),
    [timeKey]: eta ?? '',
    'LOAD PORT': loadPort ?? '',
    'LAST PORT': lastPort ?? '',
    'NEXT PORT': nextPort ?? '',
    AGENCY: '',
    'LAY DAYS': '',
    CHARTER: '',
    OPERATOR: cleanDash(v.operator_name),
    CONTACT: '',
    OWNER: cleanDash(v.beneficial_owner),
    'CONTACT 2': '',
    REMARK: '',
  };
}
