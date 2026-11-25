import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { formatNewNominationReference, type NominationKind } from '@portlog/schemas';

/** Must run inside the same transaction as nomination creation. */
export async function issueNominationReference(
  tx: Prisma.TransactionClient,
  input: {
    kind: NominationKind;
    branchId: string;
    branchCode: string | null | undefined;
    dateNominated: Date;
  },
  now: Date = new Date(),
): Promise<string | null> {
  const config = await tx.nominationNumberingConfig.findUnique({ where: { id: 'active' } });
  // Existing behavior stays explicitly legacy until a verified cutover is configured.
  if (!config || config.cutoverAt > now) return null;
  if (!input.branchCode?.trim()) {
    throw new ConflictException('A verified branch code is required to issue the SN/OT number.');
  }
  const scopeKey = input.kind === 'SN' || config.otScope === 'GLOBAL' ? '*' : input.branchId;
  // Atomic increment locks this series row until the surrounding transaction
  // commits. Failure later rolls back both the number and the new nomination.
  const result = await tx.nominationNumberSeries.updateMany({
    where: { kind: input.kind, scopeKey, nextValue: { lt: 2147483647 } },
    data: { nextValue: { increment: 1 } },
  });
  if (result.count !== 1) {
    throw new ConflictException(
      'The SN/OT series is not initialized or is exhausted. Complete the verified handover first.',
    );
  }
  const series = await tx.nominationNumberSeries.findUniqueOrThrow({
    where: { kind_scopeKey: { kind: input.kind, scopeKey } },
  });
  return formatNewNominationReference(
    series.nextValue - 1,
    input.dateNominated,
    input.kind,
    input.branchCode,
  );
}
