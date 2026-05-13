import { createZodDto } from 'nestjs-zod';
import { NominationCreateSchema } from '@portlog/schemas';

export class CreateNominationDto extends createZodDto(NominationCreateSchema) {}
