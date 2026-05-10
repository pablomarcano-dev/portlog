import { createZodDto } from 'nestjs-zod';
import { LoginRequestSchema } from '@portlog/schemas';

/**
 * LoginDto — derived from the canonical LoginRequestSchema in @portlog/schemas.
 * Golden Rule 2: Zod is the single source of truth. Never redeclare this type
 * inline — always derive from the shared schema.
 */
export class LoginDto extends createZodDto(LoginRequestSchema) {}
