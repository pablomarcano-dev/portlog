import type { UserOperationalRole } from '@portlog/schemas';
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { Role } from '@portlog/schemas';

// Safe user fields — passwordHash is NEVER returned from this service.
// This is the only sanctioned way to fetch user records in application code.
export type SafeUser = {
  id: string;
  email: string;
  username?: string | null;
  displayName: string | null;
  jobTitle: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  role: Role;
  operationalRole: UserOperationalRole | null;
  isActive: boolean;
  permissions: string[];
  branchId: string | null;
  branchAssignments?: { branchId: string; branch: { id: string; name: string; code: string } }[];
  /** Joined for the control-number prefix; null when no branch is assigned. */
  branch: { id: string; name: string; code: string } | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  jobTitle: true,
  phone: true,
  mobile: true,
  fax: true,
  role: true,
  operationalRole: true,
  isActive: true,
  permissions: true,
  // Default Sucursal — pre-fills the service-request forms and is returned by
  // /auth/me alongside the branch code the control number is built from.
  branchId: true,
  branchAssignments: {
    select: { branchId: true, branch: { select: { id: true, name: true, code: true } } },
  },
  branch: { select: { id: true, name: true, code: true } },
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
} as const;

export type CreateUserDto = {
  email: string;
  username?: string | null;
  displayName?: string;
  password: string;
  role: Role;
  operationalRole?: UserOperationalRole | null;
  branchId?: string | null;
  branchIds?: string[];
};

export type UpdateUserDto = {
  username?: string | null;
  displayName?: string;
  jobTitle?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  role?: Role;
  operationalRole?: UserOperationalRole | null;
  isActive?: boolean;
  branchId?: string | null;
  branchIds?: string[];
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
    const users = await this.prisma.user.findMany({
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return users.map((user) => ({
      ...user,
      branchIds: [
        ...new Set([
          ...(user.branchId ? [user.branchId] : []),
          ...user.branchAssignments.map((a) => a.branchId),
        ]),
      ],
    }));
  }

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }

    if (dto.username) {
      const duplicate = await this.prisma.user.findUnique({
        where: { username: dto.username.trim().toLowerCase() },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('A user with this username already exists.');
    }
    await this.validateBranches(dto.branchId ?? null, dto.branchIds);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email,
        username: dto.username?.trim().toLowerCase() || null,
        branchAssignments: dto.branchIds
          ? { create: [...new Set(dto.branchIds)].map((branchId) => ({ branchId })) }
          : undefined,
        displayName: dto.displayName ?? null,
        passwordHash,
        role: dto.role,
        operationalRole: dto.operationalRole ?? null,
        branchId: dto.branchId ?? null,
      },
      select: SAFE_USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const existing = await this.requireExists(id);
    if (dto.username) {
      const duplicate = await this.prisma.user.findUnique({
        where: { username: dto.username.trim().toLowerCase() },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== id)
        throw new ConflictException('A user with this username already exists.');
    }
    const primary = dto.branchId !== undefined ? dto.branchId : existing.branchId;
    await this.validateBranches(primary, dto.branchIds);
    // A changed identity/access assignment requires a fresh refresh session.
    if (
      dto.role !== undefined ||
      dto.branchId !== undefined ||
      dto.branchIds !== undefined ||
      dto.isActive !== undefined
    ) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.username !== undefined
          ? { username: dto.username?.trim().toLowerCase() || null }
          : {}),
        ...(dto.branchIds !== undefined
          ? {
              branchAssignments: {
                deleteMany: {},
                create: [...new Set(dto.branchIds)].map((branchId) => ({ branchId })),
              },
            }
          : {}),
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.mobile !== undefined ? { mobile: dto.mobile } : {}),
        ...(dto.fax !== undefined ? { fax: dto.fax } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.operationalRole !== undefined ? { operationalRole: dto.operationalRole } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
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

  private async validateBranches(primary: string | null, branchIds?: string[]): Promise<void> {
    if (
      branchIds !== undefined &&
      branchIds.length > 0 &&
      (!primary || !branchIds.includes(primary))
    ) {
      throw new BadRequestException('Select one primary branch from the assigned branches.');
    }
    if (branchIds !== undefined && branchIds.length === 0 && primary) {
      throw new BadRequestException('The primary branch must be assigned.');
    }
    const ids = [...new Set([...(primary ? [primary] : []), ...(branchIds ?? [])])];
    if (
      ids.length &&
      (await this.prisma.branch.count({ where: { id: { in: ids } } })) !== ids.length
    ) {
      throw new BadRequestException('One or more selected branches do not exist.');
    }
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
