import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

// ---------------------------------------------------------------------------
// Branch — company branch (Sucursal) master-data entity
// Resolves SCOPE.md Open Question #5: Branch is a dropdown FK on every
// nomination, not a label derived from Port.
// ---------------------------------------------------------------------------

export const BranchSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  code: z.string(),
  comments: z.string().nullable().optional(),
});

export const BranchCreateSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20),
  comments: z.string().optional(),
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
