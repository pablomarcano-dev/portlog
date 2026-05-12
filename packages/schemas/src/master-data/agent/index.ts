import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

export const AgentCreateSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(500).optional(),
  contactInfo: z.string().max(10_000).optional(),
  comments: z.string().max(10_000).optional(),
});

export const AgentUpdateSchema = AgentCreateSchema.partial();

export const AgentListQuerySchema = ListQuerySchema;

export type AgentCreateInput = z.infer<typeof AgentCreateSchema>;
export type AgentUpdateInput = z.infer<typeof AgentUpdateSchema>;
export type AgentListQuery = z.infer<typeof AgentListQuerySchema>;
