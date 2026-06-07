import { z } from 'zod';

export const etaRecordSaveSchema = z.object({
  msgEta: z.string().datetime({ offset: true }).nullable().optional(),
  etaNotify: z.string().datetime({ offset: true }).nullable().optional(),
  etaNotifyOn: z.boolean().default(false),
  etpob: z.string().datetime({ offset: true }).nullable().optional(),
  etpobOn: z.boolean().default(false),
  etb: z.string().datetime({ offset: true }).nullable().optional(),
  etbOn: z.boolean().default(false),
  refMessage: z.string().max(500).nullable().optional(),
});
export type EtaRecordSaveInput = z.infer<typeof etaRecordSaveSchema>;

export const etaRecordResponseSchema = z.object({
  id: z.string(),
  pedrId: z.string(),
  msgEta: z.string().nullable(),
  etaNotify: z.string().nullable(),
  etaNotifyOn: z.boolean(),
  etpob: z.string().nullable(),
  etpobOn: z.boolean(),
  etb: z.string().nullable(),
  etbOn: z.boolean(),
  refMessage: z.string().nullable(),
  updatedAt: z.string(),
});
export type EtaRecordResponse = z.infer<typeof etaRecordResponseSchema>;
