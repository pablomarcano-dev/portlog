import { z } from 'zod';
import { notifications } from '@mantine/notifications';
import { formatDateTime } from './format/datetime';

export interface PrintableEmail {
  subject: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses?: string[];
  bodyText: string;
  sentAt?: string;
  type?: string;
}

/** Reserve the window in the user gesture, before the asynchronous send. */
export function openEmailPrintWindow(): Window | null {
  const win = window.open('', '_blank', 'width=800,height=700');
  if (win) {
    win.opener = null;
    win.document.title = 'Preparing message for printing';
    win.document.body.textContent = 'Waiting for the message to be sent successfully…';
  }
  return win;
}

/** Only call after sending succeeds. Compose is plain text, rendered as text
 * nodes so subject, recipients and body can never introduce active markup. */
export function printEmail(win: Window | null, message: PrintableEmail): void {
  if (!win || win.closed) return;
  renderMetadata(win, message);
  const body = win.document.createElement('div');
  body.style.cssText = 'white-space: pre-wrap; overflow-wrap: anywhere;';
  body.textContent = message.bodyText;
  win.document.body.append(body);
  win.focus();
  win.print();
}

function renderMetadata(win: Window, message: Omit<PrintableEmail, 'bodyText'>): void {
  const doc = win.document;
  doc.title = message.subject;
  doc.body.replaceChildren();
  doc.body.style.cssText = 'font: 13px Arial, sans-serif; margin: 32px;';
  const metadata = doc.createElement('div');
  metadata.style.cssText =
    'white-space: pre-wrap; border-bottom: 1px solid #ccc; padding-bottom: 16px; margin-bottom: 20px;';
  metadata.textContent = [
    `Subject: ${message.subject}`,
    ...(message.type ? [`Type: ${message.type}`] : []),
    `Sent: ${formatDateTime(message.sentAt ?? Date.now())}`,
    `To: ${message.toAddresses.join(', ')}`,
    ...(message.ccAddresses.length ? [`CC: ${message.ccAddresses.join(', ')}`] : []),
    ...(message.bccAddresses?.length ? [`BCC: ${message.bccAddresses.join(', ')}`] : []),
  ].join('\n');
  doc.body.append(metadata);
}

/** Archived HTML stays in a sandbox; user-supplied metadata is always text. */
export function printStoredEmail(
  message: Omit<PrintableEmail, 'bodyText'> & { bodyHtml: string | null },
): void {
  printStoredEmailInWindow(openEmailPrintWindow(), message);
}

export function printStoredEmailInWindow(
  win: Window | null,
  message: Omit<PrintableEmail, 'bodyText'> & { bodyHtml: string | null },
): void {
  if (!win || win.closed) return;
  renderMetadata(win, message);
  const frame = win.document.createElement('iframe');
  frame.title = 'Message body';
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.style.cssText = 'width: 100%; border: 0;';
  frame.onload = () => {
    frame.style.height = `${frame.contentDocument?.documentElement.scrollHeight ?? 300}px`;
    win.focus();
    win.print();
  };
  frame.srcdoc = message.bodyHtml ?? '<p>No message body available.</p>';
  win.document.body.append(frame);
}

const storedEmailReceiptSchema = z.object({
  id: z.string(),
  sentAt: z.string().nullable(),
  subject: z.string(),
  toAddresses: z.array(z.string()),
  ccAddresses: z.array(z.string()),
  bccAddresses: z.array(z.string()).optional(),
  bodyHtml: z.string().nullable(),
});
export type StoredEmailReceipt = z.infer<typeof storedEmailReceiptSchema>;
export function parseStoredEmailReceipt(value: unknown): StoredEmailReceipt {
  return storedEmailReceiptSchema.parse(value);
}

export function printSentReceipt(win: Window | null, receipt: StoredEmailReceipt): void {
  if (receipt.sentAt) {
    printStoredEmailInWindow(win, { ...receipt, sentAt: receipt.sentAt });
  } else {
    win?.close();
    notifications.show({
      color: 'orange',
      title: 'No confirmed receipt',
      message: 'Check the dispatch history before sending again.',
    });
  }
}
