import { createZodDto } from 'nestjs-zod';
import { SupplierCreateSchema, SupplierUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateSupplierDto extends createZodDto(SupplierCreateSchema) {}
export class UpdateSupplierDto extends createZodDto(SupplierUpdateSchema) {}
