import {
  LAUNCH_SERVICE_TYPE_LABELS,
  SERVICE_LOCATION_LABELS,
  SERVICE_REQUEST_TYPE_LABELS,
  ServiceRequestCreateSchema,
  ServiceRequestDetailsSchema,
  ServiceRequestSendReadinessSchema,
  ServiceRequestSendSchema,
  ServiceRequestUpdateSchema,
  formatControlNumber,
  requiresAuthorizationDocument,
  resolveServiceLabel,
  toSelectOptions,
} from '../index.js';

const CUID = 'ckv1a2b3c4d5e6f7g8h9i0j1';
const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

function baseCreate(details: unknown) {
  return {
    type: 'LAUNCH',
    shipParticularId: CUID,
    branchId: CUID,
    nominationId: UUID,
    scheduledAt: '2026-08-10T14:00:00.000Z',
    details,
  };
}

const LAUNCH_DETAILS = { type: 'LAUNCH', serviceType: 'MOORING_ASSISTANCE' };

describe('ServiceRequestDetailsSchema', () => {
  it('defaults boatCount to 1 for a launch request', () => {
    const parsed = ServiceRequestDetailsSchema.parse(LAUNCH_DETAILS);
    expect(parsed).toMatchObject({ type: 'LAUNCH', boatCount: 1 });
  });

  it('rejects a tug count above the four the spec allows', () => {
    const result = ServiceRequestDetailsSchema.safeParse({
      type: 'TUG',
      operationType: 'BERTHING',
      tugCount: 5,
    });
    expect(result.success).toBe(false);
  });

  it('requires a tank count on a ballast water analysis', () => {
    const result = ServiceRequestDetailsSchema.safeParse({
      type: 'BALLAST_WATER',
      analysisType: 'SAMPLING_LAB_D2',
    });
    expect(result.success).toBe(false);
  });

  it('discriminates on type so a launch payload cannot carry STS fields', () => {
    const result = ServiceRequestDetailsSchema.safeParse({
      type: 'LAUNCH',
      serviceType: 'MOORING_ASSISTANCE',
      ourRole: 'DISCHARGING',
    });
    // Unknown keys are stripped, not rejected — but the parsed value must not
    // carry the STS field through into storage.
    expect(result.success).toBe(true);
    expect(result.success && 'ourRole' in result.data).toBe(false);
  });

  it('defaults every STS checklist to unchecked', () => {
    const parsed = ServiceRequestDetailsSchema.parse({
      type: 'STS',
      targetVesselName: 'MT Contraparte',
      ourRole: 'RECEIVING',
      product: 'Crudo',
      quantity: 500_000,
    });
    expect(parsed).toMatchObject({
      quantityUnit: 'BBL',
      equipment: { fenders: false, hoses: false, reducers: false },
      spillPrevention: { floatingBarriers: false, watchBoat: false },
      personnel: { mooringMaster: false, connectionTechnicians: false },
    });
  });
});

describe('requiresAuthorizationDocument', () => {
  it.each([
    ['UNDERWATER_INSPECTION', { type: 'UNDERWATER_INSPECTION', inspectionType: 'SEA_CHESTS' }],
    ['BALLAST_WATER', { type: 'BALLAST_WATER', analysisType: 'VGP_COMPLIANCE', tankCount: 2 }],
    [
      'STS',
      {
        type: 'STS',
        targetVesselName: 'MT X',
        ourRole: 'DISCHARGING',
        product: 'Crudo',
        quantity: 1,
      },
    ],
  ])('always requires the authorisation letter for %s', (_label, details) => {
    expect(requiresAuthorizationDocument(details)).toBe(true);
  });

  it('never requires it for tugs or the general voucher', () => {
    expect(
      requiresAuthorizationDocument({ type: 'TUG', operationType: 'SHIFTING', tugCount: 2 }),
    ).toBe(false);
    expect(requiresAuthorizationDocument({ type: 'GENERAL' })).toBe(false);
  });

  it.each(['CREW_TRANSPORT', 'GARBAGE_MARPOL', 'ASSIGNED_PILOT_BOAT'])(
    'requires it for the launch service type %s',
    (serviceType) => {
      expect(requiresAuthorizationDocument({ type: 'LAUNCH', serviceType })).toBe(true);
    },
  );

  it.each(['MOORING_ASSISTANCE', 'SUPPLIES_SPARES', 'LEGAL_VISIT_BOAT', 'INSPECTION_BOAT'])(
    'does not require it for the unassigned launch service type %s',
    (serviceType) => {
      expect(requiresAuthorizationDocument({ type: 'LAUNCH', serviceType })).toBe(false);
    },
  );

  it('treats an unparseable draft payload as "not required" rather than throwing', () => {
    expect(requiresAuthorizationDocument({ type: 'LAUNCH' })).toBe(false);
    expect(requiresAuthorizationDocument(null)).toBe(false);
  });
});

