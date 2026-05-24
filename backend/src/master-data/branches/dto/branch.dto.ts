import { createZodDto } from 'nestjs-zod';
import { BranchCreateSchema, BranchUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateBranchDto extends createZodDto(BranchCreateSchema) {}
export class UpdateBranchDto extends createZodDto(BranchUpdateSchema) {}
