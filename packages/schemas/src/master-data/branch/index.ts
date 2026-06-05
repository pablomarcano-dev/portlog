import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

// ---------------------------------------------------------------------------
// Branch — company branch (Sucursal) master-data entity
// ---------------------------------------------------------------------------

export const BranchSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  code: z.string(),
  comments: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  fax: z.string().nullable().optional(),
  mobile24h: z.string().nullable().optional(),
  coverage: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactTitle: z.string().nullable().optional(),
  contactMobile: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  centralEmails: z.array(z.string()).default([]),
});

export const BranchCreateSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20),
  comments: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  mobile24h: z.string().optional(),
  coverage: z.string().optional(),
  contactName: z.string().optional(),
  contactTitle: z.string().optional(),
  contactMobile: z.string().optional(),
  contactEmail: z.string().email().optional(),
  centralEmails: z.array(z.string().email()).default([]),
});

export const BranchUpdateSchema = BranchCreateSchema.partial();

export const BranchSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
});

export const BranchListQuerySchema = ListQuerySchema;

export type Branch = z.infer<typeof BranchSchema>;
export type BranchCreate = z.infer<typeof BranchCreateSchema>;
export type BranchUpdate = z.infer<typeof BranchUpdateSchema>;
export type BranchSummary = z.infer<typeof BranchSummarySchema>;
export type BranchListQuery = z.infer<typeof BranchListQuerySchema>;
