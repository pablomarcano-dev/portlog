import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  EmailGroupCreateInput,
  EmailGroupUpdateInput,
  EmailGroupListQuery,
} from '@portlog/schemas';

const MEMBER_SELECT = { id: true, email: true, displayName: true, order: true };

@Injectable()
export class EmailGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: EmailGroupListQuery) {
    const { search, page, pageSize } = query;
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.emailGroup.findMany({
        where,
        include: { _count: { select: { members: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.emailGroup.count({ where }),
    ]);
    return {
      items: items.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        memberCount: g._count.members,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string) {
    const group = await this.prisma.emailGroup.findUnique({
      where: { id },
      include: { members: { select: MEMBER_SELECT, orderBy: { order: 'asc' } } },
    });
    if (!group) throw new NotFoundException(`EmailGroup ${id} not found`);
    return group;
  }

  async create(dto: EmailGroupCreateInput) {
    const { members, ...rest } = dto;
    return this.prisma.emailGroup.create({
      data: {
        ...rest,
        members: { create: members.map((m, i) => ({ ...m, order: m.order ?? i })) },
      },
      include: { members: { select: MEMBER_SELECT, orderBy: { order: 'asc' } } },
    });
  }

  async update(id: string, dto: EmailGroupUpdateInput) {
    await this.getById(id);
    const { members, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      if (members !== undefined) {
        await tx.emailGroupMember.deleteMany({ where: { emailGroupId: id } });
        if (members.length > 0) {
          await tx.emailGroupMember.createMany({
            data: members.map((m, i) => ({ ...m, order: m.order ?? i, emailGroupId: id })),
          });
        }
      }
      return tx.emailGroup.update({
        where: { id },
        data: rest,
        include: { members: { select: MEMBER_SELECT, orderBy: { order: 'asc' } } },
      });
    });
  }

  async remove(id: string) {
    await this.getById(id);
    return this.prisma.emailGroup.delete({ where: { id } });
  }
}
