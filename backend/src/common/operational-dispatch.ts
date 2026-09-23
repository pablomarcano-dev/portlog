import { Prisma } from '@prisma/client';

/**
 * Operators prefix trial messages with this marker while exercising the live
 * workflow. Those messages remain in the audit log, but must not advance the
 * nomination's real operational lifecycle.
 */
export const TEST_DISPATCH_SUBJECT_PREFIX = '***PRUEBA***';

/** Sent dispatches that represent real operations rather than live-system tests. */
export const OPERATIONAL_SENT_DISPATCH_WHERE = {
  sentAt: { not: null },
  NOT: {
    subject: {
      startsWith: TEST_DISPATCH_SUBJECT_PREFIX,
      mode: 'insensitive',
    },
  },
} satisfies Prisma.EmailDispatchWhereInput;
