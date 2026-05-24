import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { FleetEntry } from '@portlog/schemas';

const ZARPE_PRUNE_TTL_MS = 15 * 24 * 60 * 60 * 1000;

function toEntry(v: {
  imo: string;
  name: string | null;
  addedAt: Date;
  departureSince: Date | null;
}): FleetEntry {
  return {
    imo: v.imo,
    ...(v.name != null ? { name: v.name } : {}),
    addedAt: v.addedAt.getTime(),
    ...(v.departureSince != null ? { departureSince: v.departureSince.getTime() } : {}),
  };
}

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, unlocode: string): Promise<FleetEntry[]> {
    // Prune stale zarpe entries on every list call
    const cutoff = new Date(Date.now() - ZARPE_PRUNE_TTL_MS);
    await this.prisma.fleetVessel.deleteMany({
      where: { userId, portUnlocode: unlocode, departureSince: { lt: cutoff } },
    });

    const rows = await this.prisma.fleetVessel.findMany({
      where: { userId, portUnlocode: unlocode },
      orderBy: { addedAt: 'asc' },
      select: { imo: true, name: true, addedAt: true, departureSince: true },
    });

    return rows.map(toEntry);
  }

  async addMany(userId: string, unlocode: string, imos: string[]): Promise<FleetEntry[]> {
    const now = new Date();
    await this.prisma.fleetVessel.createMany({
      data: imos.map((imo) => ({
        id: crypto.randomUUID(),
        userId,
        portUnlocode: unlocode,
        imo,
        addedAt: now,
      })),
      skipDuplicates: true,
    });

    const rows = await this.prisma.fleetVessel.findMany({
      where: { userId, portUnlocode: unlocode, imo: { in: imos } },
      select: { imo: true, name: true, addedAt: true, departureSince: true },
    });

    return rows.map(toEntry);
  }

  async remove(userId: string, unlocode: string, imo: string): Promise<void> {
    await this.prisma.fleetVessel.deleteMany({
      where: { userId, portUnlocode: unlocode, imo },
    });
  }

  async clear(userId: string, unlocode: string): Promise<void> {
    await this.prisma.fleetVessel.deleteMany({
      where: { userId, portUnlocode: unlocode },
    });
  }

  async updateZarpe(
    userId: string,
    unlocode: string,
    imo: string,
    departureSince: number | null,
  ): Promise<void> {
    await this.prisma.fleetVessel.updateMany({
      where: { userId, portUnlocode: unlocode, imo },
      data: { departureSince: departureSince != null ? new Date(departureSince) : null },
    });
  }
}
