import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SupplierCreateInput, SupplierUpdateInput, SupplierListQuery } from '@portlog/schemas';

// All fields returned by every query — keeps select clauses DRY.
const SUPPLIER_SELECT = {
  id: true,
  name: true,
  contactos: true,
  direccion: true,
  servicios: true,
  kyc: true,
  telefonos: true,
  correosElectronicos: true,
  certificados: true,
  tarifas: true,
  contratoDeServicios: true,
  acuerdos: true,
  comments: true,
} as const;

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: SupplierListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.supplier.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: q
        ? {
            name: {
              contains: q,
              mode: 'insensitive',
            },
          }
        : undefined,
      orderBy: { name: 'asc' },
      select: SUPPLIER_SELECT,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((s) => ({ ...s, label: s.name })),
      nextCursor,
      hasMore,
    };
  }

  async getById(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      select: SUPPLIER_SELECT,
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier ${id} not found.`);
    }

    return supplier;
  }

  async create(input: SupplierCreateInput) {
    try {
      return await this.prisma.supplier.create({
        data: input,
        select: SUPPLIER_SELECT,
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A supplier named "${input.name}" already exists.`);
      }
      throw err;
    }
  }

  async update(id: string, input: SupplierUpdateInput) {
    await this.assertExists(id);
    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: input,
        select: SUPPLIER_SELECT,
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A supplier named "${input.name ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.supplier.delete({ where: { id } });
    this.logger.log({ event: 'suppliers.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.supplier.findMany({
      take: 20,
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((s) => ({ id: s.id, label: s.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.supplier.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Supplier ${id} not found.`);
    }
  }

  private isPrismaUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    );
  }
}
