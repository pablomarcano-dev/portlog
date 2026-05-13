import { createZodDto } from 'nestjs-zod';
import { NominationUpdateSchema } from '@portlog/schemas';

export class UpdateNominationDto extends createZodDto(NominationUpdateSchema) {}
