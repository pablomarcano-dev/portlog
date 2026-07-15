import { createZodDto } from 'nestjs-zod';
import { CrewCreateSchema, CrewUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateCrewDto extends createZodDto(CrewCreateSchema) {}
export class UpdateCrewDto extends createZodDto(CrewUpdateSchema) {}
