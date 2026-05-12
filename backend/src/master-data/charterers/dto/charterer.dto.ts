import { createZodDto } from 'nestjs-zod';
import { ChartererCreateSchema, ChartererUpdateSchema } from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateChartererDto extends createZodDto(ChartererCreateSchema) {}
export class UpdateChartererDto extends createZodDto(ChartererUpdateSchema) {}
