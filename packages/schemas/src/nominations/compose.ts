import { z } from 'zod';

export const composeDataSchema = z.object({
  subject: z.string(),
  toAddresses: z.array(z.string()),
  ccAddresses: z.array(z.string()),
  bccAddresses: z.array(z.string()),
  bodyHtml: z.string(),
});

export type ComposeData = z.infer<typeof composeDataSchema>;
