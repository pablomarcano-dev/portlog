import { z } from 'zod';

export const composeDataSchema = z.object({
  subject: z.string(),
  toAddresses: z.array(z.string()),
  ccAddresses: z.array(z.string()),
  bccAddresses: z.array(z.string()),
  /**
   * The rendered template as plain text — what the compose editor binds to.
   * Nothing HTML crosses this boundary: the wrapper that preserves the
   * fixed-width layout is applied at send time, so the agent only ever sees and
   * edits the letter itself.
   */
  bodyText: z.string(),
});

export type ComposeData = z.infer<typeof composeDataSchema>;
