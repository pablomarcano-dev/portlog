import { createZodDto } from 'nestjs-zod';
import {
  ServiceRequestCreateSchema,
  ServiceRequestListQuerySchema,
  ServiceRequestSendSchema,
  ServiceRequestTransitionSchema,
  ServiceRequestUpdateSchema,
} from '@portlog/schemas';

/**
 * DTOs derived directly from the canonical Zod schemas in @portlog/schemas.
 * Golden Rule 2: no validation logic is duplicated here.
 */
export class CreateServiceRequestDto extends createZodDto(ServiceRequestCreateSchema) {}
export class UpdateServiceRequestDto extends createZodDto(ServiceRequestUpdateSchema) {}
export class SendServiceRequestDto extends createZodDto(ServiceRequestSendSchema) {}
export class TransitionServiceRequestDto extends createZodDto(ServiceRequestTransitionSchema) {}
export class ListServiceRequestsDto extends createZodDto(ServiceRequestListQuerySchema) {}
