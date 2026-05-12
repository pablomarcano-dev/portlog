import { createZodDto } from 'nestjs-zod';
import { ActivityCreateSchema, ActivityUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateActivityDto extends createZodDto(ActivityCreateSchema) {}
export class UpdateActivityDto extends createZodDto(ActivityUpdateSchema) {}
