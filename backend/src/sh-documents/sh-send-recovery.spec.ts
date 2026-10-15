import { randomUUID } from 'node:crypto';
import { SHDocumentsService } from './sh-documents.service.js';
import { EmailDeliveryService } from '../email/email-delivery.service.js';

describe('SH preparation and durable send recovery', () => {
  let doc: Record<string, unknown>;
  let attempts: Map<string, Record<string, unknown>>;
  let delivery: EmailDeliveryService;
  let service: SHDocumentsService;
  let prisma: ReturnType<typeof makePrisma>;
  let storage: { getFileBuffer: jest.Mock };
  let attachments: { resolveForSend: jest.Mock; linkToShDocumentDispatch: jest.Mock };
  let email: { send: jest.Mock };
  function makePrisma() {
    const model = {
      findFirst: jest.fn(async () => ({ ...doc })),
      findUniqueOrThrow: jest.fn(async () => ({ ...doc })),
      updateMany: jest.fn(async ({ where, data }) => {
        if (Object.entries(where).some(([key, value]) => doc[key] !== value)) return { count: 0 };
        Object.assign(doc, data);
        return { count: 1 };
      }),
    };
    const tx = { sHDocument: model };
    return {
      ...tx,
      $transaction: jest.fn(async (work) => work(tx)),
      nomination: { findUnique: jest.fn(async () => ({ correlative: 1 })) },
      shDocumentDispatch: {
        create: jest.fn(async ({ data }) => ({ id: randomUUID(), ...data })),
        update: jest.fn(async ({ data }) => data),
      },
      emailSendAttempt: {
        create: jest.fn(async ({ data }) => {
          if (attempts.has(data.id)) throw { code: 'P2002' };
          attempts.set(data.id, { ...data });
          return data;
        }),
        findUniqueOrThrow: jest.fn(async ({ where }) => attempts.get(where.id)),
        updateMany: jest.fn(async ({ where, data }) => {
          const row = attempts.get(where.id);
          if (!row || row.state !== where.state) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }),
        update: jest.fn(async ({ where, data }) => Object.assign(attempts.get(where.id)!, data)),
      },
    };
  }
  const dto = { toAddresses: ['test@example.invalid'], ccAddresses: [], attachmentIds: ['scan'] };
  const run = (key: string) =>
    delivery.run(key, 'user', '/sh/send', dto, () =>
      service.send('nom', 'sh', dto as never, 'user'),
    );
  beforeEach(() => {
    const now = new Date('2026-10-15T12:00:00Z');
    doc = {
      id: 'sh',
      nominationId: 'nom',
      type: 'SH_66A',
      status: 'FINALIZED',
      minioKey: 'pdf',
      updatedAt: now,
      createdAt: now,
      pdfGeneratedAt: now,
      sentAt: null,
      createdBy: { id: 'user', email: 'test@example.invalid' },
      data: {},
    };
    attempts = new Map();
    prisma = makePrisma();
    delivery = new EmailDeliveryService(prisma as never);
    storage = { getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('original PDF')) };
    attachments = {
      resolveForSend: jest.fn().mockResolvedValue([]),
      linkToShDocumentDispatch: jest.fn().mockResolvedValue(undefined),
    };
    email = {
      send: jest.fn(async () => {
        await delivery.beforeSend();
        delivery.accepted();
      }),
    };
    service = new SHDocumentsService(
      prisma as never,
      {} as never,
      storage as never,
      email as never,
      attachments as never,
    );
  });
  it.each(['PDF read', 'uploaded bytes', 'snapshot'])(
    'leaves FINALIZED and retries the same key after %s preparation fails',
    async (failure) => {
      const failing =
        failure === 'PDF read'
          ? storage.getFileBuffer
          : failure === 'uploaded bytes'
            ? attachments.resolveForSend
            : attachments.linkToShDocumentDispatch;
      failing.mockRejectedValueOnce(new Error('storage unavailable'));
      const key = randomUUID();
      await expect(run(key)).rejects.toThrow();
      expect(doc.status).toBe('FINALIZED');
      expect(attempts.get(key)!.state).toBe('FAILED');
      expect(prisma.sHDocument.updateMany).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
      await run(key);
      expect(doc.status).toBe('SENT');
      expect(attempts.get(key)!.state).toBe('SENT');
      expect(email.send).toHaveBeenCalledTimes(1);
      delivery = new EmailDeliveryService(prisma as never);
      await run(key);
      expect(email.send).toHaveBeenCalledTimes(1);
    },
  );
  it('retains a failed dispatch audit and remains retryable if snapshot error recording also fails', async () => {
    attachments.linkToShDocumentDispatch.mockRejectedValueOnce(new Error('snapshot unavailable'));
    prisma.shDocumentDispatch.update.mockRejectedValueOnce(new Error('audit write unavailable'));
    const key = randomUUID();
    await expect(run(key)).rejects.toThrow('snapshot unavailable');
    expect(prisma.shDocumentDispatch.create).toHaveBeenCalledTimes(1);
    expect(doc.status).toBe('FINALIZED');
    await run(key);
    expect(email.send).toHaveBeenCalledTimes(1);
  });
  it('allows only one SMTP send for concurrent different keys after snapshot preparation', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let prepared = 0;
    attachments.linkToShDocumentDispatch.mockImplementation(async () => {
      prepared++;
      if (prepared === 2) release();
      await gate;
    });
    const results = await Promise.allSettled([run(randomUUID()), run(randomUUID())]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(doc.status).toBe('SENT');
    expect(prisma.shDocumentDispatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { error: 'Document changed or another send already claimed it' },
      }),
    );
  });
  it('does not send the prepared bytes if the finalized PDF changed before claim', async () => {
    attachments.linkToShDocumentDispatch.mockImplementation(async () => {
      doc.minioKey = 'replacement';
    });
    await expect(run(randomUUID())).rejects.toThrow('Document changed');
    expect(email.send).not.toHaveBeenCalled();
    expect(doc.status).toBe('FINALIZED');
  });
  it('does not restore or retry SENT after SMTP starts with an uncertain result', async () => {
    email.send.mockImplementation(async () => {
      await delivery.beforeSend();
      throw new Error('SMTP timeout');
    });
    const key = randomUUID();
    await expect(run(key)).rejects.toThrow('unconfirmed');
    expect(doc.status).toBe('SENT');
    expect(attempts.get(key)!.state).toBe('UNCERTAIN');
    delivery = new EmailDeliveryService(prisma as never);
    await expect(run(key)).rejects.toThrow('unconfirmed');
    await expect(run(randomUUID())).rejects.toThrow('Only FINALIZED');
    expect(email.send).toHaveBeenCalledTimes(1);
  });
});
