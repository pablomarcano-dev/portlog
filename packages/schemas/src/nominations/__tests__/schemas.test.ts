import { NominationCreateSchema, NominationStatusTransitionSchema } from '../schemas.js';
import { isValidTransition } from '../transitions.js';
import { deriveNominationStatus } from '../status.js';

// ---------------------------------------------------------------------------
// Minimal valid create payload (only required fields)
// ---------------------------------------------------------------------------
const VALID_SHIP_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxx'; // valid cuid shape
const VALID_BRANCH_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy'; // valid cuid shape
const VALID_CREATE_PAYLOAD = {
  shipParticularId: VALID_SHIP_ID,
  branchId: VALID_BRANCH_ID,
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

  it('passes when voyageNumber is missing (auto-assigned from correlative)', () => {
    const payload = { ...VALID_CREATE_PAYLOAD, voyageNumber: undefined };
    const result = NominationCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('fails when dateNominated is missing', () => {
    const payload = { ...VALID_CREATE_PAYLOAD, dateNominated: undefined };
    const result = NominationCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('fails when branchId is missing', () => {
    const payload = { ...VALID_CREATE_PAYLOAD, branchId: undefined };
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
    const result = NominationStatusTransitionSchema.safeParse({ toStatus: 'IN_PORT' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid status value', () => {
    const result = NominationStatusTransitionSchema.safeParse({ toStatus: 'UNKNOWN' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidTransition — the only manual transition is to CANCELLED
// ---------------------------------------------------------------------------
describe('isValidTransition', () => {
  it('returns true for NOMINATED → CANCELLED', () => {
    expect(isValidTransition('NOMINATED', 'CANCELLED')).toBe(true);
  });

  it('returns true for IN_PORT → CANCELLED', () => {
    expect(isValidTransition('IN_PORT', 'CANCELLED')).toBe(true);
  });

  it('returns true for FULL_AWAY → CANCELLED', () => {
    expect(isValidTransition('FULL_AWAY', 'CANCELLED')).toBe(true);
  });

  it('returns false for NOMINATED → IN_PORT (derived, not manual)', () => {
    expect(isValidTransition('NOMINATED', 'IN_PORT')).toBe(false);
  });

  it('returns false for CANCELLED → NOMINATED (terminal state)', () => {
    expect(isValidTransition('CANCELLED', 'NOMINATED')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deriveNominationStatus — status computed from facts
// ---------------------------------------------------------------------------
describe('deriveNominationStatus', () => {
  const before = new Date('2026-05-01T00:00:00.000Z');
  const first = new Date('2026-05-10T00:00:00.000Z');
  const last = new Date('2026-05-20T00:00:00.000Z');
  const now = new Date('2026-05-25T00:00:00.000Z');

  const base = {
    cancelled: false,
    prearrivalSent: false,
    sofSent: false,
    layDaysFirst: first,
    layDaysLast: last,
    now,
  };

  it('is NOMINATED by default', () => {
    expect(deriveNominationStatus(base)).toBe('NOMINATED');
  });

  it('CANCELLED wins over everything', () => {
    expect(
      deriveNominationStatus({ ...base, cancelled: true, prearrivalSent: true, sofSent: true }),
    ).toBe('CANCELLED');
  });

  it('IN_PORT once prearrival is sent and past layDaysFirst', () => {
    expect(deriveNominationStatus({ ...base, prearrivalSent: true })).toBe('IN_PORT');
  });

  it('stays NOMINATED if prearrival sent but still before layDaysFirst', () => {
    expect(deriveNominationStatus({ ...base, prearrivalSent: true, now: before })).toBe(
      'NOMINATED',
    );
  });

  it('FULL_AWAY once SOF is sent and past layDaysLast', () => {
    expect(deriveNominationStatus({ ...base, prearrivalSent: true, sofSent: true })).toBe(
      'FULL_AWAY',
    );
  });

  it('stays IN_PORT if SOF sent but layDaysLast is null', () => {
    expect(
      deriveNominationStatus({ ...base, prearrivalSent: true, sofSent: true, layDaysLast: null }),
    ).toBe('IN_PORT');
  });
});
