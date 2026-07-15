import { SaleCreateSchema, SaleUpdateSchema, SaleReadSchema } from '../sale.js';

// ---------------------------------------------------------------------------
// Minimal valid create payload
// ---------------------------------------------------------------------------
const VALID_CLIENT_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxx'; // valid cuid shape
const VALID_SERVICE_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy'; // valid cuid shape
const VALID_CREATE_PAYLOAD = {
  clientId: VALID_CLIENT_ID,
  serviceId: VALID_SERVICE_ID,
  price: 1500.5,
  date: '2026-07-15T00:00:00.000Z',
};

describe('SaleCreateSchema', () => {
  it('parses a minimal valid payload', () => {
    const result = SaleCreateSchema.safeParse(VALID_CREATE_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it('coerces an ISO date string to a Date', () => {
    const result = SaleCreateSchema.safeParse(VALID_CREATE_PAYLOAD);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBeInstanceOf(Date);
      expect(result.data.date.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    }
  });

  it('coerces a numeric price string to a number', () => {
    const result = SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, price: '1500.50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(1500.5);
    }
  });

  it('fails when clientId is missing', () => {
    const result = SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, clientId: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join('.'))).toContain('clientId');
    }
  });

  it('fails when serviceId is missing', () => {
    const result = SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, serviceId: undefined });
    expect(result.success).toBe(false);
  });

  it('fails when clientId is not a cuid', () => {
    const result = SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, clientId: 'not-a-cuid' });
    expect(result.success).toBe(false);
  });

  it('fails when price is missing', () => {
    const result = SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, price: undefined });
    expect(result.success).toBe(false);
  });

  it('fails when price is negative', () => {
    const result = SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, price: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join('.'))).toContain('price');
    }
  });

  it('fails when date is missing', () => {
    const result = SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, date: undefined });
    expect(result.success).toBe(false);
  });

  it('accepts optional/nullable notes', () => {
    expect(SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, notes: 'remarks' }).success).toBe(
      true,
    );
    expect(SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, notes: null }).success).toBe(true);
    expect(SaleCreateSchema.safeParse(VALID_CREATE_PAYLOAD).success).toBe(true);
  });
});

describe('SaleUpdateSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(SaleUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('rejects a negative price on partial update', () => {
    expect(SaleUpdateSchema.safeParse({ price: -5 }).success).toBe(false);
  });
});

describe('SaleReadSchema', () => {
  it('parses a wire-shaped payload (Decimal price as string, nested client/service)', () => {
    const wire = {
      id: '4f9c20de-58f5-4a3b-9b30-1c2d3e4f5a6b',
      nominationId: '9a8b7c6d-5e4f-4a3b-8c9d-0e1f2a3b4c5d',
      clientId: VALID_CLIENT_ID,
      serviceId: VALID_SERVICE_ID,
      price: '1500.50',
      date: '2026-07-15T12:30:00.000Z',
      notes: null,
      client: { id: VALID_CLIENT_ID, name: 'Acme Shipping S.A.' },
      service: { id: VALID_SERVICE_ID, name: 'Launch / Boat Service' },
      createdAt: '2026-07-15T12:30:00.000Z',
      updatedAt: '2026-07-15T12:30:00.000Z',
    };
    const result = SaleReadSchema.safeParse(wire);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(1500.5);
      expect(result.data.date).toBeInstanceOf(Date);
      expect(result.data.client.name).toBe('Acme Shipping S.A.');
    }
  });
});
