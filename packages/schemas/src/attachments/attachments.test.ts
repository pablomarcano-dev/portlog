import { resolveAttachmentMimeType } from './index';

describe('attachment MIME fallback', () => {
  it.each(['', 'application/octet-stream', 'application/x-pdf'])(
    'allows a PDF candidate with MIME %j for server verification',
    (mimeType) => {
      expect(resolveAttachmentMimeType('report.PDF', mimeType)).toBe('application/pdf');
    },
  );
  it('does not permit arbitrary binary files or executable MIME types', () => {
    expect(resolveAttachmentMimeType('report.exe', 'application/octet-stream')).toBeNull();
    expect(resolveAttachmentMimeType('report.pdf', 'application/x-msdownload')).toBeNull();
    expect(resolveAttachmentMimeType('report.docx', '')).toBeNull();
  });
  it('preserves the existing allowlist and normalizes MIME casing', () => {
    expect(resolveAttachmentMimeType('report.pdf', 'Application/PDF')).toBe('application/pdf');
    expect(resolveAttachmentMimeType('report.csv', 'text/csv')).toBe('text/csv');
  });
});
