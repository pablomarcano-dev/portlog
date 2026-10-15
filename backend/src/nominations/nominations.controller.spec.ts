import { HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { NominationsController } from './nominations.controller';
import type { NominationsService } from './nominations.service';
import type { RequestUser } from '../auth/jwt.strategy';
import { sendEmailReceiptQuerySchema } from '@portlog/schemas';

describe('nomination send receipt opt-in', () => {
  const body = {
    subDocType: 'ETA_RECAP' as const,
    subject: 'Recap',
    bodyText: 'Text',
    toAddresses: ['client@example.test'],
    ccAddresses: [],
    bccAddresses: [],
    attachmentIds: [],
  };
  const req = {
    user: {
      sub: 'user-1',
      email: 'user@example.test',
      role: 'OPS',
      permissions: [],
    } as RequestUser,
  };
  const receipt = {
    id: 'dispatch-1',
    sentAt: new Date('2026-10-15T16:00:00Z'),
    bodyHtml: '<pre>Sent</pre>',
    ccAddresses: ['branch@example.test'],
  };
  const service = { sendEmail: jest.fn().mockResolvedValue(receipt) };
  const controller = new NominationsController(service as unknown as NominationsService);
  beforeEach(() => jest.clearAllMocks());

  it('keeps the existing empty 204 response unless a receipt is requested', async () => {
    const reply = { code: jest.fn() };
    expect(
      await controller.sendEmail('nom-1', body, req, {}, reply as unknown as FastifyReply),
    ).toBeUndefined();
    expect(reply.code).not.toHaveBeenCalled();
    expect(Reflect.getMetadata('__httpCode__', NominationsController.prototype.sendEmail)).toBe(
      HttpStatus.NO_CONTENT,
    );
  });

  it('returns the exact service receipt with 200 on explicit opt-in', async () => {
    const reply = { code: jest.fn() };
    expect(
      await controller.sendEmail(
        'nom-1',
        body,
        req,
        { receipt: 'true' },
        reply as unknown as FastifyReply,
      ),
    ).toBe(receipt);
    expect(reply.code).toHaveBeenCalledWith(HttpStatus.OK);
    expect(service.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('validates the opt-in before sending', () => {
    expect(sendEmailReceiptQuerySchema.safeParse({ receipt: 'unexpected' }).success).toBe(false);
    expect(sendEmailReceiptQuerySchema.parse({ receipt: 'false' }).receipt).toBe('false');
  });
});
