import { SalesContactCreateSchema, SalesContactUpdateSchema } from '../sales-contact/index.js';

describe('SalesContactCreateSchema', () => {
  it('parses a name-only payload', () => {
    const result = SalesContactCreateSchema.safeParse({ name: 'J. Ramirez' });
    expect(result.success).toBe(true);
  });

  it('parses a full voucher contact', () => {
    const result = SalesContactCreateSchema.safeParse({
      name: 'J. Ramirez',
      phone: '+58 281 993 5081',
      mobile: '+58 414 085 8517',
      documentNumber: 'V-12345678',
      vehicle: 'AB123CD',
      comments: 'Day shift only',
    });
    expect(result.success).toBe(true);
  });

  it('fails when name is missing', () => {
    expect(SalesContactCreateSchema.safeParse({}).success).toBe(false);
  });

  it('fails when name is blank', () => {
    expect(SalesContactCreateSchema.safeParse({ name: '' }).success).toBe(false);
  });

  // optionalText: React Hook Form submits '' for untouched inputs, which must not
  // trip a min-length error on a field that was never required.
  it('treats blank optional fields as absent rather than invalid', () => {
    const result = SalesContactCreateSchema.safeParse({
      name: 'J. Ramirez',
      phone: '',
      mobile: '   ',
      documentNumber: '',
      vehicle: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeUndefined();
      expect(result.data.mobile).toBeUndefined();
      expect(result.data.vehicle).toBeUndefined();
    }
  });

  it('trims surrounding whitespace on optional text', () => {
    const result = SalesContactCreateSchema.safeParse({
      name: 'J. Ramirez',
      vehicle: '  AB123CD  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vehicle).toBe('AB123CD');
    }
  });

  it('rejects an over-long name', () => {
    expect(SalesContactCreateSchema.safeParse({ name: 'x'.repeat(121) }).success).toBe(false);
  });
});

describe('SalesContactUpdateSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(SalesContactUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a single-field update', () => {
    const result = SalesContactUpdateSchema.safeParse({ vehicle: 'XY789ZZ' });
    expect(result.success).toBe(true);
  });

  it('still rejects a blank name when name is supplied', () => {
    expect(SalesContactUpdateSchema.safeParse({ name: '' }).success).toBe(false);
  });
});
