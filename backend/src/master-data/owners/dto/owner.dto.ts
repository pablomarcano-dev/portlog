import { createZodDto } from 'nestjs-zod';
import { OwnerCreateSchema, OwnerUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateOwnerDto extends createZodDto(OwnerCreateSchema) {}
export class UpdateOwnerDto extends createZodDto(OwnerUpdateSchema) {}
