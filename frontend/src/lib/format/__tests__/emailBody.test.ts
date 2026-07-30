import { describe, it, expect } from 'vitest';
import { wrapEmailBody } from '../emailBody';

describe('wrapEmailBody', () => {
  it('wraps plain text so the fixed-width layout survives in a mail client', () => {
    const html = wrapEmailBody('Ref: MT Maran Leo\nLaydays: Jul. 06th-10th, 2026');

    expect(html.startsWith('<pre style=')).toBe(true);
    expect(html.endsWith('</pre>')).toBe(true);
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('Laydays: Jul. 06th-10th, 2026');
  });

  it('preserves the newlines the templates lay out', () => {
    expect(wrapEmailBody('a\nb')).toContain('a\nb');
  });

  it('passes existing HTML through instead of double-wrapping it', () => {
    const already = '<pre style="margin:0;">already wrapped</pre>';

    expect(wrapEmailBody(already)).toBe(already);
  });

  it('ignores leading whitespace when deciding whether the body is HTML', () => {
    const already = '\n  <pre>already wrapped</pre>';

    expect(wrapEmailBody(already)).toBe(already);
  });

  it('wraps a body that merely mentions a tag mid-text', () => {
    expect(wrapEmailBody('use <pre> for layout')).toContain('<pre style=');
  });

  it('escapes markup characters so angle-bracketed text is not swallowed', () => {
    const html = wrapEmailBody('Qty: 20,000 MT <TBC> & subject to survey');

    expect(html).toContain('&lt;TBC&gt;');
    expect(html).toContain('&amp; subject to survey');
  });
});
