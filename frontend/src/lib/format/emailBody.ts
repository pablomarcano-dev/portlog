/**
 * Email bodies are authored and edited as plain text — the templates under
 * `backend/templates/` are fixed-width layouts, and the compose editor is a
 * plain textarea. Mail clients collapse whitespace in HTML, so the text is
 * wrapped in a monospace `<pre>` at send time.
 *
 * This mirrors `EmailTemplateService.wrapPlainText` on the backend. Both sides
 * need it: the backend wraps what it renders, the frontend wraps what the agent
 * typed. Keep the two in step — a divergence shows up as a font change between
 * a template-composed email and a hand-edited one.
 */

const PRE_STYLE =
  "font-family:'Courier New',Consolas,monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;padding:16px;margin:0;";

/** Escapes the three characters that would otherwise be read as markup. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Wraps a plain-text email body for HTML display, preserving its layout.
 * Content that is already HTML passes through untouched, so callers can hand
 * over either form without risking a double wrap.
 */
export function wrapEmailBody(bodyText: string): string {
  if (bodyText.trimStart().startsWith('<')) return bodyText;
  return `<pre style="${PRE_STYLE}">${escapeHtml(bodyText)}</pre>`;
}
