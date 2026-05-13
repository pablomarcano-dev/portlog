import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AuditEvent } from '@prisma/client';
import { OwnersService } from './owners.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';

// ---------------------------------------------------------------------------
// Minimal mocks
// ---------------------------------------------------------------------------

const mockOwnerBase = {
  id: 'owner-cuid-1',
  nombre: 'Armadores SA',
  listadoContacto: null,
  cantidad: null,
  numeroContacto: null,
  direccionFisica: '1 Port Ave',
  telefonos: '+1 555 0100',
  direccion: null,
  cargo: null,
  redesSociales: null,
  comentarios: null,
  cumpleanos: null,
  gustos: null,
  recomendaciones: null,
  business: null,
  webpage: null,
  acuerdos: 'Confidential agreement text',
  historyJson: { buques: [] },
  comments: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  owner: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockAudit = {
  record: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OwnersService', () => {
  let service: OwnersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<OwnersService>(OwnersService);
  });

  // -------------------------------------------------------------------------
  // findById — financial permission gate
  // -------------------------------------------------------------------------
  describe('findById', () => {
    it('strips acuerdos and historyJson when caller lacks owner.financial', async () => {
      mockPrisma.owner.findUnique.mockResolvedValue(mockOwnerBase);

      const result = await service.findById('owner-cuid-1', []);

      expect(result).not.toHaveProperty('acuerdos');
      expect(result).not.toHaveProperty('historyJson');
      expect((result as { nombre: string }).nombre).toBe('Armadores SA');
    });

    it('returns the full owner record when caller has owner.financial', async () => {
      mockPrisma.owner.findUnique.mockResolvedValue(mockOwnerBase);

      const result = await service.findById('owner-cuid-1', ['owner.financial']);

      expect(result).toHaveProperty('acuerdos', 'Confidential agreement text');
      expect(result).toHaveProperty('historyJson');
    });
  });

  // -------------------------------------------------------------------------
  // update — sensitive field guard
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('throws ForbiddenException when updating a sensitive field without owner.financial', async () => {
      mockPrisma.owner.findUnique.mockResolvedValue({ id: 'owner-cuid-1' });
      mockAudit.record.mockResolvedValue(undefined);

      await expect(
        service.update('owner-cuid-1', { acuerdos: 'new agreement' }, [], { userId: 'user-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('calls audit.record with OWNER_FINANCIAL_DENIED when sensitive update is blocked', async () => {
      mockPrisma.owner.findUnique.mockResolvedValue({ id: 'owner-cuid-1' });
      mockAudit.record.mockResolvedValue(undefined);

      await expect(
        service.update('owner-cuid-1', { acuerdos: 'new agreement' }, [], {
          userId: 'user-1',
          ip: '127.0.0.1',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAudit.record).toHaveBeenCalledWith(AuditEvent.OWNER_FINANCIAL_DENIED, {
        userId: 'user-1',
        ip: '127.0.0.1',
      });
    });
  });
});