describe('ServiceRequestCreateSchema', () => {
  it('accepts a minimal draft with no provider, port or billing', () => {
    const parsed = ServiceRequestCreateSchema.parse(baseCreate(LAUNCH_DETAILS));
    expect(parsed.scheduledAt).toBeInstanceOf(Date);
    expect(parsed.currency).toBe('VES');
    expect(parsed.supplierId).toBeNull();
  });

  it('normalises a cleared picker to null so a PATCH can actually unset the FK', () => {
    const parsed = ServiceRequestCreateSchema.parse({
      ...baseCreate(LAUNCH_DETAILS),
      supplierId: '',
      portId: '',
      billToClientId: '',
    });
    expect(parsed.supplierId).toBeNull();
    expect(parsed.portId).toBeNull();
    expect(parsed.billToClientId).toBeNull();
  });

  it('normalises an empty administrative assignment to null', () => {
    const parsed = ServiceRequestCreateSchema.parse({
      ...baseCreate({ type: 'GENERAL', route: 'Documents to bank' }),
      type: 'GENERAL',
      shipParticularId: '',
      nominationId: '',
    });
    expect(parsed.shipParticularId).toBeNull();
    expect(parsed.nominationId).toBeNull();
  });

  it('keeps a real nomination link', () => {
    const parsed = ServiceRequestCreateSchema.parse({
      ...baseCreate(LAUNCH_DETAILS),
      nominationId: UUID,
    });
    expect(parsed.nominationId).toBe(UUID);
  });

  it('requires branchId', () => {
    const payload: Record<string, unknown> = baseCreate(LAUNCH_DETAILS);
    delete payload['branchId'];
    expect(ServiceRequestCreateSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a negative cost', () => {
    const result = ServiceRequestCreateSchema.safeParse({
      ...baseCreate(LAUNCH_DETAILS),
      actualCost: -1,
    });
    expect(result.success).toBe(false);
  });

  it('upper-cases the currency code', () => {
    const parsed = ServiceRequestCreateSchema.parse({
      ...baseCreate(LAUNCH_DETAILS),
      currency: 'usd',
    });
    expect(parsed.currency).toBe('USD');
  });
});

describe('ServiceRequestUpdateSchema', () => {
  it('cannot change the request type', () => {
    const parsed = ServiceRequestUpdateSchema.parse({ type: 'TUG', notes: 'x' } as never);
    expect('type' in parsed).toBe(false);
  });

  it('accepts a partial patch of a single field', () => {
    const parsed = ServiceRequestUpdateSchema.parse({ physicalVoucherNo: '6009' });
    expect(parsed).toEqual({ physicalVoucherNo: '6009' });
  });
});

describe('ServiceRequestSendReadinessSchema', () => {
  const stsDetails = {
    type: 'STS',
    targetVesselName: 'MT X',
    ourRole: 'DISCHARGING',
    product: 'Crudo',
    quantity: 1,
  };

  it('blocks the send when no provider is selected', () => {
    const result = ServiceRequestSendReadinessSchema.safeParse({
      supplierId: null,
      details: { type: 'TUG', operationType: 'BERTHING', tugCount: 1 },
      documentCount: 0,
    });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.path).toEqual(['supplierId']);
  });

  it('blocks the send when a mandatory authorisation letter is missing', () => {
    const result = ServiceRequestSendReadinessSchema.safeParse({
      supplierId: CUID,
      details: stsDetails,
      documentCount: 0,
    });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.path).toEqual(['documentCount']);
  });

  it('passes once the letter is uploaded', () => {
    const result = ServiceRequestSendReadinessSchema.safeParse({
      supplierId: CUID,
      details: stsDetails,
      documentCount: 1,
    });
    expect(result.success).toBe(true);
  });

  it('passes with no documents when the type does not need one', () => {
    const result = ServiceRequestSendReadinessSchema.safeParse({
      supplierId: CUID,
      details: { type: 'TUG', operationType: 'BERTHING', tugCount: 1 },
      documentCount: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe('bilingual labels', () => {
  it('gives the UI English and the purchase order Spanish for the same code', () => {
    expect(LAUNCH_SERVICE_TYPE_LABELS.GARBAGE_MARPOL).toEqual({
      en: 'Garbage Landing (MARPOL)',
      es: 'Desembarque de Basura (MARPOL)',
    });
  });

  it('resolves provider-facing service descriptions in Spanish without changing the UI default', () => {
    const tug = { type: 'TUG', operationType: 'BERTHING', tugCount: 2 };
    const ballast = { type: 'BALLAST_WATER', analysisType: 'VGP_COMPLIANCE', tankCount: 1 };

    expect(resolveServiceLabel(tug)).toBe('Berthing (Inbound) (×2)');
    expect(resolveServiceLabel(tug, 'es')).toBe('Atraque (Entrada) (×2)');
    expect(resolveServiceLabel(ballast, 'es')).toContain('1 tanque');
  });

  it('builds Select options from the English side, in declaration order', () => {
    const options = toSelectOptions(SERVICE_REQUEST_TYPE_LABELS);
    expect(options[0]).toEqual({ value: 'LAUNCH', label: 'Launch Boat Services' });
    expect(options.map((o) => o.value)).toEqual([
      'LAUNCH',
      'UNDERWATER_INSPECTION',
      'BALLAST_WATER',
      'TUG',
      'STS',
      'GENERAL',
    ]);
  });

  it('carries both languages for every enum member', () => {
    for (const labels of [
      SERVICE_REQUEST_TYPE_LABELS,
      SERVICE_LOCATION_LABELS,
      LAUNCH_SERVICE_TYPE_LABELS,
    ]) {
      for (const [key, label] of Object.entries(labels)) {
        expect({ key, en: Boolean(label.en), es: Boolean(label.es) }).toEqual({
          key,
          en: true,
          es: true,
        });
      }
    }
  });
});

describe('error messages', () => {
  /** Pull the message Zod would surface under a given field path. */
  function messageFor(
    result: {
      success: boolean;
      error?: { issues: Array<{ path: (string | number)[]; message: string }> };
    },
    path: string,
  ) {
    return result.error?.issues.find((i) => i.path.join('.') === path)?.message;
  }

  it('names the field on a missing branch', () => {
    const payload: Record<string, unknown> = baseCreate(LAUNCH_DETAILS);
    delete payload['branchId'];
    const result = ServiceRequestCreateSchema.safeParse(payload);
    expect(messageFor(result, 'branchId')).toBe('Select a branch');
  });

  it('explains a missing scheduled datetime', () => {
    const payload: Record<string, unknown> = baseCreate(LAUNCH_DETAILS);
    delete payload['scheduledAt'];
    const result = ServiceRequestCreateSchema.safeParse(payload);
    expect(messageFor(result, 'scheduledAt')).toBe('Enter the scheduled date and time');
  });

  it("explains a negative cost in the field's own words", () => {
    const result = ServiceRequestCreateSchema.safeParse({
      ...baseCreate(LAUNCH_DETAILS),
      actualCost: -1,
    });
    expect(messageFor(result, 'actualCost')).toBe('Actual cost cannot be negative');
  });

  it('explains a bad currency code', () => {
    const result = ServiceRequestCreateSchema.safeParse({
      ...baseCreate(LAUNCH_DETAILS),
      currency: 'BOLIVAR',
    });
    expect(messageFor(result, 'currency')).toBe(
      'Currency must be a 3-letter code, e.g. VES or USD',
    );
  });

  it('says "Select a …" for a cleared dropdown instead of listing enum members', () => {
    const result = ServiceRequestCreateSchema.safeParse({
      ...baseCreate({ type: 'LAUNCH' }),
    });
    expect(messageFor(result, 'details.serviceType')).toBe('Select a launch service type');
  });

  it('names the tug cap rather than reporting a bare max', () => {
    const result = ServiceRequestDetailsSchema.safeParse({
      type: 'TUG',
      operationType: 'BERTHING',
      tugCount: 5,
    });
    expect(messageFor(result, 'tugCount')).toBe(
      'No more than 4 tugs may be ordered on one request',
    );
  });

  it('asks for the tank count in plain words', () => {
    const result = ServiceRequestDetailsSchema.safeParse({
      type: 'BALLAST_WATER',
      analysisType: 'SAMPLING_LAB_D2',
    });
    expect(messageFor(result, 'tankCount')).toBe('Enter how many tanks are to be inspected');
  });

  it('names each missing STS field', () => {
    const result = ServiceRequestDetailsSchema.safeParse({ type: 'STS' });
    expect(messageFor(result, 'targetVesselName')).toBe('Enter the target vessel name');
    expect(messageFor(result, 'product')).toBe('Enter the product being transferred');
    expect(messageFor(result, 'quantity')).toBe('Enter the quantity to be transferred');
    expect(messageFor(result, 'ourRole')).toBe('Select the role our vessel plays');
  });

  it('rejects a bad recipient address by name', () => {
    const result = ServiceRequestSendSchema.safeParse({ toAddresses: ['not-an-address'] });
    expect(messageFor(result, 'toAddresses.0')).toBe(
      'Recipients contains an address that is not valid',
    );
  });

  it('requires at least one recipient', () => {
    const result = ServiceRequestSendSchema.safeParse({ toAddresses: [] });
    expect(messageFor(result, 'toAddresses')).toBe('Add at least one recipient');
  });
});

describe('formatControlNumber', () => {
  it('renders the reference the agency writes on the provider slip', () => {
    expect(formatControlNumber(1234, new Date('2026-03-01T00:00:00Z'), 'PLC')).toBe(
      'SN1234/26/PLC',
    );
  });

  it('takes the year from UTC, not the server timezone', () => {
    // 31 Dec 2025 21:00 in UTC-3 is already 2026 in UTC — the stored year wins.
    expect(formatControlNumber(7, new Date('2026-01-01T00:30:00Z'), 'JSE')).toBe('SN0007/26/JSE');
  });

  it('uses four digits as a minimum without truncating larger correlatives', () => {
    const createdAt = new Date('2026-03-01T00:00:00Z');

    expect(formatControlNumber(1, createdAt, 'MVD')).toBe('SN0001/26/MVD');
    expect(formatControlNumber(12345, createdAt, 'MVD')).toBe('SN12345/26/MVD');
  });
});

describe('resolveServiceLabel', () => {
  it('names the launch service and its boat count', () => {
    expect(
      resolveServiceLabel({ type: 'LAUNCH', serviceType: 'GARBAGE_MARPOL', boatCount: 2 }),
    ).toBe('Garbage Landing (MARPOL) (×2)');
  });

  it('omits the multiplier for a single boat', () => {
    expect(resolveServiceLabel({ type: 'LAUNCH', serviceType: 'GARBAGE_MARPOL' })).toBe(
      'Garbage Landing (MARPOL)',
    );
  });

  it('names the STS counterparty', () => {
    expect(
      resolveServiceLabel({
        type: 'STS',
        targetVesselName: 'MT Contraparte',
        ourRole: 'RECEIVING',
        product: 'Crudo',
        quantity: 1,
      }),
    ).toBe('Receiving Vessel — MT Contraparte');
  });

  it('falls back to an em dash for a payload it cannot parse', () => {
    expect(resolveServiceLabel({ type: 'LAUNCH' })).toBe('—');
  });
});
