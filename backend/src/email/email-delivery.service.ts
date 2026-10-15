import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '@prisma/client';

interface AttemptContext {
  id: string;
  started: boolean;
  accepted: boolean;
}
const UNCERTAIN =
  'Delivery is unconfirmed. Do not resend with a new request. Check the mail server and dispatch history before reconciling this attempt.';

/** Durable at-most-once SMTP invocation per request, including process/response loss.
 * An abandoned PREPARING/SENDING attempt deliberately requires reconciliation;
 * SMTP has no exactly-once primitive and a timeout is not proof of non-delivery. */
@Injectable()
export class EmailDeliveryService {
  private readonly context = new AsyncLocalStorage<AttemptContext>();
  constructor(private readonly prisma: PrismaService) {}

  async run(
    id: string,
    userId: string,
    scope: string,
    payload: unknown,
    work: () => Promise<unknown>,
  ) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException(
        'A UUID v4 Idempotency-Key is required for sending. Reload the app before sending.',
      );
    }
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ userId, scope, payload }))
      .digest('hex');
    try {
      await this.prisma.emailSendAttempt.create({
        data: { id, requestHash, userId, scope, state: 'PREPARING' },
      });
    } catch (error) {
      if (!(typeof error === 'object' && error && 'code' in error && error.code === 'P2002'))
        throw error;
      const prior = await this.prisma.emailSendAttempt.findUniqueOrThrow({ where: { id } });
      if (prior.requestHash !== requestHash)
        throw new ConflictException('This send request was already used for different content.');
      if (prior.state === 'SENT') return (prior.response as { value: unknown }).value ?? undefined;
      if (prior.state !== 'FAILED') throw new ConflictException(UNCERTAIN);
      const claimed = await this.prisma.emailSendAttempt.updateMany({
        where: { id, state: 'FAILED' },
        data: { state: 'PREPARING', error: null },
      });
      if (claimed.count !== 1) throw new ConflictException(UNCERTAIN);
    }
    const context: AttemptContext = { id, started: false, accepted: false };
    return this.context.run(context, async () => {
      try {
        const value = await work();
        if (context.started && !context.accepted) throw new ConflictException(UNCERTAIN);
        const response = JSON.parse(
          JSON.stringify({ value: value ?? null }),
        ) as Prisma.InputJsonValue;
        await this.prisma.emailSendAttempt.update({
          where: { id },
          data: { state: 'SENT', response, error: null },
        });
        return value;
      } catch (error) {
        // If this write fails, the existing PREPARING/SENDING claim still blocks
        // duplicate delivery. Never delete a claim or retry SMTP automatically.
        await this.prisma.emailSendAttempt
          .update({
            where: { id },
            data: {
              state: context.started ? 'UNCERTAIN' : 'FAILED',
              error: error instanceof Error ? error.message : String(error),
            },
          })
          .catch(() => undefined);
        if (context.started) throw new ConflictException(UNCERTAIN);
        throw error;
      }
    });
  }

  async beforeSend(): Promise<void> {
    const context = this.context.getStore();
    if (!context) return; // Non-operational mail (e.g. credentials) has its own workflow.
    if (context.started)
      throw new ConflictException('Only one delivery is allowed per send request.');
    context.started = true;
    const claimed = await this.prisma.emailSendAttempt.updateMany({
      where: { id: context.id, state: 'PREPARING' },
      data: { state: 'SENDING' },
    });
    if (claimed.count !== 1) throw new ConflictException(UNCERTAIN);
  }

  accepted(): void {
    const context = this.context.getStore();
    if (context) context.accepted = true;
  }
}
