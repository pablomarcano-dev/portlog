/// <reference types="cypress" />

const API_URL = Cypress.env('API_URL') as string;

// Selectors derived from MasterDetailShell, ButtonBar, FlashSearch, CommentarioField source.
// No data-cy attributes exist — all selectors use title, aria-label, and label text.
const SEL = {
  flashSearchInput: 'input[aria-label="Flash Search"]',
  nameInput: 'input[name="name"]',
  commentsTextarea: 'textarea[name="comments"]',
  acceptButton: 'button[title="Accept / Save"]',
  deleteButton: 'button[title="Delete record"]',
  // Confirmation modal "Delete" button — red button inside the modal footer group
  confirmDeleteButton: '.mantine-Modal-content button[color="red"], .mantine-Modal-body ~ * button',
  newButton: 'button[title="New record"]',
};

// Helper: click the red "Delete" button inside the confirmation modal.
// The modal renders two buttons: "Cancel" (default) and "Delete" (red).
// We match by text within the modal overlay.
function confirmDelete() {
  cy.get('.mantine-Modal-root').within(() => {
    cy.contains('button', 'Delete').click();
  });
}

describe('Activities CRUD — E2E-S4', () => {
  beforeEach(() => {
    cy.resetDb();
    cy.loginAsADM();
    cy.visit('/master-data/activities');
  });

  // ── 1. List renders ──────────────────────────────────────────────────────────
  it('1. navigates to /master-data/activities and list panel renders', () => {
    cy.url().should('include', '/master-data/activities');
    // Left rail exists with "Flash Search" label
    cy.contains('Flash Search').should('be.visible');
  });

  // ── 2. Flash Search input visible ────────────────────────────────────────────
  it('2. Flash Search input is visible', () => {
    cy.get(SEL.flashSearchInput).should('be.visible');
  });

  // ── 3. ADM: Create → appears in list ─────────────────────────────────────────
  it('3. ADM: fills form with fixture create data and saves — new activity appears in list', () => {
    cy.fixture('activities').then((fix: { create: { name: string }; update: { name: string } }) => {
      cy.get(SEL.nameInput).clear().type(fix.create.name);
      cy.get(SEL.acceptButton).click();
      cy.contains(fix.create.name).should('be.visible');
    });
  });

  // ── 4. ADM: Select → form loads values ────────────────────────────────────────
  it('4. ADM: selecting a list item loads its name into the form', () => {
    cy.fixture('activities').then((fix: { create: { name: string }; update: { name: string } }) => {
      // Create first
      cy.get(SEL.nameInput).clear().type(fix.create.name);
      cy.get(SEL.acceptButton).click();
      cy.contains(fix.create.name).should('be.visible');

      // Click new to deselect, then reselect
      cy.get(SEL.newButton).click();
      cy.contains(fix.create.name).click();
      cy.get(SEL.nameInput).should('have.value', fix.create.name);
    });
  });

  // ── 5. ADM: Edit → name updated in list ───────────────────────────────────────
  it('5. ADM: edits name and saves — list item reflects new name', () => {
    cy.fixture('activities').then((fix: { create: { name: string }; update: { name: string } }) => {
      // Create
      cy.get(SEL.nameInput).clear().type(fix.create.name);
      cy.get(SEL.acceptButton).click();
      cy.contains(fix.create.name).should('be.visible');

      // Select it
      cy.contains(fix.create.name).click();
      cy.get(SEL.nameInput).should('have.value', fix.create.name);

      // Edit and save
      cy.get(SEL.nameInput).clear().type(fix.update.name);
      cy.get(SEL.acceptButton).click();

      // Old name gone, new name present
      cy.contains(fix.update.name).should('be.visible');
      cy.contains(fix.create.name).should('not.exist');
    });
  });

  // ── 6. ADM: Delete → removed from list ────────────────────────────────────────
  it('6. ADM: selects activity, clicks Delete, confirms modal — activity removed from list', () => {
    cy.fixture('activities').then((fix: { create: { name: string }; update: { name: string } }) => {
      // Create
      cy.get(SEL.nameInput).clear().type(fix.create.name);
      cy.get(SEL.acceptButton).click();
      cy.contains(fix.create.name).should('be.visible');

      // Select
      cy.contains(fix.create.name).click();
      cy.get(SEL.deleteButton).should('be.visible').click();

      // Confirm in modal
      confirmDelete();

      // Removed from list
      cy.contains(fix.create.name).should('not.exist');
    });
  });

  // ── 7. OPS: Create → succeeds ──────────────────────────────────────────────────
  it('7. OPS: can create an activity', () => {
    // Re-login as OPS (resetDb already ran in beforeEach as ADM, this visit is a fresh state)
    cy.loginAsOPS();
    cy.visit('/master-data/activities');

    cy.fixture('activities').then((fix: { create: { name: string }; update: { name: string } }) => {
      cy.get(SEL.nameInput).clear().type(fix.create.name);
      cy.get(SEL.acceptButton).click();
      cy.contains(fix.create.name).should('be.visible');
    });
  });

  // ── 8. OPS: Delete button absent/disabled ──────────────────────────────────────
  it('8. OPS: Delete button is absent for OPS users', () => {
    cy.loginAsOPS();
    cy.visit('/master-data/activities');

    // First create a record as ADM via API so there is something to select
    cy.loginAsADM();
    cy.fixture('activities').then((fix: { create: { name: string }; update: { name: string } }) => {
      cy.get(SEL.nameInput).clear().type(fix.create.name);
      cy.get(SEL.acceptButton).click();
      cy.contains(fix.create.name).should('be.visible');

      // Now switch to OPS
      cy.loginAsOPS();
      cy.visit('/master-data/activities');
      cy.contains(fix.create.name).click();

      // Delete button must not exist in the DOM (ButtonBar conditionally renders it only for ADM)
      cy.get(SEL.deleteButton).should('not.exist');
    });
  });

  // ── 9. OPS: Direct DELETE API → 403 ────────────────────────────────────────────
  it('9. OPS: direct DELETE /api/activities/:id returns 403', () => {
    // Create a record as ADM first
    cy.fixture('activities').then((fix: { create: { name: string }; update: { name: string } }) => {
      cy.get(SEL.nameInput).clear().type(fix.create.name);
      cy.get(SEL.acceptButton).click();
      cy.contains(fix.create.name).should('be.visible');

      // Get the record id from the list via the API as ADM
      cy.request({
        method: 'GET',
        url: `${API_URL}/activities`,
        headers: { Authorization: `Bearer ${Cypress.env('ACCESS_TOKEN') as string}` },
      }).then((listResp) => {
        const items = (listResp.body as { items: { id: string; name: string }[] }).items;
        const created = items.find((i) => i.name === fix.create.name);
        expect(created).to.exist;
        const id = created!.id;

        // Switch to OPS token
        cy.loginAsOPS();

        // Attempt DELETE with OPS token
        cy.request({
          method: 'DELETE',
          url: `${API_URL}/activities/${id}`,
          headers: { Authorization: `Bearer ${Cypress.env('ACCESS_TOKEN') as string}` },
          failOnStatusCode: false,
        }).then((resp) => {
          expect(resp.status).to.eq(403);
        });
      });
    });
  });

  // ── 10. Comentarios persists across reload ─────────────────────────────────────
  it('10. Comentarios field value persists across page reload', () => {
    cy.fixture('activities').then((fix: { create: { name: string }; update: { name: string } }) => {
      const commentText = 'Persisted comment for test';

      // Create activity with a comment
      cy.get(SEL.nameInput).clear().type(fix.create.name);
      cy.get(SEL.commentsTextarea).clear().type(commentText);
      cy.get(SEL.acceptButton).click();
      cy.contains(fix.create.name).should('be.visible');

      // Reload the page
      cy.reload();

      // Re-select the activity
      cy.contains(fix.create.name).click();

      // Comments should still be there
      cy.get(SEL.commentsTextarea).should('have.value', commentText);
    });
  });

  // ── 11. Flash Search filters list ──────────────────────────────────────────────
  it('11. Flash Search: typing partial name filters to matching items', () => {
    cy.fixture('activities').then((fix: { create: { name: string }; update: { name: string } }) => {
      // Create two activities: one named with fix.create.name, one with a different name
      cy.get(SEL.nameInput).clear().type(fix.create.name);
      cy.get(SEL.acceptButton).click();
      cy.contains(fix.create.name).should('be.visible');

      cy.get(SEL.newButton).click();
      cy.get(SEL.nameInput).clear().type('Unrelated Activity XYZ');
      cy.get(SEL.acceptButton).click();
      cy.contains('Unrelated Activity XYZ').should('be.visible');

      // Type partial name into Flash Search
      cy.get(SEL.flashSearchInput).type('Test Act');

      // Wait for debounce (300ms) and results to appear
      cy.contains(fix.create.name, { timeout: 2000 }).should('be.visible');
      cy.contains('Unrelated Activity XYZ').should('not.exist');
    });
  });
});
