import { BranchUpdateSchema } from '../branch';
import { CargoUpdateSchema } from '../cargo';
import { ClientUpdateSchema } from '../client';
import { ContactUpdateSchema } from '../contact';
import { EmailGroupUpdateSchema } from '../email-group';
import { PortUpdateSchema } from '../port';
import { ServiceRequestUpdateSchema } from '../../service-requests/schemas';
import { NominationUpdateSchema } from '../../nominations/schemas';
import {
  UpdateBranchDocumentTemplateSchema,
  UpdateBranchDocumentTemplateFieldSchema,
} from '../../branch-documents';

describe('PATCH omission after the Zod security upgrade', () => {
  it.each([
    ['branch', BranchUpdateSchema],
    ['cargo', CargoUpdateSchema],
    ['client', ClientUpdateSchema],
    ['contact', ContactUpdateSchema],
    ['email group', EmailGroupUpdateSchema],
    ['port', PortUpdateSchema],
    ['service request', ServiceRequestUpdateSchema],
    ['nomination', NominationUpdateSchema],
    ['document template', UpdateBranchDocumentTemplateSchema],
    ['document field', UpdateBranchDocumentTemplateFieldSchema],
  ] as const)('leaves omitted %s fields absent', (_name, schema) => {
    expect(schema.parse({})).toEqual({});
  });

  it('renaming a client does not clear contacts, addresses, tariffs or assignments', () => {
    expect(ClientUpdateSchema.parse({ name: 'Updated client' })).toEqual({
      name: 'Updated client',
    });
  });

  it('still accepts an explicit collection clear', () => {
    expect(ClientUpdateSchema.parse({ phones: [], addresses: [] })).toEqual({
      phones: [],
      addresses: [],
    });
  });
});
