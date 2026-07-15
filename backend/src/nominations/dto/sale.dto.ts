import { createZodDto } from 'nestjs-zod';
import { SaleCreateSchema, SaleUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateSaleDto extends createZodDto(SaleCreateSchema) {}
export class UpdateSaleDto extends createZodDto(SaleUpdateSchema) {}
