import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import * as bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Minimal mocks
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-cuid-1',
  email: 'ops@portlog.test',
  role: 'OPS' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
};

const mockRefreshToken = {
  id: 'rt-cuid-1',
  userId: mockUser.id,
  tokenHash: 'somehash',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  createdAt: new Date(),
  userAgent: 'jest',
  ip: '127.0.0.1',
  user: mockUser,
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockUsersService = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'JWT_REFRESH_TTL_DAYS') return '30';
    return undefined;
  }),
};

const mockAuditService = {
  record: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // -------------------------------------------------------------------------
  // login — happy path
  // -------------------------------------------------------------------------
  describe('login', () => {
    it('returns loginResponse + rawRefreshToken on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        passwordHash: await bcrypt.hash('password123', 12),
        isActive: true,
      });
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue(mockRefreshToken);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.login('ops@portlog.test', 'password123', {
        email: 'ops@portlog.test',
        ip: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(result).not.toBeNull();
      expect(result?.loginResponse.accessToken).toBe('mock.jwt.token');
      expect(result?.loginResponse.user.email).toBe(mockUser.email);
      expect(result?.rawRefreshToken).toBeDefined();
      // Raw token must be a 64-char hex string (32 bytes)
      expect(result?.rawRefreshToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns null on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        passwordHash: await bcrypt.hash('correct-password', 12),
        isActive: true,
      });

      const result = await service.login('ops@portlog.test', 'wrong-password', {
        email: 'ops@portlog.test',
        ip: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(result).toBeNull();
    });

    it('returns null on unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.login('notfound@portlog.test', 'password123', {
        email: 'notfound@portlog.test',
        ip: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(result).toBeNull();
    });

    it('returns null for inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        passwordHash: await bcrypt.hash('password123', 12),
        isActive: false,
      });

      const result = await service.login('ops@portlog.test', 'password123', {
        email: 'ops@portlog.test',
        ip: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // refresh — rotation
  // -------------------------------------------------------------------------
  describe('refresh', () => {
    it('rotates tokens on valid refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockRefreshToken);
      mockPrisma.refreshToken.update.mockResolvedValue({
        ...mockRefreshToken,
        revokedAt: new Date(),
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ ...mockRefreshToken, id: 'rt-cuid-2' });

      const result = await service.refresh('a'.repeat(64), { ip: '127.0.0.1', userAgent: 'jest' });

      expect(result.refreshResponse.accessToken).toBe('mock.jwt.token');
      expect(result.rawRefreshToken).toMatch(/^[0-9a-f]{64}$/);
      // Old token must have been revoked
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockRefreshToken.id } }),
      );
    });

    it('throws 401 on unknown refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.refresh('unknowntoken', { ip: '127.0.0.1', userAgent: 'jest' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('detects reuse of revoked token and revokes entire session', async () => {
      const revokedRecord = { ...mockRefreshToken, revokedAt: new Date(Date.now() - 1000) };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(revokedRecord);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(
        service.refresh('revokedtoken', { ip: '127.0.0.1', userAgent: 'jest' }),
      ).rejects.toThrow(UnauthorizedException);

      // All active tokens for the user must have been revoked
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id, revokedAt: null },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });

    it('throws 401 on expired refresh token', async () => {
      const expiredRecord = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(expiredRecord);

      await expect(
        service.refresh('expiredtoken', { ip: '127.0.0.1', userAgent: 'jest' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
