import { NominationStatus } from './enums.js';

// The lifecycle is derived (see status.ts); the only manual transition a user can
// make is to CANCELLED, and only from a non-cancelled state. CANCELLED is terminal.
export const ALLOWED_TRANSITIONS: Record<NominationStatus, NominationStatus[]> = {
  NOMINATED: ['CANCELLED'],
  IN_PORT: ['CANCELLED'],
  FULL_AWAY: ['CANCELLED'],
  CANCELLED: [], // terminal
};

export function isValidTransition(from: NominationStatus, to: NominationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
