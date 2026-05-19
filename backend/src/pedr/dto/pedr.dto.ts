import { createZodDto } from 'nestjs-zod';
import {
  createPedrSchema,
  updatePedrRequirementsSchema,
  pedrStageTransitionSchema,
} from '@portlog/schemas';

export class CreatePedrDto extends createZodDto(createPedrSchema) {}
export class UpdatePedrRequirementsDto extends createZodDto(updatePedrRequirementsSchema) {}
export class PedrStageTransitionDto extends createZodDto(pedrStageTransitionSchema) {}
