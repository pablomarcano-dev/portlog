import { createZodDto } from 'nestjs-zod';
import { PortCreateSchema, PortUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreatePortDto extends createZodDto(PortCreateSchema) {}
export class UpdatePortDto extends createZodDto(PortUpdateSchema) {}
