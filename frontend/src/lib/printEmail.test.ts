import { afterEach, describe, expect, it, vi } from 'vitest';
import { openEmailPrintWindow, printEmail, printStoredEmail } from './printEmail';

function makeWindow() {
  const elements: {
    tag: string;
    textContent: string;
    style: { cssText: string; height?: string };
    srcdoc: string;
    onload: (() => void) | null;
    setAttribute: ReturnType<typeof vi.fn>;
    contentDocument: { documentElement: { scrollHeight: number } };
  }[] = [];
  const doc = {
    title: '',
    body: { textContent: '', replaceChildren: vi.fn(), style: { cssText: '' }, append: vi.fn() },
    createElement(tag: string) {
      const element = {
        tag,
        textContent: '',
        style: { cssText: '' },
        srcdoc: '',
        onload: null as (() => void) | null,
        setAttribute: vi.fn(),
        contentDocument: { documentElement: { scrollHeight: 400 } },
      };
      elements.push(element);
      return element;
    },
  };
  const win = { document: doc, closed: false, opener: {}, focus: vi.fn(), print: vi.fn() };
  return { win, elements, browserWindow: win as unknown as Window };
}

afterEach(() => vi.unstubAllGlobals());

describe('email printing', () => {
  it('reserves a window without printing before send succeeds', () => {
    const { win, browserWindow } = makeWindow();
    vi.stubGlobal('window', { open: vi.fn(() => browserWindow) });
    expect(openEmailPrintWindow()).toBe(browserWindow);
    expect(win.opener).toBeNull();
    expect(win.print).not.toHaveBeenCalled();
  });

  it('renders subject, recipients and compose body as literal text', () => {
    const { win, browserWindow, elements } = makeWindow();
    const attack = '<img src=x onerror="alert(1)">';
    printEmail(browserWindow, {
      subject: attack,
      toAddresses: [attack],
      ccAddresses: [],
      bodyText: attack,
    });
    expect(win.document.title).toBe(attack);
    expect(elements[0]?.textContent).toContain(`Subject: ${attack}`);
    expect(elements[1]?.textContent).toBe(attack);
    expect(win.print).toHaveBeenCalledOnce();
  });

  it('prints sent timestamps in 24-hour format', () => {
    const { browserWindow, elements } = makeWindow();
    printEmail(browserWindow, {
      subject: 'ETA',
      toAddresses: [],
      ccAddresses: [],
      bodyText: '',
      sentAt: new Date(2026, 9, 5, 16, 35).toISOString(),
    });
    expect(elements[0]?.textContent).toContain('16:35');
    expect(elements[0]?.textContent).not.toMatch(/\b(?:AM|PM)\b/);
  });

  it('sandboxes archived HTML and waits for it to load before printing', () => {
    const { win, browserWindow, elements } = makeWindow();
    vi.stubGlobal('window', { open: vi.fn(() => browserWindow) });
    const html = '<script>alert(1)</script><p>Message</p>';
    printStoredEmail({ subject: 'Stored', toAddresses: [], ccAddresses: [], bodyHtml: html });
    const frame = elements.find((element) => element.tag === 'iframe');
    expect(frame?.setAttribute).toHaveBeenCalledWith('sandbox', 'allow-same-origin');
    expect(frame?.srcdoc).toBe(html);
    expect(win.print).not.toHaveBeenCalled();
    frame?.onload?.();
    expect(win.print).toHaveBeenCalledOnce();
  });

  it('does nothing for a blocked or already closed print window', () => {
    const { win, browserWindow } = makeWindow();
    const message = { subject: 'Test', toAddresses: [], ccAddresses: [], bodyText: '' };
    printEmail(null, message);
    win.closed = true;
    printEmail(browserWindow, message);
    expect(win.print).not.toHaveBeenCalled();
  });
});
