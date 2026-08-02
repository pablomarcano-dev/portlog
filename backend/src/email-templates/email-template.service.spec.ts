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
      // anything supplied them, leaving a bare "To:" in the sent email. The
      // laycan/cargo labels went the same way on a nomination with no laydays
      // or parcels yet, so they are guarded and asserted here too.
      //
      // "Lay Days  :" (the SOF-family spelling) is deliberately not covered —
      // those ~20 templates still render it unguarded.
      const offenders: { template: string; line: string }[] = [];

      for (const relPath of templates) {
        const { bodyText } = await service.render(relPath, VARS);
        for (const line of bodyText.split('\n')) {
          if (/^(TO|To|CC|Cc|FM|Fm|Laydays|Laycan|Load|To Load):\s*$/.test(line)) {
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

  // -------------------------------------------------------------------------
  // These templates are plain text. Handlebars escapes for HTML by default,
  // which mangled ordinary punctuation in company and cargo names — and then
  // wrapPlainTextEmailBody escaped it a second time on the way out.
  // -------------------------------------------------------------------------
  describe('escaping', () => {
    const PUNCTUATED = {
      ...VARS,
      vessel_name: `MARAN APHRODITE 2X16"`,
      operation: `Ship's cargo — PDVSA PETROLEO, S.A. C&S`,
    };

    it('leaves punctuation in interpolated values alone', async () => {
      const { bodyText } = await service.render(
        '02_statement_of_facts/15_final_sof.hbs',
        PUNCTUATED,
      );

      expect(bodyText).toContain(`Ship's cargo — PDVSA PETROLEO, S.A. C&S`);
      expect(bodyText).toContain(`2X16"`);
      expect(bodyText).not.toContain('&#x27;');
      expect(bodyText).not.toContain('&amp;');
      expect(bodyText).not.toContain('&quot;');
    });

    it('escapes exactly once, when wrapping for the mail client', async () => {
      const { bodyHtml } = await service.render(
        '02_statement_of_facts/15_final_sof.hbs',
        PUNCTUATED,
      );

      // "C&S" must arrive as "C&amp;S", never the double-escaped "C&amp;amp;S".
      expect(bodyHtml).toContain('C&amp;S');
      expect(bodyHtml).not.toContain('&amp;amp;');
    });
  });

  // -------------------------------------------------------------------------
  // The pre-arrival notification is the letter the Master reads on approach, so
  // its header block is pinned line by line.
  // -------------------------------------------------------------------------
  describe('pre-arrival notification', () => {
    const PREARRIVAL = '01_prearrival/10_prearrival_notification.hbs';

    const FULL = {
      ...VARS,
      vessel_name: 'MT Maran Leo',
      operator_name: 'Maran Tankers Management INC Ops Dpt',
      voyage_no: '031',
      ref_no: 'RIL CP Dec 02nd-24',
      terminal_name: 'PDVSA TAECJAA OFF-SHORE PLATFORM, JOSE',
      sn_ot_ref: 'SN1522/24/JSE',
      lay_days_long: 'Jul. 06th-10th, 2026',
      cargo_quantity: '1,900,000',
      cargo_unit: 'BBLS',
      cargo_grade: 'MEREY 16 CRUDE OIL',
      master_name: 'Anjan Saini',
      charterer_name: 'Reliance Industries Limited',
    };

    it('renders the agreed header block', async () => {
      const { bodyText } = await service.render(PREARRIVAL, FULL);

      expect(bodyText.split('-----')[0].trimEnd()).toBe(
        [
          'To: MT Maran Leo',
          'Cc: Maran Tankers Management INC Ops Dpt',
          'Fm: Servicios Navieramar, C.A. (as Agent Only)',
          'Ref: MT Maran Leo Voy. 031/ RIL CP Dec 02nd-24 Calling to PDVSA TAECJAA OFF-SHORE PLATFORM, JOSE SN1522/24/JSE',
          'Laydays: Jul. 06th-10th, 2026',
          'Load: 1,900,000 BBLS MEREY 16 CRUDE OIL +/- 10%',
        ].join('\n'),
      );
    });

    it('states the cargo quantity with its unit', async () => {
      // The unit was missing from the Load line, so a 1,900,000 BBLS fixture
      // read as a bare "1900000".
      const { bodyText } = await service.render(PREARRIVAL, FULL);

      expect(bodyText).toContain('Load: 1,900,000 BBLS MEREY 16 CRUDE OIL +/- 10%');
    });

    it('drops the optional header lines rather than leaving bare labels', async () => {
      const { bodyText } = await service.render(PREARRIVAL, {
        ...FULL,
        operator_name: '',
        lay_days_long: '',
        cargo_quantity: '',
      });

      expect(bodyText).not.toMatch(/^Cc:/m);
      expect(bodyText).not.toMatch(/^Laydays:/m);
      expect(bodyText).not.toMatch(/^Load:/m);
      expect(bodyText).toContain('To: MT Maran Leo');
    });

    it('omits the charter-party reference when none is recorded', async () => {
      const { bodyText } = await service.render(PREARRIVAL, { ...FULL, ref_no: '' });

      expect(bodyText).toContain(
        'Ref: MT Maran Leo Voy. 031 Calling to PDVSA TAECJAA OFF-SHORE PLATFORM, JOSE SN1522/24/JSE',
      );
    });

    it('greets the Master without a dangling space when no name is recorded', async () => {
      const { bodyText } = await service.render(PREARRIVAL, { ...FULL, master_name: '' });

      expect(bodyText).toContain('Dear Master, good day!');
    });

    it('drops the charterer clause rather than stranding "on behalf of"', async () => {
      const { bodyText } = await service.render(PREARRIVAL, { ...FULL, charterer_name: '' });

      expect(bodyText).toContain('We have been appointed to attend your vessel');
      expect(bodyText).not.toContain('on behalf of Charterers');
    });

    it('asks for the documents the port authorities require on board', async () => {
      const { bodyText } = await service.render(PREARRIVAL, FULL);

      for (const doc of [
        'Crew List',
        'Maritime Declaration of Health',
        'Ship Sanitation Control Exemption Certificate',
        'MARPOL Certificate 78-73 (IOPP & IAPP)',
        'Declaration of Security',
      ]) {
        expect(bodyText).toContain(doc);
      }
    });
  });
});
