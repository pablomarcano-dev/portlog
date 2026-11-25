import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, type JwtPayload } from './jwt.strategy.js';
import type { UsersService, SafeUser } from '../users/users.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const user = {
  id: 'agent',
  email: 'agent@example.com',
  role: 'OPS',
  isActive: true,
  permissions: [],
  branchId: 'plc',
  branchAssignments: [],
} as unknown as SafeUser;
const payload: JwtPayload = {
  sub: 'agent',
  email: 'old@example.com',
  role: 'ADM',
  permissions: ['owner.financial'],
  branchId: 'plc',
};
describe('current persisted JWT principal', () => {
  const findById = jest.fn();
  const findUnique = jest.fn();
  const strategy = new JwtStrategy(
    { get: () => 'test-secret' } as unknown as ConfigService,
    { findById } as unknown as UsersService,
    { branch: { findUnique } } as unknown as PrismaService,
  );
  beforeEach(() => {
    findById.mockResolvedValue(user);
    findUnique.mockResolvedValue({ id: 'plc' });
  });
  it('uses current identity/permissions instead of stale token privileges', async () => {
    expect(await strategy.validate(payload)).toMatchObject({
      email: user.email,
      role: 'OPS',
      permissions: [],
      branchId: 'plc',
    });
  });
  it('rejects inactive or deleted users', async () => {
    findById.mockResolvedValue({ ...user, isActive: false });
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    findById.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
  it('rejects a revoked branch assignment and a deleted branch', async () => {
    await expect(strategy.validate({ ...payload, branchId: 'other' })).rejects.toThrow();
    findUnique.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
