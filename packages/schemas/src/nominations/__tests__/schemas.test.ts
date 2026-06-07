import { NominationCreateSchema, NominationStatusTransitionSchema } from '../schemas.js';
import { isValidTransition } from '../transitions.js';

// ---------------------------------------------------------------------------
// Minimal valid create payload (only required fields)
// ---------------------------------------------------------------------------
const VALID_SHIP_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxx'; // valid cuid shape
const VALID_CREATE_PAYLOAD = {
  shipParticularId: VALID_SHIP_ID,
  voyageNumber: '01/PLC',
  dateNominated: '2026-05-13T00:00:00.000Z',
  nominationType: 'FULL_AGENCY' as const,
};

describe('NominationCreateSchema', () => {
  it('parses a minimal valid payload', () => {
    const result = NominationCreateSchema.safeParse(VALID_CREATE_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it('fails when shipParticularId is missing', () => {
    const payload = { ...VALID_CREATE_PAYLOAD, shipParticularId: undefined };
    const result = NominationCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('fails when voyageNumber is missing', () => {
    const payload = { ...VALID_CREATE_PAYLOAD, voyageNumber: undefined };
    const result = NominationCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('fails when dateNominated is missing', () => {
    const payload = { ...VALID_CREATE_PAYLOAD, dateNominated: undefined };
    const result = NominationCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('defaults nominationType to FULL_AGENCY when omitted', () => {
    const payload = { ...VALID_CREATE_PAYLOAD, nominationType: undefined };
    const result = NominationCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nominationType).toBe('FULL_AGENCY');
    }
  });

  it('defaults parcels to [] when omitted', () => {
    const result = NominationCreateSchema.safeParse(VALID_CREATE_PAYLOAD);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parcels).toEqual([]);
    }
  });

  it('fails when layDaysFirst is after layDaysLast', () => {
    const result = NominationCreateSchema.safeParse({
      ...VALID_CREATE_PAYLOAD,
      layDaysFirst: '2026-05-15T00:00:00.000Z',
      layDaysLast: '2026-05-10T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('layDaysFirst');
    }
  });

  it('passes when layDaysFirst equals layDaysLast', () => {
    const result = NominationCreateSchema.safeParse({
      ...VALID_CREATE_PAYLOAD,
      layDaysFirst: '2026-05-10T00:00:00.000Z',
      layDaysLast: '2026-05-10T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('passes when layDaysFirst is before layDaysLast', () => {
    const result = NominationCreateSchema.safeParse({
      ...VALID_CREATE_PAYLOAD,
      layDaysFirst: '2026-05-10T00:00:00.000Z',
      layDaysLast: '2026-05-15T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NominationStatusTransitionSchema
// ---------------------------------------------------------------------------
describe('NominationStatusTransitionSchema', () => {
  it('fails when toStatus is CANCELLED and reason is missing', () => {
    const result = NominationStatusTransitionSchema.safeParse({ toStatus: 'CANCELLED' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('reason');
    }
  });

  it('succeeds when toStatus is CANCELLED and reason is provided', () => {
    const result = NominationStatusTransitionSchema.safeParse({
      toStatus: 'CANCELLED',
      reason: 'duplicate nomination',
    });
    expect(result.success).toBe(true);
  });

  it('succeeds when toStatus is not CANCELLED and reason is absent', () => {
    const result = NominationStatusTransitionSchema.safeParse({ toStatus: 'CONFIRMED' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid status value', () => {
    const result = NominationStatusTransitionSchema.safeParse({ toStatus: 'UNKNOWN' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidTransition
// ---------------------------------------------------------------------------
describe('isValidTransition', () => {
  it('returns true for DRAFT → CONFIRMED', () => {
    expect(isValidTransition('DRAFT', 'CONFIRMED')).toBe(true);
  });

  it('returns true for DRAFT → CANCELLED', () => {
    expect(isValidTransition('DRAFT', 'CANCELLED')).toBe(true);
  });

  it('returns false for DRAFT → COMPLETED (skip not allowed)', () => {
    expect(isValidTransition('DRAFT', 'COMPLETED')).toBe(false);
  });

  it('returns false for COMPLETED → DRAFT (terminal state)', () => {
    expect(isValidTransition('COMPLETED', 'DRAFT')).toBe(false);
  });

  it('returns false for CANCELLED → DRAFT (terminal state)', () => {
    expect(isValidTransition('CANCELLED', 'DRAFT')).toBe(false);
  });

  it('returns true for CONFIRMED → IN_PROGRESS', () => {
    expect(isValidTransition('CONFIRMED', 'IN_PROGRESS')).toBe(true);
  });

  it('returns true for IN_PROGRESS → COMPLETED', () => {
    expect(isValidTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('returns true for IN_PROGRESS → CANCELLED', () => {
    expect(isValidTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
  });
});
