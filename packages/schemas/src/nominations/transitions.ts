import { NominationStatus } from './enums.js';

export const ALLOWED_TRANSITIONS: Record<NominationStatus, NominationStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
};

export function isValidTransition(from: NominationStatus, to: NominationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
