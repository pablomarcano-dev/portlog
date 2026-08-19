import {
  BALLAST_ANALYSIS_TYPE_LABELS,
  LAUNCH_SERVICE_TYPE_LABELS,
  SERVICE_REQUEST_TYPE_LABELS,
  STS_ROLE_LABELS,
  TUG_OPERATION_TYPE_LABELS,
  UNDERWATER_INSPECTION_TYPE_LABELS,
} from './enums.js';
import { ServiceRequestDetailsSchema } from './details.js';

/**
 * Control number — e.g. `SN1234/26/PLC`.
 *
 * Deliberately the same shape the agency already writes on notices, built the
 * same way as the nomination reference in `NominationsService` (correlative,
 * two-digit year, branch code).
 *
 * ⚠️ Service requests mint from their OWN correlative sequence, so this string
 * can collide with a nomination's reference — `SN1234/26/PLC` may name both.
 * The agency asked for this format explicitly; if the collision proves a
 * problem in practice, changing the prefix here (e.g. `OS`) is the only edit
 * required, since every caller goes through this function.
 * Tracked in `.claude/plans/05-service-requests-module.md` open question 1.
 */
export function formatControlNumber(
  correlative: number,
  createdAt: Date,
  branchCode: string,
): string {
  const yy = String(createdAt.getUTCFullYear()).slice(-2);
  return `SN${correlative}/${yy}/${branchCode}`;
}

/**
 * The one-line description of what was actually ordered — the list screen's
 * "Service" column and the purchase order's subject line.
 *
 * English, because both of those surfaces are the Portlog UI. The purchase
 * order *document* builds its own Spanish breakdown in `order-context.ts`.
 *
 * Falls back to an em dash when `details` is unparseable — a half-filled draft
 * still has to render a row.
 */
export function resolveServiceLabel(details: unknown): string {
  const parsed = ServiceRequestDetailsSchema.safeParse(details);
  if (!parsed.success) return '—';
  const value = parsed.data;

  switch (value.type) {
    case 'LAUNCH': {
      const label = LAUNCH_SERVICE_TYPE_LABELS[value.serviceType].en;
      return value.boatCount > 1 ? `${label} (×${value.boatCount})` : label;
    }
    case 'UNDERWATER_INSPECTION':
      return UNDERWATER_INSPECTION_TYPE_LABELS[value.inspectionType].en;
    case 'BALLAST_WATER': {
      const label = BALLAST_ANALYSIS_TYPE_LABELS[value.analysisType].en;
      return `${label} — ${value.tankCount} tank${value.tankCount === 1 ? '' : 's'}`;
    }
    case 'TUG': {
      const label = TUG_OPERATION_TYPE_LABELS[value.operationType].en;
      return value.tugCount > 1 ? `${label} (×${value.tugCount})` : label;
    }
    case 'STS':
      return `${STS_ROLE_LABELS[value.ourRole].en} — ${value.targetVesselName}`;
    case 'GENERAL':
      return value.route ?? SERVICE_REQUEST_TYPE_LABELS.GENERAL.en;
  }
}
