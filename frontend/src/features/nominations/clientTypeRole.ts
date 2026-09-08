import type { ContactRole } from '@portlog/schemas';
import type { ClientDirectory } from '../../components/master-data/ClientNamePicker';

/**
 * Client-list Type → contact role, used to scope the Name suggestions on each row.
 *
 * Only the types that correspond to one of the four Contact cross-links are mapped.
 * Head Owner shares the Owner directory with Disponent Owner, and Technical Operator
 * shares the Operator directory with Commercial Operator. Agent-style types
 * (Manning, Catering, Hub, Administrative, Ship Management, Time Charter, Receivers)
 * have no contact role and fall back to the generic clients search.
 */
const CLIENT_TYPE_ROLES: Record<string, ContactRole> = {
  charterer: 'CHARTERER',
  'disponent owner': 'OWNER',
  'head owner': 'OWNER',
  'commercial operator': 'OPERATOR',
  'commercial oper.': 'OPERATOR',
  'technical operator': 'OPERATOR',
  shipper: 'SHIPPER',
};

/** Returns the contact role for a client-list Type, or undefined when unmapped. */
export function clientTypeToContactRole(type: string | undefined): ContactRole | undefined {
  if (!type) return undefined;
  return CLIENT_TYPE_ROLES[type.trim().toLowerCase()];
}

const CLIENT_TYPE_DIRECTORIES: Record<string, ClientDirectory> = {
  charterer: 'charterer',
  charters: 'charterer',
  'disponent owner': 'owner',
  'head owner': 'owner',
  'commercial operator': 'operator',
  'commercial oper.': 'operator',
  'technical operator': 'operator',
  shipper: 'shipper',
};

/** Returns the company directory named by a Client List row. */
export function clientTypeToDirectory(type: string | undefined): ClientDirectory | undefined {
  if (!type) return undefined;
  return CLIENT_TYPE_DIRECTORIES[type.trim().toLowerCase()];
}

export type ClientDirectoryIdField = 'chartererId' | 'ownerId' | 'operatorId' | 'shipperId';

const DIRECTORY_ID_FIELDS: Record<ClientDirectory, ClientDirectoryIdField> = {
  charterer: 'chartererId',
  owner: 'ownerId',
  operator: 'operatorId',
  shipper: 'shipperId',
};

/** Returns the FK field that persists a selected directory company. */
export function clientDirectoryIdField(
  directory: ClientDirectory | undefined,
): ClientDirectoryIdField | undefined {
  return directory ? DIRECTORY_ID_FIELDS[directory] : undefined;
}
