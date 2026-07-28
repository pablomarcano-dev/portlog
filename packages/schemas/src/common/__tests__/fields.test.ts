import { optionalText, optionalUrl, optionalCuid, emailList, parseEmailList } from '../fields';
import { OwnerCreateSchema } from '../../master-data/owner';
import { ShipperCreateSchema } from '../../master-data/shipper';
import { EmailGroupCreateSchema } from '../../master-data/email-group';

describe('optionalText', () => {
  const schema = optionalText(50);

  it('accepts an empty string as "not provided"', () => {
    // The regression from `nuevo sysportlog.pdf`: RHF submits "" for untouched inputs, and the old
    // `z.string().min(1).optional()` rejected it with "String must contain at least 1 character(s)".
    const result = schema.safeParse('');
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBeUndefined();
  });

  it('treats a whitespace-only string as absent', () => {
    const result = schema.safeParse('   ');
    expect(result.success && result.data).toBeUndefined();
  });

  it('keeps and trims a real value', () => {
    const result = schema.safeParse('  Puerto La Cruz  ');
    expect(result.success && result.data).toBe('Puerto La Cruz');
  });

  it('still enforces the max length', () => {
    expect(schema.safeParse('x'.repeat(51)).success).toBe(false);
  });
});

describe('optionalUrl / optionalCuid', () => {
  it('lets a blank url through instead of reporting "Invalid url"', () => {
    expect(optionalUrl().safeParse('').success).toBe(true);
  });

  it('still rejects a malformed url', () => {
    expect(optionalUrl().safeParse('not-a-url').success).toBe(false);
  });

  it('lets a cleared picker send an empty string', () => {
    expect(optionalCuid().safeParse('').success).toBe(true);
  });
});

describe('parseEmailList', () => {
  it('splits on commas, semicolons and whitespace alike', () => {
    expect(parseEmailList('a@x.com, b@x.com; c@x.com d@x.com')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
      'd@x.com',
    ]);
  });

  it('splits a newline-separated paste', () => {
    expect(parseEmailList('a@x.com\nb@x.com\r\nc@x.com')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
    ]);
  });

  it('unwraps "Display Name <addr>"', () => {
    expect(parseEmailList('Franklin Graterol <fg@example.com>')).toEqual(['fg@example.com']);
  });

  it('lowercases and de-duplicates', () => {
    expect(parseEmailList('A@X.com, a@x.com')).toEqual(['a@x.com']);
  });

  it('returns nothing for blank input', () => {
    expect(parseEmailList('   ')).toEqual([]);
  });
});

describe('emailList', () => {
  const schema = emailList();

  it('accepts a comma-separated blob — the exact shape that used to fail', () => {
    const result = schema.safeParse(
      'logisticapv@pdvsa.com.ve, logisticadefamipuerto@gmail.com, pemuydcp@pdvsa.com.ve',
    );
    expect(result.success).toBe(true);
    expect(result.success && result.data).toHaveLength(3);
  });

  it('accepts a plain array', () => {
    const result = schema.safeParse(['a@x.com', 'b@x.com']);
    expect(result.success && result.data).toEqual(['a@x.com', 'b@x.com']);
  });

  it('expands a single array entry that holds several addresses', () => {
    const result = schema.safeParse(['a@x.com, b@x.com']);
    expect(result.success && result.data).toEqual(['a@x.com', 'b@x.com']);
  });

  it('rejects an entry that is not an address', () => {
    expect(schema.safeParse(['not-an-email']).success).toBe(false);
  });

  it('maps absent to undefined so partial updates leave the column alone', () => {
    const result = schema.safeParse(undefined);
    expect(result.success && result.data).toBeUndefined();
  });

  it('accepts an explicit empty array, which clears the field', () => {
    expect(schema.safeParse([]).success).toBe(true);
  });
});

describe('master-data forms accept a name-only record', () => {
  it('saves an Owner with only a name — the PDF’s blocker', () => {
    const result = OwnerCreateSchema.safeParse({
      name: 'Fortitude Shipping Navigation S.A.',
      physicalAddress: '',
      address: '',
      phones: '',
      contactNumber: '',
      contactList: '',
      birthday: '',
      webpage: '',
    });
    expect(result.success).toBe(true);
  });

  it('saves a Shipper with several addresses and no phone or fax', () => {
    const result = ShipperCreateSchema.safeParse({
      name: 'PDVSA PETROLEOS S.A.',
      emails: 'a@pdvsa.com.ve, b@pdvsa.com.ve',
      businessPhone: '',
      businessFax: '',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.emails).toHaveLength(2);
  });
});

describe('EmailGroupCreateSchema', () => {
  it('drops a blank member row instead of failing the whole save', () => {
    const result = EmailGroupCreateSchema.safeParse({
      name: 'Reliance Industries Limited',
      members: [
        { email: 'ops@ril.com', order: 0 },
        { email: '', order: 1 }, // what "+ Add row" seeds
      ],
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.members).toHaveLength(1);
  });

  it('still rejects a member row containing a malformed address', () => {
    const result = EmailGroupCreateSchema.safeParse({
      name: 'Group',
      members: [{ email: 'nonsense', order: 0 }],
    });
    expect(result.success).toBe(false);
  });
});
