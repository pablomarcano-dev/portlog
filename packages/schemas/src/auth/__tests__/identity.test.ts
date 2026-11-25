import { LoginIdentifierSchema, OptionalUsernameSchema, UsernameSchema } from '../identity';
import { LoginRequestSchema } from '../index';
import { CreateUserSchema, UpdateUserSchema } from '../../admin';

describe('personal login identifiers', () => {
  it('normalizes personal usernames before storage and lookup', () => {
    expect(UsernameSchema.parse('  Jose.Romero-PLC_1 ')).toBe('jose.romero-plc_1');
    expect(LoginIdentifierSchema.parse('  Jose.Romero-PLC_1 ')).toBe('jose.romero-plc_1');
  });

  it('keeps existing email login compatible with normalized matching', () => {
    expect(LoginIdentifierSchema.parse('  Agent@Navieramar.com ')).toBe('agent@navieramar.com');
  });

  it.each(['', 'ab', 'a'.repeat(65), 'jose romero', 'jose@navieramar.com', '../jose'])(
    'rejects invalid username %j',
    (value) => {
      expect(UsernameSchema.safeParse(value).success).toBe(false);
    },
  );

  it.each(['', 'ab', 'jose romero', 'jose@', 'name@example.com@other.com'])(
    'rejects invalid login identifier %j',
    (value) => {
      expect(LoginIdentifierSchema.safeParse(value).success).toBe(false);
    },
  );

  it('permits legacy accounts without usernames and explicit username removal', () => {
    expect(OptionalUsernameSchema.parse(undefined)).toBeUndefined();
    expect(OptionalUsernameSchema.parse(null)).toBeNull();
    expect(OptionalUsernameSchema.parse('   ')).toBeNull();
    expect(OptionalUsernameSchema.parse(' JRomero ')).toBe('jromero');
  });

  it('accepts personal username and legacy email login using the existing request field', () => {
    expect(LoginRequestSchema.parse({ email: ' JRomero ', password: 'strong-password' })).toEqual({
      email: 'jromero',
      password: 'strong-password',
    });
    expect(
      LoginRequestSchema.parse({ email: ' Agent@Navieramar.com ', password: 'strong-password' })
        .email,
    ).toBe('agent@navieramar.com');
  });

  it('normalizes optional admin assignments while preserving accounts without usernames', () => {
    const account = { email: 'agent@navieramar.com', password: 'strong-password', role: 'OPS' };
    expect(CreateUserSchema.parse(account)).not.toHaveProperty('username');
    expect(CreateUserSchema.parse({ ...account, username: ' JRomero ' }).username).toBe('jromero');
    expect(UpdateUserSchema.parse({ username: '   ' })).toEqual({ username: null });
    expect(UpdateUserSchema.parse({ displayName: 'José' })).not.toHaveProperty('username');
  });
});
