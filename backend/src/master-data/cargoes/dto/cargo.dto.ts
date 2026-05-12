import { createZodDto } from 'nestjs-zod';
import { CargoCreateSchema, CargoUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateCargoDto extends createZodDto(CargoCreateSchema) {}
export class UpdateCargoDto extends createZodDto(CargoUpdateSchema) {}
