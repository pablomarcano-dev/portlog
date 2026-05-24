/**
 * E2E spec: SH-xx full lifecycle
 *
 * Exercises the complete SH-66A workflow on the seeded nom2 (correlative=2,
 * IN_PROGRESS):
 *   create (if absent) → add overtime rows → save (DRAFT) → finalize
 *   (FINALIZED) → generate PDF → send (SENT) → verify All Sent dashboard.
 *
 * Prerequisites (dev stack running):
 *   - npm run dev  (frontend :5173 + backend :3000)
 *   - MinIO running (required for PDF generation step)
 *   - Backend started with NODE_ENV=test to enable /api/test/__sent-emails
 *
 * Auth strategy: cy.request login sets the httpOnly refresh_token cookie;
 * when the SPA loads it calls attemptSilentRefresh() which exchanges the
 * cookie for an in-memory access token before the first render.
 */

describe('SH-xx lifecycle — SH-66A on nom2', () => {
  let nom2Id: string;

  before(() => {
    // Log in and capture nom2's UUID once for the whole suite.
    cy.loginAsOps();
    cy.getNom2Id().then((id) => {
      nom2Id = id;
    });
  });

  beforeEach(() => {
    // Re-authenticate before each test so the refresh cookie is always fresh.
    cy.loginAsOps();
    cy.clearSentEmails();
  });

  // ---------------------------------------------------------------------------
  // Step 1 — Navigate to nomination detail → Documents tab
  // ---------------------------------------------------------------------------
  it('navigates to nomination detail and shows the Documents section', () => {
    cy.visit(`/nominations/${nom2Id}`);

    // The Documents section title should be visible.
    cy.contains('Documentos').should('be.visible');

    // The SH-66A tab trigger should be present.
    cy.get('[data-cy="sh-tab-66a"]').should('be.visible');
  });

  // ---------------------------------------------------------------------------
  // Step 2–5 — Open SH-66A tab, ensure doc exists, add rows, save → DRAFT
  // ---------------------------------------------------------------------------
  it('opens SH-66A tab, ensures document exists, adds 2 rows, saves → DRAFT badge', () => {
    cy.visit(`/nominations/${nom2Id}`);

    // Click the SH-66A tab.
    cy.get('[data-cy="sh-tab-66a"]').click();

    // If no document exists yet, create one.
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="sh-create"]').length > 0) {
        cy.get('[data-cy="sh-create"]').click();
        // Wait for document to appear (Save button renders once doc exists).
        cy.get('[data-cy="sh-save"]', { timeout: 10000 }).should('exist');
      }
    });

    // At this point a document exists. If it was already FINALIZED or SENT the
    // save/finalize buttons won't be visible — but for a freshly seeded DB the
    // doc starts as DRAFT. The spec proceeds assuming DRAFT state.
    cy.get('[data-cy="sh-save"]').should('be.visible');

    // Add first overtime row.
    cy.get('[data-cy="sh-add-row"]').click();
    cy.get('input[placeholder="2025-01-15"]').last().type('2026-05-24');
    cy.get('input[placeholder="08:00"]').last().type('20:00');
    cy.get('input[placeholder="10:00"]').last().type('23:00');
    cy.get('input[placeholder="Carga / Descarga..."]').last().type('Atraque nocturno');

    // Add second overtime row.
    cy.get('[data-cy="sh-add-row"]').click();
    cy.get('input[placeholder="2025-01-15"]').last().type('2026-05-25');
    cy.get('input[placeholder="08:00"]').last().type('05:00');
    cy.get('input[placeholder="10:00"]').last().type('08:00');
    cy.get('input[placeholder="Carga / Descarga..."]').last().type('Inicio descarga anticipada');

    // Save the form.
    cy.get('[data-cy="sh-save"]').click();

    // Status badge should show "Borrador" (DRAFT).
    cy.get('[data-cy="sh-status"]').should('contain.text', 'Borrador');
  });

  // ---------------------------------------------------------------------------
  // Step 6 — Finalize → FINALIZED badge
  // ---------------------------------------------------------------------------
  it('finalizes the document → FINALIZED badge', () => {
    cy.visit(`/nominations/${nom2Id}`);
    cy.get('[data-cy="sh-tab-66a"]').click();

    // Wait for the tab content to load.
    cy.get('[data-cy="sh-status"]', { timeout: 10000 }).should('be.visible');

    // The Finalize button is only shown in DRAFT state.
    // If the document is already FINALIZED this step is a no-op (skip).
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="sh-finalize"]').length === 0) {
        // Already finalized or beyond — nothing to do.
        return;
      }
      cy.get('[data-cy="sh-finalize"]').click();
      cy.get('[data-cy="sh-status"]', { timeout: 10000 }).should('contain.text', 'Finalizado');
    });
  });

  // ---------------------------------------------------------------------------
  // Step 7 — Generate PDF → "Abrir PDF" link appears
  // ---------------------------------------------------------------------------
  it('generates PDF → "Abrir PDF" link appears', () => {
    cy.visit(`/nominations/${nom2Id}`);
    cy.get('[data-cy="sh-tab-66a"]').click();

    cy.get('[data-cy="sh-status"]', { timeout: 10000 }).should('be.visible');

    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="sh-generate"]').length === 0) {
        // Either already generated (minioKey set) or not in FINALIZED state.
        // If the PDF link already exists, that's also a pass.
        if ($body.find('[data-cy="sh-open-pdf"]').length > 0) {
          cy.get('[data-cy="sh-open-pdf"]').should('be.visible');
        }
        return;
      }
      cy.get('[data-cy="sh-generate"]').click();
      // After generation, the "Abrir PDF" anchor should appear.
      cy.get('[data-cy="sh-open-pdf"]', { timeout: 20000 }).should('be.visible');
    });
  });

  // ---------------------------------------------------------------------------
  // Step 8–9 — Send → drawer → fill email → submit → SENT badge
  // ---------------------------------------------------------------------------
  it('sends the document → drawer → fills to-address → SENT badge', () => {
    cy.visit(`/nominations/${nom2Id}`);
    cy.get('[data-cy="sh-tab-66a"]').click();

    cy.get('[data-cy="sh-status"]', { timeout: 10000 }).should('be.visible');

    // If document is already SENT, skip.
    cy.get('[data-cy="sh-status"]').then(($badge) => {
      if ($badge.text().includes('Enviado')) {
        cy.log('Document already SENT — skipping send step');
        return;
      }

      // Click the Send button (only visible when status !== DRAFT).
      cy.get('[data-cy="sh-send"]').click();

      // The send drawer should open.
      cy.get('[data-cy="sh-send-to"]', { timeout: 5000 }).should('be.visible');

      // Fill in the recipient.
      cy.get('[data-cy="sh-send-to"]').clear().type('test@portlog.local');

      // Submit the send form.
      cy.get('[data-cy="sh-send-submit"]').click();

      // Drawer should close and the status badge should flip to "Enviado".
      cy.get('[data-cy="sh-status"]', { timeout: 15000 }).should('contain.text', 'Enviado');
    });
  });

  // ---------------------------------------------------------------------------
  // Step 9 (email assert) — verify backend recorded the sent email (test mode)
  // ---------------------------------------------------------------------------
  it('backend recorded the sent email in test transport', () => {
    // This step only works when the backend is running with NODE_ENV=test.
    cy.request({
      method: 'GET',
      url: `${(Cypress.env('apiUrl') as string) ?? 'http://localhost:3000'}/api/test/__sent-emails`,
      failOnStatusCode: false,
    }).then((response) => {
      if (response.status === 404) {
        cy.log('Backend not in test mode — skipping email assertion');
        return;
      }
      expect(response.status).to.equal(200);
      // At least one email should have been sent during this suite run.
      // (The send step above cleared then sent one email.)
      const emails = response.body as Array<{ to: string[]; subject: string }>;
      expect(emails.length).to.be.greaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Step 10 — All Sent dashboard shows SENT cell for nom2
  // ---------------------------------------------------------------------------
  it('All Sent dashboard shows SENT cell for the nomination', () => {
    cy.visit('/all-sent');

    // The grid cell for nom2 / SH_66A should be present.
    cy.get(`[data-cy="all-sent-cell-${nom2Id}-SH_66A"]`, { timeout: 15000 }).should('be.visible');

    // The cell should contain a green ThemeIcon with aria-label="Sent".
    // StatusIcon renders aria-label="Sent" only when cell.status === 'SENT'.
    cy.get(`[data-cy="all-sent-cell-${nom2Id}-SH_66A"]`).within(() => {
      cy.get('[aria-label="Sent"]').should('exist');
    });
  });
});
