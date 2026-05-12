/// <reference types="cypress" />

interface FlagsFixture {
  create: { name: string; abbreviation: string };
  update: { name: string };
}

describe('Flags CRUD', () => {
  beforeEach(() => {
    cy.resetDb();
    cy.loginAsADM();
    cy.visit('/master-data/flags');
  });

  // ── List ─────────────────────────────────────────────────────────────────

  it('renders the list and Flash Search input', () => {
    cy.contains('Flash Search').should('be.visible');
    cy.get('input[placeholder="Search flags..."]').should('be.visible');
  });

  // ── Create (ADM) ──────────────────────────────────────────────────────────

  it('ADM: creates a flag and it appears in the list', () => {
    cy.fixture<FlagsFixture>('flags').then(({ create }) => {
      cy.get('input[name="name"]').clear().type(create.name);
      cy.get('input[name="abbreviation"]').clear().type(create.abbreviation);
      cy.get('button[title="Accept / Save"]').click();

      cy.contains(create.name).should('be.visible');
    });
  });

  // ── Select loads form values ───────────────────────────────────────────────

  it('ADM: selecting a flag loads its values into the form', () => {
    cy.fixture<FlagsFixture>('flags').then(({ create }) => {
      // Create the flag first
      cy.get('input[name="name"]').clear().type(create.name);
      cy.get('input[name="abbreviation"]').clear().type(create.abbreviation);
      cy.get('button[title="Accept / Save"]').click();

      // Wait for it to appear in the list, then click it
      cy.contains(create.name).click();

      cy.get('input[name="name"]').should('have.value', create.name);
      cy.get('input[name="abbreviation"]').should('have.value', create.abbreviation);
    });
  });

  // ── Edit (ADM) ────────────────────────────────────────────────────────────

  it('ADM: edits a flag name and list item reflects the new name', () => {
    cy.fixture<FlagsFixture>('flags').then(({ create, update }) => {
      // Create
      cy.get('input[name="name"]').clear().type(create.name);
      cy.get('input[name="abbreviation"]').clear().type(create.abbreviation);
      cy.get('button[title="Accept / Save"]').click();

      // Select the new flag from the list
      cy.contains(create.name).click();

      // Edit name
      cy.get('input[name="name"]').clear().type(update.name);
      cy.get('button[title="Accept / Save"]').click();

      // List should reflect the updated name
      cy.contains(update.name).should('be.visible');
      cy.contains(create.name).should('not.exist');
    });
  });

  // ── Delete (ADM) ──────────────────────────────────────────────────────────

  it('ADM: deletes a flag via confirmation modal', () => {
    cy.fixture<FlagsFixture>('flags').then(({ create }) => {
      // Create
      cy.get('input[name="name"]').clear().type(create.name);
      cy.get('input[name="abbreviation"]').clear().type(create.abbreviation);
      cy.get('button[title="Accept / Save"]').click();

      // Select
      cy.contains(create.name).click();

      // Click Delete — opens confirmation modal
      cy.get('button[title="Delete record"]').click();

      // Modal title and confirm button
      cy.contains('Confirm Delete').should('be.visible');
      cy.get('.mantine-Modal-content').within(() => {
        cy.get('button').contains('Delete').click();
      });

      // Flag is removed from the list
      cy.contains(create.name).should('not.exist');
    });
  });

  // ── Create (OPS) ──────────────────────────────────────────────────────────

  it('OPS: can create a flag', () => {
    cy.fixture<FlagsFixture>('flags').then(({ create }) => {
      // Re-login as OPS
      cy.loginAsOPS();
      cy.visit('/master-data/flags');

      cy.get('input[name="name"]').clear().type(create.name);
      cy.get('input[name="abbreviation"]').clear().type(create.abbreviation);
      cy.get('button[title="Accept / Save"]').click();

      cy.contains(create.name).should('be.visible');
    });
  });

  // ── Role enforcement — UI (OPS) ────────────────────────────────────────────

  it('OPS: Delete button is absent when a flag is selected', () => {
    cy.fixture<FlagsFixture>('flags').then(({ create }) => {
      // Create as ADM (already logged in from beforeEach)
      cy.get('input[name="name"]').clear().type(create.name);
      cy.get('input[name="abbreviation"]').clear().type(create.abbreviation);
      cy.get('button[title="Accept / Save"]').click();

      // Re-login as OPS
      cy.loginAsOPS();
      cy.visit('/master-data/flags');

      // Select the flag
      cy.contains(create.name).click();

      // Delete button must not exist (ADM-only rendering)
      cy.get('button[title="Delete record"]').should('not.exist');
    });
  });

  // ── Role enforcement — API (OPS) ───────────────────────────────────────────

  it('OPS: direct DELETE request returns 403', () => {
    cy.fixture<FlagsFixture>('flags').then(({ create }) => {
      // Create as ADM to get a real ID
      cy.get('input[name="name"]').clear().type(create.name);
      cy.get('input[name="abbreviation"]').clear().type(create.abbreviation);
      cy.get('button[title="Accept / Save"]').click();

      // Capture the flag id via the list API
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL') as string}/flags`,
        headers: { Authorization: `Bearer ${Cypress.env('ACCESS_TOKEN') as string}` },
      }).then((listResponse) => {
        const body = listResponse.body as { items: Array<{ id: string; name: string }> };
        const flag = body.items.find((f) => f.name === create.name);
        expect(flag, 'created flag found in list').to.exist;
        const flagId = flag!.id;

        // Re-login as OPS
        cy.loginAsOPS();

        cy.request({
          method: 'DELETE',
          url: `${Cypress.env('API_URL') as string}/flags/${flagId}`,
          headers: { Authorization: `Bearer ${Cypress.env('ACCESS_TOKEN') as string}` },
          failOnStatusCode: false,
        }).then((deleteResponse) => {
          expect(deleteResponse.status).to.equal(403);
        });
      });
    });
  });

  // ── Comentarios persistence ────────────────────────────────────────────────

  it('Comentarios value persists across page reload', () => {
    cy.fixture<FlagsFixture>('flags').then(({ create }) => {
      const comments = 'This is a test comment for persistence';

      // Create with Comentarios
      cy.get('input[name="name"]').clear().type(create.name);
      cy.get('input[name="abbreviation"]').clear().type(create.abbreviation);
      cy.get('textarea[name="comments"]').clear().type(comments);
      cy.get('button[title="Accept / Save"]').click();

      // Reload and re-navigate to flags
      cy.reload();
      cy.visit('/master-data/flags');

      // Select the flag
      cy.contains(create.name).click();

      // Comentarios field should show saved value
      cy.get('textarea[name="comments"]').should('have.value', comments);
    });
  });
});
