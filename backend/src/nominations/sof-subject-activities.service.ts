import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { suggestSofSubjectActivity, type SofSubjectActivityInput } from '@portlog/schemas';

const select = { id: true, label: true, eventNames: true, active: true } as const;
@Injectable()
export class SofSubjectActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.sofSubjectActivity.findMany({
      where: includeInactive ? {} : { active: true },
      select,
      orderBy: { label: 'asc' },
    });
  }

  async options(nominationId: string) {
    const nomination = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      select: {
        sofTimesheet: {
          select: {
            entries: {
              select: { occurredAt: true, activity: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!nomination) throw new NotFoundException('Nomination not found.');
    const items = await this.list();
    return {
      items,
      suggestedId: suggestSofSubjectActivity(
        items,
        (nomination.sofTimesheet?.entries ?? []).map((e) => ({
          occurredAt: e.occurredAt,
          activityName: e.activity?.name ?? null,
        })),
      ),
    };
  }

  async save(input: SofSubjectActivityInput, id?: string) {
    if (
      id &&
      !(await this.prisma.sofSubjectActivity.findUnique({ where: { id }, select: { id: true } }))
    ) {
      throw new NotFoundException('Subject activity not found.');
    }
    try {
      return id
        ? await this.prisma.sofSubjectActivity.update({ where: { id }, data: input, select })
        : await this.prisma.sofSubjectActivity.create({ data: input, select });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A subject activity already uses that label.');
      }
      throw error;
    }
  }
}
