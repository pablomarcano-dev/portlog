import type { ContactRole } from '@portlog/schemas';

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
