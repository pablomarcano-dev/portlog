import { EmailTemplateService } from './email-template.service.js';

// These specs render the real files under backend/templates, so they fail if a
// template stops including {{> signature}} or grows a second sign-off. The
// service resolves templates from process.cwd(); jest runs with rootDir=backend,
// which is where templates/ lives.

const VARS = {
  agent_name: 'Franklin Graterol',
  agent_title: 'Fleet Manager',
  agent_email: 'ops@navieramar.com',
  agent_phones: '+1 (786) 834-9963 / +58 414-7883108',
  company_website: 'www.navieramar.com',
  current_year: '2026',
};

const SIGNATURE_ANCHOR = 'Servicios Navieramar (As Agent Only)';
const CONFIDENTIALITY_ANCHOR = 'The content of this email is confidential';

const occurrences = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;
  let templates: string[];

  beforeAll(async () => {
    service = new EmailTemplateService();
    templates = await EmailTemplateService.listTemplates();
  });

  it('finds the email templates and excludes the partials directory', () => {
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((t) => t.endsWith('.hbs'))).toBe(true);
    expect(templates.some((t) => t.includes('_partials'))).toBe(false);
  });

  describe('every template', () => {
    it('renders the shared signature exactly once', async () => {
      const offenders: { template: string; anchors: number; confidentiality: number }[] = [];

      for (const relPath of templates) {
        const { bodyText } = await service.render(relPath, VARS);
        const anchors = occurrences(bodyText, SIGNATURE_ANCHOR);
        const confidentiality = occurrences(bodyText, CONFIDENTIALITY_ANCHOR);
        if (anchors !== 1 || confidentiality !== 1) {
          offenders.push({ template: relPath, anchors, confidentiality });
        }
      }

      expect(offenders).toEqual([]);
    });

    it('signs off exactly once as the agency', async () => {
      const offenders: { template: string; signOffs: number }[] = [];

      for (const relPath of templates) {
        const { bodyText } = await service.render(relPath, VARS);
        // The agency sign-off is "Best Regards," — a quoted master's message may
        // still contain its own lowercase "Best regards," and is left alone.
        const signOffs = occurrences(bodyText, 'Best Regards,');
        if (signOffs !== 1) offenders.push({ template: relPath, signOffs });
      }

      expect(offenders).toEqual([]);
    });

    it('never renders a header label with nothing after it', async () => {
      // to_recipients / cc_recipients were referenced by three templates before
      // anything supplied them, leaving a bare "To:" in the sent email.
      const offenders: { template: string; line: string }[] = [];

      for (const relPath of templates) {
        const { bodyText } = await service.render(relPath, VARS);
        for (const line of bodyText.split('\n')) {
          if (/^(TO|To|CC|Cc|FM|Fm):\s*$/.test(line)) {
            offenders.push({ template: relPath, line });
          }
        }
      }

      expect(offenders).toEqual([]);
    });

    it('leaves no unresolved partial or stale signature markup', async () => {
      const offenders: { template: string; found: string }[] = [];

      for (const relPath of templates) {
        const { bodyText } = await service.render(relPath, VARS);
        for (const stale of ['{{>', 'MAIN OFFICE', 'Covering/Attending', 'Contact Person:']) {
          if (bodyText.includes(stale)) offenders.push({ template: relPath, found: stale });
        }
      }

      expect(offenders).toEqual([]);
    });
  });

  describe('signature partial', () => {
    const ACK = '01_prearrival/00_nomination_acceptance.hbs';

    it('renders the agreed block', async () => {
      const { bodyText } = await service.render(ACK, VARS);

      expect(bodyText).toContain(
        [
          'Best Regards,',
          '',
          'Franklin Graterol',
          'Fleet Manager',
          'Servicios Navieramar (As Agent Only)',
          '✉️ ops@navieramar.com',
          '💬 +1 (786) 834-9963 / +58 414-7883108',
          'OPERATIONAL MATTERS: ops@navieramar.com | www.navieramar.com',
          '✓ 30 Years of Excellence | © 2026 Servicios Navieramar',
        ].join('\n'),
      );
    });

    it('omits the title line when the user has no job title', async () => {
      const { bodyText } = await service.render(ACK, { ...VARS, agent_title: '' });

      expect(bodyText).toContain('Franklin Graterol\nServicios Navieramar (As Agent Only)');
      expect(bodyText).not.toContain('Fleet Manager');
    });

    it('omits the phone line rather than leaving a bare marker', async () => {
      const { bodyText } = await service.render(ACK, { ...VARS, agent_phones: '' });

      expect(bodyText).not.toContain('💬');
    });
  });

  describe('subject header', () => {
    it('compiles the {{!-- Subject: --}} header and strips it from the body', async () => {
      const { subject, bodyText } = await service.render(
        '01_prearrival/00_nomination_acceptance.hbs',
        { ...VARS, ref_line: 'MV Test - Calling to Montevideo SN1/26/MVD' },
      );

      expect(subject).toBe(
        'MV Test - Calling to Montevideo SN1/26/MVD - Agency Appointment Acceptance',
      );
      expect(bodyText).not.toContain('Subject:');
    });

    it('every template declares a subject, so no email silently falls back', async () => {
      const withoutSubject: string[] = [];

      for (const relPath of templates) {
        const { subject } = await service.render(relPath, VARS);
        if (subject === null || subject.trim() === '') withoutSubject.push(relPath);
      }

      expect(withoutSubject).toEqual([]);
    });
  });

  describe('bodyHtml', () => {
    it('wraps plain text in <pre> so the fixed-width layout survives', async () => {
      const { bodyHtml } = await service.render('01_prearrival/00_nomination_acceptance.hbs', VARS);

      expect(bodyHtml.startsWith('<pre style=')).toBe(true);
      expect(bodyHtml.endsWith('</pre>')).toBe(true);
    });
  });
});
