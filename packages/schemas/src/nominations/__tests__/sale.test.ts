import { SaleCreateSchema, SaleUpdateSchema, SaleReadSchema } from '../sale.js';

// ---------------------------------------------------------------------------
// Minimal valid create payload
// ---------------------------------------------------------------------------
const VALID_CLIENT_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxx'; // valid cuid shape
const VALID_SERVICE_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy'; // valid cuid shape
const VALID_PORT_ID = 'clzzzzzzzzzzzzzzzzzzzzzzzz'; // valid cuid shape
const VALID_DRIVER_ID = 'claaaaaaaaaaaaaaaaaaaaaaaa'; // valid cuid shape
const VALID_USER_ID = 'clbbbbbbbbbbbbbbbbbbbbbbbb'; // valid cuid shape
const VALID_CREATE_PAYLOAD = {
  clientId: VALID_CLIENT_ID,
  serviceId: VALID_SERVICE_ID,
  price: 1500.5,
  startAt: '2026-07-15T00:00:00.000Z',
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
      expect(result.data.startAt).toBeInstanceOf(Date);
      expect(result.data.startAt.toISOString()).toBe('2026-07-15T00:00:00.000Z');
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

  it('fails when startAt is missing', () => {
    const result = SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, startAt: undefined });
    expect(result.success).toBe(false);
  });

  it('accepts optional/nullable description', () => {
    expect(
      SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, description: 'remarks' }).success,
    ).toBe(true);
    expect(SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, description: null }).success).toBe(
      true,
    );
    expect(SaleCreateSchema.safeParse(VALID_CREATE_PAYLOAD).success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Voucher fields (photo supplied 29 Jul 2026)
  // -------------------------------------------------------------------------
  it('accepts a full voucher payload', () => {
    const result = SaleCreateSchema.safeParse({
      ...VALID_CREATE_PAYLOAD,
      serviceNo: '6009',
      route: 'Guaraguao - Muelle 3',
      portId: VALID_PORT_ID,
      endAt: '2026-07-15T04:30:00.000Z',
      description: 'Transfer of crew and provisions',
      driverId: VALID_DRIVER_ID,
      userId: VALID_USER_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.serviceNo).toBe('6009');
      expect(result.data.portId).toBe(VALID_PORT_ID);
      expect(result.data.endAt).toBeInstanceOf(Date);
      expect(result.data.driverId).toBe(VALID_DRIVER_ID);
      expect(result.data.userId).toBe(VALID_USER_ID);
    }
  });

  // CONDUCTOR / USUARIO are FKs into the shared SalesContact directory, so the
  // same person may legitimately fill both lines of one voucher.
  it('allows the same sales contact as both driver and user', () => {
    const result = SaleCreateSchema.safeParse({
      ...VALID_CREATE_PAYLOAD,
      driverId: VALID_DRIVER_ID,
      userId: VALID_DRIVER_ID,
    });
    expect(result.success).toBe(true);
  });

  it('allows a null driverId / userId (not recorded on the voucher)', () => {
    expect(
      SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, driverId: null, userId: null }).success,
    ).toBe(true);
  });

  it('fails when driverId is not a cuid', () => {
    const result = SaleCreateSchema.safeParse({
      ...VALID_CREATE_PAYLOAD,
      driverId: 'J. Ramirez',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join('.'))).toContain('driverId');
    }
  });

  it('treats every voucher field except client/service/price/startAt as optional', () => {
    const result = SaleCreateSchema.safeParse(VALID_CREATE_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it('allows a null portId (port not known yet)', () => {
    expect(SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, portId: null }).success).toBe(
      true,
    );
  });

  it('fails when portId is not a cuid', () => {
    const result = SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, portId: 'not-a-cuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join('.'))).toContain('portId');
    }
  });

  it('allows a null endAt — the service is still running', () => {
    expect(SaleCreateSchema.safeParse({ ...VALID_CREATE_PAYLOAD, endAt: null }).success).toBe(true);
  });

  it('rejects an endAt that precedes startAt, reporting on both fields', () => {
    const result = SaleCreateSchema.safeParse({
      ...VALID_CREATE_PAYLOAD,
      startAt: '2026-07-15T10:00:00.000Z',
      endAt: '2026-07-15T09:00:00.000Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('startAt');
      expect(paths).toContain('endAt');
    }
  });

  it('accepts a zero-length service window (start === end)', () => {
    const result = SaleCreateSchema.safeParse({
      ...VALID_CREATE_PAYLOAD,
      startAt: '2026-07-15T10:00:00.000Z',
      endAt: '2026-07-15T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a service window that runs past midnight', () => {
    const result = SaleCreateSchema.safeParse({
      ...VALID_CREATE_PAYLOAD,
      startAt: '2026-07-15T22:00:00.000Z',
      endAt: '2026-07-16T02:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('SaleUpdateSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(SaleUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('rejects a negative price on partial update', () => {
    expect(SaleUpdateSchema.safeParse({ price: -5 }).success).toBe(false);
  });

  it('rejects an inverted window when both times are sent', () => {
    const result = SaleUpdateSchema.safeParse({
      startAt: '2026-07-15T10:00:00.000Z',
      endAt: '2026-07-15T09:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts endAt alone — checked against the stored startAt in the service layer', () => {
    expect(SaleUpdateSchema.safeParse({ endAt: '2026-07-15T09:00:00.000Z' }).success).toBe(true);
  });

  it('accepts clearing optional voucher fields with null', () => {
    const result = SaleUpdateSchema.safeParse({
      serviceNo: null,
      route: null,
      portId: null,
      endAt: null,
      description: null,
      driverId: null,
      userId: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('SaleReadSchema', () => {
  it('parses a wire payload (Decimal price as string, nested client/service/port/driver/user)', () => {
    const wire = {
      id: '4f9c20de-58f5-4a3b-9b30-1c2d3e4f5a6b',
      nominationId: '9a8b7c6d-5e4f-4a3b-8c9d-0e1f2a3b4c5d',
      serviceNo: '6009',
      clientId: VALID_CLIENT_ID,
      serviceId: VALID_SERVICE_ID,
      route: 'Guaraguao - Muelle 3',
      portId: VALID_PORT_ID,
      price: '1500.50',
      startAt: '2026-07-15T12:30:00.000Z',
      endAt: '2026-07-15T14:00:00.000Z',
      description: null,
      driverId: VALID_DRIVER_ID,
      userId: VALID_USER_ID,
      client: { id: VALID_CLIENT_ID, name: 'Acme Shipping S.A.' },
      service: { id: VALID_SERVICE_ID, name: 'Launch / Boat Service' },
      port: { id: VALID_PORT_ID, name: 'Puerto La Cruz' },
      driver: { id: VALID_DRIVER_ID, name: 'J. Ramirez' },
      user: { id: VALID_USER_ID, name: 'M. Perez' },
      createdAt: '2026-07-15T12:30:00.000Z',
      updatedAt: '2026-07-15T12:30:00.000Z',
    };
    const result = SaleReadSchema.safeParse(wire);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(1500.5);
      expect(result.data.startAt).toBeInstanceOf(Date);
      expect(result.data.endAt).toBeInstanceOf(Date);
      expect(result.data.client.name).toBe('Acme Shipping S.A.');
      expect(result.data.port?.name).toBe('Puerto La Cruz');
      expect(result.data.driver?.name).toBe('J. Ramirez');
      expect(result.data.user?.name).toBe('M. Perez');
    }
  });

  it('parses a row with no port, driver, user or end time', () => {
    const result = SaleReadSchema.safeParse({
      id: '4f9c20de-58f5-4a3b-9b30-1c2d3e4f5a6b',
      nominationId: '9a8b7c6d-5e4f-4a3b-8c9d-0e1f2a3b4c5d',
      clientId: VALID_CLIENT_ID,
      serviceId: VALID_SERVICE_ID,
      price: '0.00',
      startAt: '2026-07-15T12:30:00.000Z',
      endAt: null,
      portId: null,
      port: null,
      driverId: null,
      driver: null,
      userId: null,
      user: null,
      client: { id: VALID_CLIENT_ID, name: 'Acme Shipping S.A.' },
      service: { id: VALID_SERVICE_ID, name: 'Launch / Boat Service' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endAt).toBeNull();
      expect(result.data.port).toBeNull();
      expect(result.data.driver).toBeNull();
      expect(result.data.user).toBeNull();
    }
  });
});
