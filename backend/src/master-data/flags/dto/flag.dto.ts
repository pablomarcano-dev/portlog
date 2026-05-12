import { createZodDto } from 'nestjs-zod';
import { FlagCreateSchema, FlagUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateFlagDto extends createZodDto(FlagCreateSchema) {}
export class UpdateFlagDto extends createZodDto(FlagUpdateSchema) {}
