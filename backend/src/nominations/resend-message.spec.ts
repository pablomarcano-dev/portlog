import { NominationsService } from './nominations.service.js';

describe('archived message replay', () => {
  const envelope = {
    toAddresses: ['to@example.test'],
    ccAddresses: ['cc@example.test'],
    bccAddresses: ['hidden@example.test'],
    subject: 'Stored subject',
    bodyHtml: '<p>Stored body</p>',
  };
  const file = {
    filename: 'scan.pdf',
    content: Buffer.from('scan'),
    contentType: 'application/pdf',
  };
  const pdf = {
    filename: 'original-document.pdf',
    content: Buffer.from('original'),
    contentType: 'application/pdf',
  };
  let prisma: {
    emailDispatch: Record<string, jest.Mock>;
    shDocumentDispatch: Record<string, jest.Mock>;
  };
  let attachments: Record<string, jest.Mock>;
  let email: Record<string, jest.Mock>;
  let service: NominationsService;
  beforeEach(() => {
    const model = () => ({
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'new' }),
      update: jest.fn().mockResolvedValue({ id: 'new', sentAt: new Date(), ...envelope }),
    });
    prisma = { emailDispatch: model(), shDocumentDispatch: model() };
    attachments = {
      resolveForSend: jest.fn().mockResolvedValue([file]),
      storedPdf: jest.fn().mockResolvedValue(pdf),
      linkToEmailDispatch: jest.fn(),
      linkToShDocumentDispatch: jest.fn(),
    };
    email = { send: jest.fn() };
    service = new NominationsService(
      prisma as never,
      email as never,
      attachments as never,
      {} as never,
    );
  });
  it.each(['PEDR_DISPATCH', 'SH_DISPATCH'] as const)(
    'replays %s with saved BCC, body, generated PDF and uploads',
    async (source) => {
      const model = source === 'PEDR_DISPATCH' ? prisma.emailDispatch : prisma.shDocumentDispatch;
      model.findFirst.mockResolvedValue({
        id: 'old',
        ...envelope,
        sentAt: new Date(),
        pdfStorageKey: 'original-key',
        attachments: [{ id: 'original-attachment' }],
        ...(source === 'PEDR_DISPATCH'
          ? { pedrId: 'pedr', subDocType: 'SOF' }
          : { shDocumentId: 'sh' }),
      });
      await service.resendMessage('nom', source, 'old', 'user');
      expect(model.findFirst.mock.calls[0][0].where).toEqual(
        source === 'PEDR_DISPATCH'
          ? { id: 'old', pedr: { nominationId: 'nom' } }
          : { id: 'old', shDocument: { nominationId: 'nom' } },
      );
      expect(email.send).toHaveBeenCalledWith({
        to: envelope.toAddresses,
        cc: envelope.ccAddresses,
        bcc: envelope.bccAddresses,
        subject: envelope.subject,
        html: envelope.bodyHtml,
        attachments: [pdf, file],
      });
      const archive =
        source === 'PEDR_DISPATCH'
          ? attachments.linkToEmailDispatch
          : attachments.linkToShDocumentDispatch;
      expect(archive).toHaveBeenCalledWith(['original-attachment'], 'new');
      expect(archive.mock.invocationCallOrder[0]).toBeLessThan(
        email.send.mock.invocationCallOrder[0],
      );
    },
  );
  it('refuses another nomination message or an uncertain original', async () => {
    prisma.emailDispatch.findFirst.mockResolvedValue(null);
    await expect(service.resendMessage('nom', 'PEDR_DISPATCH', 'foreign', 'user')).rejects.toThrow(
      'not found',
    );
    prisma.emailDispatch.findFirst.mockResolvedValue({ sentAt: null });
    await expect(service.resendMessage('nom', 'PEDR_DISPATCH', 'pending', 'user')).rejects.toThrow(
      'unconfirmed',
    );
    expect(email.send).not.toHaveBeenCalled();
  });
  it('does not send a partial replay when an archived file is unavailable', async () => {
    prisma.emailDispatch.findFirst.mockResolvedValue({
      sentAt: new Date(),
      attachments: [{ id: 'missing' }],
      generatedPdfExpected: false,
    });
    attachments.resolveForSend.mockRejectedValue(new Error('missing archive'));
    await expect(service.resendMessage('nom', 'PEDR_DISPATCH', 'old', 'user')).rejects.toThrow(
      'missing archive',
    );
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.emailDispatch.create).not.toHaveBeenCalled();
  });
  it.each([true, null, undefined])(
    'rejects missing generated-PDF key with provenance %s, even if uploads exist',
    async (expected) => {
      prisma.emailDispatch.findFirst.mockResolvedValue({
        ...envelope,
        pedrId: 'pedr',
        subDocType: 'SOF',
        sentAt: new Date(),
        pdfStorageKey: null,
        generatedPdfExpected: expected,
        attachments: [{ id: 'uploaded-scan' }],
      });
      await expect(service.resendMessage('nom', 'PEDR_DISPATCH', 'old', 'user')).rejects.toThrow(
        'Exact resend blocked',
      );
      expect(email.send).not.toHaveBeenCalled();
      expect(prisma.emailDispatch.create).not.toHaveBeenCalled();
    },
  );
  it('rejects a SH original with a missing generated-PDF key', async () => {
    prisma.shDocumentDispatch.findFirst.mockResolvedValue({
      ...envelope,
      shDocumentId: 'sh',
      sentAt: new Date(),
      pdfStorageKey: null,
      attachments: [{ id: 'uploaded-scan' }],
    });
    await expect(service.resendMessage('nom', 'SH_DISPATCH', 'old', 'user')).rejects.toThrow(
      'Exact resend blocked',
    );
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.shDocumentDispatch.create).not.toHaveBeenCalled();
  });
  it('replays explicitly known no-generated-PDF messages and preserves that provenance', async () => {
    prisma.emailDispatch.findFirst.mockResolvedValue({
      ...envelope,
      pedrId: 'pedr',
      subDocType: 'SOF',
      sentAt: new Date(),
      pdfStorageKey: null,
      generatedPdfExpected: false,
      attachments: [{ id: 'scan' }],
    });
    await service.resendMessage('nom', 'PEDR_DISPATCH', 'old', 'user');
    expect(attachments.storedPdf).not.toHaveBeenCalled();
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ attachments: [file] }));
    expect(prisma.emailDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ generatedPdfExpected: false }),
      }),
    );
  });
  it.each(['PEDR_DISPATCH', 'SH_DISPATCH'] as const)(
    'never sends %s when the known generated PDF cannot be read',
    async (source) => {
      const model = source === 'PEDR_DISPATCH' ? prisma.emailDispatch : prisma.shDocumentDispatch;
      model.findFirst.mockResolvedValue({
        ...envelope,
        sentAt: new Date(),
        pdfStorageKey: 'missing-key',
        attachments: [],
        ...(source === 'PEDR_DISPATCH'
          ? { pedrId: 'pedr', subDocType: 'SOF' }
          : { shDocumentId: 'sh' }),
      });
      attachments.storedPdf.mockRejectedValue(new Error('missing generated PDF'));
      await expect(service.resendMessage('nom', source, 'old', 'user')).rejects.toThrow(
        'missing generated PDF',
      );
      expect(email.send).not.toHaveBeenCalled();
      expect(model.create).not.toHaveBeenCalled();
    },
  );
  it.each(['PEDR_DISPATCH', 'SH_DISPATCH'] as const)(
    'never sends %s when an uploaded archive or its new snapshot fails',
    async (source) => {
      const model = source === 'PEDR_DISPATCH' ? prisma.emailDispatch : prisma.shDocumentDispatch;
      model.findFirst.mockResolvedValue({
        ...envelope,
        sentAt: new Date(),
        pdfStorageKey: 'pdf-key',
        attachments: [{ id: 'scan' }],
        ...(source === 'PEDR_DISPATCH'
          ? { pedrId: 'pedr', subDocType: 'SOF' }
          : { shDocumentId: 'sh' }),
      });
      attachments.resolveForSend.mockRejectedValueOnce(new Error('missing uploaded archive'));
      await expect(service.resendMessage('nom', source, 'old', 'user')).rejects.toThrow(
        'missing uploaded archive',
      );
      expect(model.create).not.toHaveBeenCalled();
      const archive =
        source === 'PEDR_DISPATCH'
          ? attachments.linkToEmailDispatch
          : attachments.linkToShDocumentDispatch;
      archive.mockRejectedValueOnce(new Error('snapshot unavailable'));
      await expect(service.resendMessage('nom', source, 'old', 'user')).rejects.toThrow(
        'snapshot unavailable',
      );
      expect(model.update).toHaveBeenCalledWith({
        where: { id: 'new' },
        data: { error: 'snapshot unavailable' },
      });
      expect(email.send).not.toHaveBeenCalled();
    },
  );
});
