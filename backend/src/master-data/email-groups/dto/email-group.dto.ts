import { createZodDto } from 'nestjs-zod';
import { EmailGroupCreateSchema, EmailGroupUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateEmailGroupDto extends createZodDto(EmailGroupCreateSchema) {}
export class UpdateEmailGroupDto extends createZodDto(EmailGroupUpdateSchema) {}
