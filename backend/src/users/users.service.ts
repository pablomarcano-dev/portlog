import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Safe user fields — passwordHash is NEVER returned from this service.
// This is the only sanctioned way to fetch user records in application code.
export type SafeUser = {
  id: string;
  email: string;
  role: 'OPS' | 'ADM';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: SAFE_USER_SELECT,
    });
  }

  async findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });
  }

  /**
   * Internal-only: returns the passwordHash for bcrypt comparison during login.
   * Must NEVER be exposed via an API response.
   */
  async findHashByEmail(email: string): Promise<{ id: string; passwordHash: string } | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
  }
}
