import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { issueNominationReference } from './nomination-numbering.js';

describe('nomination numbering cutover', () => {
  const now = new Date('2026-12-01T12:00:00Z');
  const input = {
    kind: 'SN' as const,
    branchId: 'branch-plc',
    branchCode: 'PLC',
    dateNominated: now,
  };
  const config = { cutoverAt: now, otScope: 'GLOBAL' };
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const findUniqueOrThrow = jest.fn();
  const tx = {
    nominationNumberingConfig: { findUnique },
    nominationNumberSeries: { updateMany, findUniqueOrThrow },
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    jest.resetAllMocks();
    findUnique.mockResolvedValue(config);
    updateMany.mockResolvedValue({ count: 1 });
    findUniqueOrThrow.mockResolvedValue({ nextValue: 3142 });
  });

  it.each([null, { ...config, cutoverAt: new Date('2026-12-02T00:00:00Z') }])(
    'keeps legacy creation when handover is absent or future: %p',
    async (setting) => {
      findUnique.mockResolvedValue(setting);
      expect(await issueNominationReference(tx, input, now)).toBeNull();
      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it('issues SN nationally from its own initialized series with one atomic increment', async () => {
    expect(await issueNominationReference(tx, input, now)).toBe('SN3141/26/PLC');
    expect(updateMany).toHaveBeenCalledWith({
      where: { kind: 'SN', scopeKey: '*', nextValue: { lt: 2147483647 } },
      data: { nextValue: { increment: 1 } },
    });
  });

  it.each(['GLOBAL', 'BRANCH'])(
    'uses explicitly configured %s OT scope and an independent counter',
    async (otScope) => {
      findUnique.mockResolvedValue({ ...config, otScope });
      findUniqueOrThrow.mockResolvedValue({ nextValue: 127 });
      expect(await issueNominationReference(tx, { ...input, kind: 'OT' }, now)).toBe(
        'OT0126/26/PLC',
      );
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            kind: 'OT',
            scopeKey: otScope === 'GLOBAL' ? '*' : 'branch-plc',
          }),
        }),
      );
    },
  );

  it('does not reset its counter across years', async () => {
    expect(
      await issueNominationReference(
        tx,
        { ...input, dateNominated: new Date('2027-01-01T00:00:00Z') },
        new Date('2027-01-01T00:00:00Z'),
      ),
    ).toBe('SN3141/27/PLC');
    expect(updateMany.mock.calls[0][0].where).not.toHaveProperty('year');
  });

  it('fails closed instead of inferring uninitialized series or branch', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(issueNominationReference(tx, input, now)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
    await expect(
      issueNominationReference(tx, { ...input, branchCode: null }, now),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
