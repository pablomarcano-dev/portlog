import { createZodDto } from 'nestjs-zod';
import { OperatorCreateSchema, OperatorUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateOperatorDto extends createZodDto(OperatorCreateSchema) {}
export class UpdateOperatorDto extends createZodDto(OperatorUpdateSchema) {}
