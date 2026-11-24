import { z } from 'zod';

export const AdministrativeInstructionDiagnosticsSchema = z.object({
  instructionSource: z.enum(['INSTRUCTION_CLIENT', 'CHARTERER_FALLBACK', 'NONE']),
  instructionClientName: z.string().nullable(),
  checks: z.array(
    z.object({
      field: z.enum([
        'PORT_COSTS_INSTRUCTIONS',
        'OWNER_EXPENSES_INSTRUCTIONS',
        'TECHNICAL_MANAGEMENT_INSTRUCTIONS',
        'PORT_MUNICIPALITY',
        'PORT_COSTS_BILLING',
        'OWNER_EXPENSES_BILLING',
        'TECHNICAL_MANAGEMENT_BILLING',
      ]),
      status: z.enum(['POPULATED', 'MISSING', 'INCOMPLETE']),
    }),
  ),
});

export type AdministrativeInstructionDiagnostics = z.infer<
  typeof AdministrativeInstructionDiagnosticsSchema
>;
