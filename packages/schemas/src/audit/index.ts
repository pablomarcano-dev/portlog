import { z } from 'zod';

export const AuditEventSchema = z.enum([
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'LOGOUT',
  'REFRESH_TOKEN_REUSE',
]);

export type AuditEvent = z.infer<typeof AuditEventSchema>;
