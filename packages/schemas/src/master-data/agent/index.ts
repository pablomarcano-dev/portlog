import { z } from 'zod';
import { clearableCuid, optionalText } from '../../common/fields';
import { ListQuerySchema } from '../../common/pagination';

export const AgentCreateSchema = z.object({
  name: z.string().min(1).max(120),
  address: optionalText(500),
  contactInfo: z.string().max(10_000).optional(),
  // Unlike ordinary optional text, a blank mobile is an explicit clear on PATCH.
  mobile: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(50).nullish(),
  ),
  branchId: clearableCuid(),
  operationalRole: z.enum(['BRANCH_MANAGER', 'SUPERVISOR', 'SHIPPING_AGENT']).nullable().optional(),
  comments: z.string().max(10_000).optional(),
});

export const AgentUpdateSchema = AgentCreateSchema.partial();

export const AgentListQuerySchema = ListQuerySchema.extend({
  branchId: z.string().cuid().optional(),
  operationalRole: z.enum(['BRANCH_MANAGER', 'SUPERVISOR', 'SHIPPING_AGENT']).optional(),
});

export type AgentCreateInput = z.infer<typeof AgentCreateSchema>;
export type AgentUpdateInput = z.infer<typeof AgentUpdateSchema>;
export type AgentListQuery = z.infer<typeof AgentListQuerySchema>;
