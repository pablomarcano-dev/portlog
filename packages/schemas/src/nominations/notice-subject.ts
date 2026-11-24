import { formatVesselVoyageNumber } from './vessel-voyage.js';

export interface NominationNoticeSubjectParts {
  referenceNo?: string | null;
  vesselName: string;
  vesselVoyageNumber?: string | null;
  terminalName: string;
  /** Already resolved by the caller; this formatter does not allocate or reformat SN/OT. */
  businessReference?: string | null;
}

/** Shared wording for newly generated defaults, never for rewriting sent subjects. */
export function formatNominationNoticeSubject(parts: NominationNoticeSubjectParts): string {
  const vessel = [
    parts.referenceNo?.trim(),
    parts.vesselName.trim(),
    `VOY. ${formatVesselVoyageNumber(parts.vesselVoyageNumber)}`,
  ]
    .filter(Boolean)
    .join(' ');
  const calling = [parts.terminalName.trim(), parts.businessReference?.trim()]
    .filter(Boolean)
    .join(' ');
  return `${vessel} - CALLING TO ${calling}`.trim();
}

/** A create preview is not a manual override: its business number is not allocated yet. */
export function nominationCreateSubjectOverride(
  subject: string | undefined,
  generatedPreview: string,
): string | undefined {
  return subject === generatedPreview ? undefined : subject;
}
