import { createZodDto } from 'nestjs-zod';
import { SalesContactCreateSchema, SalesContactUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateSalesContactDto extends createZodDto(SalesContactCreateSchema) {}
export class UpdateSalesContactDto extends createZodDto(SalesContactUpdateSchema) {}
