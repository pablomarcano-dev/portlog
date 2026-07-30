import { z } from 'zod';

export const composeDataSchema = z.object({
  subject: z.string(),
  toAddresses: z.array(z.string()),
  ccAddresses: z.array(z.string()),
  bccAddresses: z.array(z.string()),
  /**
   * The rendered template as plain text — what the compose editor binds to.
   * `bodyHtml` is the same content wrapped for mail clients; the editor must not
   * show it, or the agent sees the `<pre …>` wrapper as body copy.
   */
  bodyText: z.string(),
  bodyHtml: z.string(),
});

export type ComposeData = z.infer<typeof composeDataSchema>;
