/**
 * Email bodies are authored as plain text — the templates under `templates/`
 * are fixed-width layouts and the compose editor is a plain textarea. A mail
 * client collapses whitespace in an HTML part, so a body that reaches SMTP
 * unwrapped arrives as one run-on paragraph.
 *
 * This wrapper is the last step before sending, and the only place the markup
 * exists: templates render plain text, the API takes `bodyText`, and the
 * compose UI never sees a tag. Send paths that archive what they mailed call it
 * themselves and store the result; `EmailService.send` applies it to everything
 * else, so a flattened body is impossible no matter which caller supplied it.
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
