import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PierCreateInput, PierUpdateInput } from '@portlog/schemas';

@Injectable()
export class PiersService {
  constructor(private readonly prisma: PrismaService) {}

  async listByPort(portId: string) {
    await this.assertPortExists(portId);
    return this.prisma.pier.findMany({
      where: { portId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, portId: true },
    });
  }

  async create(input: PierCreateInput) {
    await this.assertPortExists(input.portId);
    return this.prisma.pier.create({
      data: { name: input.name, portId: input.portId },
      select: { id: true, name: true, portId: true },
    });
  }

  async update(id: string, input: PierUpdateInput) {
    await this.assertPierExists(id);
    return this.prisma.pier.update({
      where: { id },
      data: { name: input.name },
      select: { id: true, name: true, portId: true },
    });
  }

  async remove(id: string) {
    await this.assertPierExists(id);
    await this.prisma.pier.delete({ where: { id } });
  }

  private async assertPortExists(portId: string) {
    const port = await this.prisma.port.findUnique({ where: { id: portId }, select: { id: true } });
    if (!port) throw new NotFoundException(`Port ${portId} not found.`);
  }

  private async assertPierExists(id: string) {
    const pier = await this.prisma.pier.findUnique({ where: { id }, select: { id: true } });
    if (!pier) throw new NotFoundException(`Pier ${id} not found.`);
  }
}
