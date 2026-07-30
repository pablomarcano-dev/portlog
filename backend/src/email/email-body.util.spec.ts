import { wrapPlainTextEmailBody } from './email-body.util.js';

describe('wrapPlainTextEmailBody', () => {
  it('wraps plain text so the fixed-width layout survives in a mail client', () => {
    const html = wrapPlainTextEmailBody('Ref: MT Maran Leo\nLaydays: Jul. 06th-10th, 2026');

    expect(html.startsWith('<pre style=')).toBe(true);
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('Ref: MT Maran Leo\nLaydays: Jul. 06th-10th, 2026');
  });

  it('passes an already-HTML body through instead of double-wrapping it', () => {
    const already = '<pre style="margin:0;">already wrapped</pre>';

    expect(wrapPlainTextEmailBody(already)).toBe(already);
  });

  it('ignores leading whitespace when deciding whether the body is HTML', () => {
    const already = '\n    <div>credentials email</div>';

    expect(wrapPlainTextEmailBody(already)).toBe(already);
  });

  it('escapes markup characters so angle-bracketed text is not swallowed', () => {
    const html = wrapPlainTextEmailBody('Qty: 20,000 MT <TBC> & subject to survey');

    expect(html).toContain('&lt;TBC&gt;');
    expect(html).toContain('&amp; subject to survey');
  });
});
