import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

// Safe user fields — passwordHash is NEVER returned from this service.
// This is the only sanctioned way to fetch user records in application code.
export type SafeUser = {
  id: string;
  email: string;
  displayName: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  role: 'OPS' | 'ADM';
  isActive: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  phone: true,
  mobile: true,
  fax: true,
  role: true,
  isActive: true,
  permissions: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
} as const;

export type CreateUserDto = {
  email: string;
  displayName?: string;
  password: string;
  role: 'OPS' | 'ADM';
};

export type UpdateUserDto = {
  displayName?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  role?: 'OPS' | 'ADM';
  isActive?: boolean;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

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

  // ── Admin operations ──────────────────────────────────────────────────────

  async list(): Promise<SafeUser[]> {
    return this.prisma.user.findMany({
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email,
        displayName: dto.displayName ?? null,
        passwordHash,
        role: dto.role,
      },
      select: SAFE_USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    await this.requireExists(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.mobile !== undefined ? { mobile: dto.mobile } : {}),
        ...(dto.fax !== undefined ? { fax: dto.fax } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: SAFE_USER_SELECT,
    });
  }

  async delete(id: string, requestingUserId: string): Promise<void> {
    if (id === requestingUserId) {
      throw new ForbiddenException('You cannot delete your own account.');
    }
    await this.requireExists(id);
    // Revoke all sessions before deleting so tokens are immediately invalid.
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.user.delete({ where: { id } });
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await this.requireExists(id);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    // Revoke all active sessions so the user must log in with the new password.
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /**
   * Generates a random temporary password, sets it, and emails the user their
   * credentials. Used for initial account setup or locked-out recovery.
   */
  async sendCredentials(id: string): Promise<void> {
    const user = await this.requireExists(id);

    const tempPassword = randomBytes(6).toString('hex'); // 12-char hex
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });

    await this.emailService.send({
      to: [user.email],
      subject: 'Your Portlog credentials',
      html: credentialsEmailHtml(user.email, tempPassword),
    });
  }

  private async requireExists(id: string): Promise<SafeUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }
}

function credentialsEmailHtml(email: string, password: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1c7ed6;">Portlog — Your login credentials</h2>
      <p>Your account has been set up. Use the details below to log in:</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #555;">Email</td>
          <td style="padding: 8px;">${email}</td>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px; font-weight: bold; color: #555;">Temporary password</td>
          <td style="padding: 8px; font-family: monospace; font-size: 16px;">${password}</td>
        </tr>
      </table>
      <p style="margin-top: 24px; color: #868e96; font-size: 13px;">
        Please change your password after your first login.
      </p>
    </div>
  `;
}
