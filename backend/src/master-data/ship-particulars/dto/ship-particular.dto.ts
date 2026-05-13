import { createZodDto } from 'nestjs-zod';
import { ShipParticularCreateSchema, ShipParticularUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateShipParticularDto extends createZodDto(ShipParticularCreateSchema) {}
export class UpdateShipParticularDto extends createZodDto(ShipParticularUpdateSchema) {}
