import { createZodDto } from 'nestjs-zod';
import { NominationStatusTransitionSchema } from '@portlog/schemas';

export class TransitionNominationDto extends createZodDto(NominationStatusTransitionSchema) {}
