/**
 * Email bodies are authored as plain text — the templates under `templates/`
 * are fixed-width layouts and the compose editor is a plain textarea. A mail
 * client collapses whitespace in an HTML part, so a body that reaches SMTP
 * unwrapped arrives as one run-on paragraph.
 *
 * Everything that leaves through `EmailService.send` therefore passes through
 * `wrapPlainTextEmailBody`. The frontend wraps too (see
 * `frontend/src/lib/format/emailBody.ts`) so the stored `bodyHtml` matches what
 * was mailed; this is the backstop that makes a flattened body impossible no
 * matter which caller supplied it.
 */

const PRE_STYLE =
  "font-family:'Courier New',Consolas,monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;padding:16px;margin:0;";

/** Escapes the three characters that would otherwise be read as markup. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Wraps a plain-text body for HTML display, preserving its layout. Content that
 * is already HTML (a rendered template, a credentials email, a body the client
 * wrapped) passes through untouched, so this is safe to apply more than once.
 */
export function wrapPlainTextEmailBody(body: string): string {
  if (body.trimStart().startsWith('<')) return body;
  return `<pre style="${PRE_STYLE}">${escapeHtml(body)}</pre>`;
}
