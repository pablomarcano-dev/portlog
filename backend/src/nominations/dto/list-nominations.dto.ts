import { createZodDto } from 'nestjs-zod';
import { NominationListQuerySchema } from '@portlog/schemas';

export class ListNominationsDto extends createZodDto(NominationListQuerySchema) {}
