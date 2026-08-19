/// <reference types="cypress" />

export {};

/**
 * E2E: who an ETA notice is actually addressed to.
 *
 * The agency's review (2026-08-05) raised two complaints about the master-facing
 * ETA notices, and this spec pins both:
 *
 *   1. The printed header showed the recipients' raw email addresses. It must
 *      name the vessel, her master and the owner/operator companies instead.
 *   2. Those notices went to the charterer's operations desk. A notice addressed
 *      "dear Master" has to reach the vessel.
 *
 * The second point changes who receives a legally binding notice, so it is
 * asserted from both ends: the addresses really move to the vessel, AND they do
 * not move for the notices that were always meant for the charterer. A test that
 * only proved the first half would pass just as happily if the change had
 * redirected every notice in the system.
 */

const API_URL = Cypress.env('API_URL') as string;

// Mirrors ETA_FIXTURE in cypress/tasks/db.ts. All `.test` domains (RFC 2606),
// one address per role so an assertion is never ambiguous about what it caught.
const F = {
  vesselEmail: 'master@e2e-vessel.test',
  operatorEmail: 'operator-box@e2e-operator.test',
  operatorContactEmail: 'operator-contact@e2e-operator.test',
  ownerContactEmail: 'owner-contact@e2e-owner.test',
  chartererTo: 'charterer@e2e-charterer.test',
  chartererCc: 'charterer-cc@e2e-charterer.test',
  operatorName: 'E2E Operator Ltd',
  ownerName: 'E2E Owner AS',
  masterName: 'CAPT E2E TESTER',
  vesselWithEmail: 'MV E2E RECIPIENT',
} as const;

interface ComposeData {
  subject: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  bodyText: string;
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${Cypress.env('ACCESS_TOKEN') as string}` };
}

function compose(nominationId: string, action: string): Cypress.Chainable<ComposeData> {
  return cy
    .request({
      method: 'GET',
      url: `${API_URL}/nominations/${nominationId}/compose/${action}`,
      headers: authHeaders(),
    })
    .then((res) => res.body as ComposeData);
}

/** The letter's addressing block — everything above the "Ref:" line. */
function header(bodyText: string): string {
  const idx = bodyText.indexOf('Ref:');
  return idx === -1 ? bodyText : bodyText.slice(0, idx);
}

describe('ETA notices — recipients and header', () => {
  let withEmail: string;
  let withoutEmail: string;

  before(() => {
    // Deliberately no cy.resetDb(): that TRUNCATEs users with CASCADE, which
    // takes every nomination and PEDR with it. This spec builds and tears down
    // its own fixture, so it has no reason to empty the database around itself.
    cy.loginAsOPS();
    cy.task<{ withEmail: string; withoutEmail: string }>('seedEtaRecipientFixture').then((ids) => {
      withEmail = ids.withEmail;
      withoutEmail = ids.withoutEmail;
    });
  });

  after(() => {
    cy.task('cleanupEtaRecipientFixture');
  });

  // ── 1. The envelope moves to the vessel ────────────────────────────────────
  it('1. ETA_REQUEST is addressed to the vessel, not the charterer', () => {
    compose(withEmail, 'ETA_REQUEST').then((d) => {
      expect(d.toAddresses, 'To: the vessel').to.include(F.vesselEmail);
      expect(d.toAddresses, 'To: not the charterer').to.not.include(F.chartererTo);
    });
  });

  it('2. ETA_REQUEST copies the owner and operator', () => {
    compose(withEmail, 'ETA_REQUEST').then((d) => {
      const cc = d.ccAddresses.join(' ');
      expect(cc, 'operator mailbox').to.contain(F.operatorEmail);
      expect(cc, 'operator contact').to.contain(F.operatorContactEmail);
      expect(cc, 'owner contact').to.contain(F.ownerContactEmail);
    });
  });

  it('3. ETA_REPLY is addressed the same way', () => {
    compose(withEmail, 'ETA_REPLY').then((d) => {
      expect(d.toAddresses).to.include(F.vesselEmail);
      expect(d.toAddresses).to.not.include(F.chartererTo);
    });
  });

  // ── 2. The printed header names companies, never addresses ─────────────────
  it('4. the header names the vessel and her master', () => {
    compose(withEmail, 'ETA_REQUEST').then((d) => {
      const h = header(d.bodyText);
      expect(h).to.contain(F.vesselWithEmail);
      expect(h).to.contain(`Attn: Master ${F.masterName}`);
    });
  });

  it('5. the header names the owner and operator companies', () => {
    compose(withEmail, 'ETA_REQUEST').then((d) => {
      const h = header(d.bodyText);
      expect(h).to.contain(`Cc: ${F.ownerName}`);
      expect(h).to.contain(`Cc: ${F.operatorName}`);
    });
  });

  it('6. the header leaks no email address at all', () => {
    // The agency's actual complaint. Asserted against the shape of an address
    // rather than the fixture's specific ones, so this still fails if some
    // unrelated address finds its way into the header later.
    compose(withEmail, 'ETA_REQUEST').then((d) => {
      const found = header(d.bodyText).match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? [];
      expect(found, `header should carry no addresses, found: ${found.join(', ')}`).to.be.empty;
    });
  });

  // ── 3. The change is scoped — other notices are untouched ──────────────────
  it('7. ACKNOWLEDGEMENT still goes to the charterer', () => {
    compose(withEmail, 'ACKNOWLEDGEMENT').then((d) => {
      expect(d.toAddresses, 'unchanged for non-master notices').to.include(F.chartererTo);
      expect(d.toAddresses).to.not.include(F.vesselEmail);
    });
  });

  // ── 4. Degrades safely when the vessel has no address on file ──────────────
  it('8. falls back to the charterer when the vessel has no address', () => {
    compose(withoutEmail, 'ETA_REQUEST').then((d) => {
      expect(d.toAddresses, 'falls back rather than sending nowhere').to.include(F.chartererTo);
      expect(d.toAddresses).to.not.be.empty;
    });
  });

  // ── 5. The computed countdown reaches the subject ──────────────────────────
  it('9. the subject carries the computed ETA countdown', () => {
    // Fixture ETA is 5 days out, so the label is in days, not hours.
    compose(withEmail, 'ETA_REPLY').then((d) => {
      expect(d.subject).to.match(/\d+ DAYS ETA Notice$/);
      expect(d.subject, 'no longer hardcoded').to.not.contain('96 Hours');
    });
  });
});
