import {
  sendSubDocumentSchema,
  sendNominationEmailSchema,
  emailDispatchResponseSchema,
} from './index';
describe('interim SOF contracts', () => {
  const input = {
    subDocType: 'SOF_INTERIM',
    toAddresses: ['master@example.test'],
    subject: 'Interim Statement of Facts',
    bodyText: 'Entered facts',
    attachmentIds: [],
  };
  it('accepts interim SOF on the document route and excludes the plain-email bypass', () => {
    expect(sendSubDocumentSchema.safeParse(input).success).toBe(true);
    expect(sendNominationEmailSchema.safeParse(input).success).toBe(false);
  });
  it('retains the interim type in a stored dispatch receipt', () => {
    const receipt = emailDispatchResponseSchema.parse({
      ...input,
      id: 'dispatch-1',
      pedrId: 'pedr-1',
      ccAddresses: [],
      bodyHtml: 'Entered facts',
      pdfStorageKey: 'sof_interim.pdf',
      sentAt: null,
      sentById: 'user-1',
      error: null,
      createdAt: '2026-10-27T12:00:00.000Z',
    });
    expect(receipt.subDocType).toBe('SOF_INTERIM');
  });
});
