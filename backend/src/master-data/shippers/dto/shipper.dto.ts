import { createZodDto } from 'nestjs-zod';
import { ShipperCreateSchema, ShipperUpdateSchema } from '@portlog/schemas';

export class CreateShipperDto extends createZodDto(ShipperCreateSchema) {}
export class UpdateShipperDto extends createZodDto(ShipperUpdateSchema) {}
