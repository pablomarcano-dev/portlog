import { createZodDto } from 'nestjs-zod';
import { ClientCreateSchema, ClientUpdateSchema } from '@portlog/schemas';

export class CreateClientDto extends createZodDto(ClientCreateSchema) {}
export class UpdateClientDto extends createZodDto(ClientUpdateSchema) {}
