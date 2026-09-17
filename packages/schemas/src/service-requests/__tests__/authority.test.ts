import { ServiceRequestSendReadinessSchema } from '../schemas';
import { requiresAuthorizationDocument } from '../details';
const tug = { type: 'TUG', operationType: 'BERTHING', tugCount: 1 };
const underwater = {
  type: 'UNDERWATER_INSPECTION',
  inspectionType: 'ANTI_DRUG',
  method: 'COMMERCIAL_DIVERS',
};

describe('Authority-requested services', () => {
  it('an explicit ordinary request overrides the legacy service-type requirement', () => {
    expect(requiresAuthorizationDocument(underwater, false)).toBe(false);
  });
  it('requires a document for any service explicitly requested by an authority', () => {
    const input = {
      supplierId: 'supplier-1',
      details: tug,
      requestedByAuthority: true,
      requestingAuthority: 'INEA',
      documentCount: 0,
    };
    expect(ServiceRequestSendReadinessSchema.safeParse(input).success).toBe(false);
    expect(
      ServiceRequestSendReadinessSchema.safeParse({ ...input, documentCount: 1 }).success,
    ).toBe(true);
  });
  it('also requires the authority name', () => {
    expect(
      ServiceRequestSendReadinessSchema.safeParse({
        supplierId: 'supplier-1',
        details: tug,
        requestedByAuthority: true,
        documentCount: 1,
      }).success,
    ).toBe(false);
  });
  it('does not block an ordinary tug request without a letter', () => {
    expect(
      ServiceRequestSendReadinessSchema.safeParse({
        supplierId: 'supplier-1',
        details: tug,
        requestedByAuthority: false,
        documentCount: 0,
      }).success,
    ).toBe(true);
  });
});
