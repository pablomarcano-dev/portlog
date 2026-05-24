import { createZodDto } from 'nestjs-zod';
import { NominationClientCreateSchema, NominationClientUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateNominationClientDto extends createZodDto(NominationClientCreateSchema) {}
export class UpdateNominationClientDto extends createZodDto(NominationClientUpdateSchema) {}
