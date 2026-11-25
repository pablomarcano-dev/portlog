import { z } from 'zod';

/** Job positions are descriptive and never grant application capabilities. */
export const UserOperationalRoleSchema = z.enum([
  'BRANCH_MANAGER',
  'SUPERVISOR',
  'SHIPPING_AGENT',
  'BRANCH_ADMINISTRATOR',
  'FLEET_MANAGER',
  'SENIOR_FLEET_MANAGER',
  'ADMINISTRATION_MANAGER',
]);
export type UserOperationalRole = z.infer<typeof UserOperationalRoleSchema>;

export const OPERATIONAL_POSITION_OPTIONS = [
  { value: 'BRANCH_MANAGER', label: 'Branch Manager' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'SHIPPING_AGENT', label: 'Shipping Agent' },
  { value: 'BRANCH_ADMINISTRATOR', label: 'Branch Administrator' },
  { value: 'FLEET_MANAGER', label: 'Fleet Manager' },
  { value: 'SENIOR_FLEET_MANAGER', label: 'Senior Fleet Manager' },
  { value: 'ADMINISTRATION_MANAGER', label: 'Administration Manager' },
] satisfies { value: UserOperationalRole; label: string }[];
