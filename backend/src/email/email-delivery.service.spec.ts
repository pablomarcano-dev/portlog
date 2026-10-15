import { randomUUID } from 'node:crypto';
import { EmailDeliveryService } from './email-delivery.service.js';

describe('durable email delivery claims', () => {
  let rows: Map<string, Record<string, unknown>>;
  let prisma: { emailSendAttempt: Record<string, jest.Mock> };
  let service: EmailDeliveryService;
  beforeEach(() => {
    rows = new Map();
    prisma = {
      emailSendAttempt: {
        create: jest.fn(async ({ data }) => {
          if (rows.has(data.id)) throw { code: 'P2002' };
          rows.set(data.id, { ...data });
          return data;
        }),
        findUniqueOrThrow: jest.fn(async ({ where }) => rows.get(where.id)),
        updateMany: jest.fn(async ({ where, data }) => {
          const row = rows.get(where.id);
          if (!row || row.state !== where.state) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }),
        update: jest.fn(async ({ where, data }) => Object.assign(rows.get(where.id)!, data)),
      },
    };
    service = new EmailDeliveryService(prisma as never);
  });
  const user = 'test-user';
  const scope = '/send';
  it('returns a saved response after restart without invoking SMTP again', async () => {
    const id = randomUUID();
    const send = jest.fn(async () => {
      await service.beforeSend();
      service.accepted();
      return { id: 'receipt', sentAt: 'saved' };
    });
    expect(await service.run(id, user, scope, {}, send)).toEqual({
      id: 'receipt',
      sentAt: 'saved',
    });
    const restarted = new EmailDeliveryService(prisma as never);
    expect(await restarted.run(id, user, scope, {}, send)).toEqual({
      id: 'receipt',
      sentAt: 'saved',
    });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('rejects concurrent duplicate requests before a second handler runs', async () => {
    const id = randomUUID();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = service.run(id, user, scope, {}, async () => {
      await gate;
      await service.beforeSend();
      service.accepted();
    });
    const second = jest.fn();
    await expect(service.run(id, user, scope, {}, second)).rejects.toThrow('unconfirmed');
    expect(second).not.toHaveBeenCalled();
    release();
    await first;
  });
  it('allows retry after validation/storage failure before SMTP', async () => {
    const id = randomUUID();
    await expect(
      service.run(id, user, scope, {}, async () => {
        throw new Error('storage');
      }),
    ).rejects.toThrow('storage');
    expect(rows.get(id)!.state).toBe('FAILED');
    await service.run(id, user, scope, {}, async () => {
      await service.beforeSend();
      service.accepted();
    });
    expect(rows.get(id)!.state).toBe('SENT');
  });
  it.each(['timeout', 'receipt persistence failure'])(
    'blocks retry after %s with an uncertain outcome',
    async (reason) => {
      const id = randomUUID();
      await expect(
        service.run(id, user, scope, {}, async () => {
          await service.beforeSend();
          if (reason !== 'timeout') service.accepted();
          throw new Error(reason);
        }),
      ).rejects.toThrow('unconfirmed');
      expect(rows.get(id)!.state).toBe('UNCERTAIN');
      const second = jest.fn();
      await expect(
        new EmailDeliveryService(prisma as never).run(id, user, scope, {}, second),
      ).rejects.toThrow('unconfirmed');
      expect(second).not.toHaveBeenCalled();
    },
  );
  it('retains the SENDING claim even when both outcome persistence writes fail', async () => {
    const id = randomUUID();
    prisma.emailSendAttempt.update.mockRejectedValue(new Error('database lost'));
    await expect(
      service.run(id, user, scope, {}, async () => {
        await service.beforeSend();
        service.accepted();
        return 'sent';
      }),
    ).rejects.toThrow('unconfirmed');
    expect(rows.get(id)!.state).toBe('SENDING');
    await expect(service.run(id, user, scope, {}, jest.fn())).rejects.toThrow('unconfirmed');
  });
  it('does not invoke SMTP when persisting its claim fails', async () => {
    prisma.emailSendAttempt.updateMany.mockRejectedValue(new Error('database lost'));
    const smtp = jest.fn();
    await expect(
      service.run(randomUUID(), user, scope, {}, async () => {
        await service.beforeSend();
        smtp();
      }),
    ).rejects.toThrow('unconfirmed');
    expect(smtp).not.toHaveBeenCalled();
  });
  it('rejects reusing a key across payloads, scopes or users', async () => {
    const id = randomUUID();
    await service.run(id, user, scope, {}, async () => 'saved');
    for (const [u, s, body] of [
      ['other', scope, {}],
      [user, '/other', {}],
      [user, scope, { changed: true }],
    ] as const) {
      await expect(service.run(id, u, s, body, jest.fn())).rejects.toThrow('different content');
    }
  });
  it('requires a well-formed key before creating history', async () => {
    await expect(service.run('', user, scope, {}, jest.fn())).rejects.toThrow('Idempotency-Key');
    expect(prisma.emailSendAttempt.create).not.toHaveBeenCalled();
  });
});
