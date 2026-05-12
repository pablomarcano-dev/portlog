/// <reference types="cypress" />

/**
 * E2E-S5: Cargoes CRUD — full OPS/ADM flow + BBL unit field
 *
 * Selectors are derived from the existing component structure:
 *   - MasterDetailShell: left rail list items, Flash Search input, button bar
 *   - ButtonBar: button[title="Accept / Save"], button[title="Delete record"]
 *   - CargoFields: TextInput label="Name", Select label="BBL Unit"
 *   - CommentarioField: Textarea label="Comentarios"
 *   - Mantine Select combobox: input[aria-label] for the dropdown trigger
 *
 * No data-cy attributes were added to frontend code — all selectors use
 * existing aria labels, button titles, and label text.
 */

interface CargoFixture {
  create: { name: string; bblUnit: string };
  update: { name: string; bblUnit: string };
}

const API_URL = Cypress.env('API_URL') as string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Select a Mantine Select value.
 * Mantine 7 renders a combobox: clicking the wrapper opens the dropdown,
 * then we click the option by its label text.
 */
function selectMantineOption(fieldLabel: string, optionLabel: string) {
  // Find the combobox wrapper via the visible label, then click the input to open
  cy.contains('label', fieldLabel)
    .invoke('attr', 'for')
    .then((inputId) => {
      cy.get(`#${inputId}`).click();
    });
  // Click the dropdown option (rendered in a portal outside the form)
  cy.get('[role="option"]').contains(optionLabel).click();
}

/** Read the current value shown in a Mantine Select input by its visible label. */
function getMantineSelectValue(fieldLabel: string): Cypress.Chainable<string> {
  return cy
    .contains('label', fieldLabel)
    .invoke('attr', 'for')
    .then((inputId) => cy.get(`#${inputId}`).invoke('val') as unknown as string);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cargoes CRUD', () => {
  beforeEach(() => {
    cy.resetDb();
    cy.loginAsADM();
    cy.visit('/master-data/cargoes');
  });

  // -------------------------------------------------------------------------
  // 1. Page renders — list panel and Flash Search visible
  // -------------------------------------------------------------------------
  it('renders list panel with Flash Search input on /master-data/cargoes', () => {
    cy.url().should('include', '/master-data/cargoes');
    cy.get('[aria-label="Flash Search"]').should('be.visible');
    // Left rail "Flash Search" label
    cy.contains('Flash Search').should('be.visible');
  });

  // -------------------------------------------------------------------------
  // 2. ADM: create cargo with BBL unit "BBL" → appears in list
  // -------------------------------------------------------------------------
  it('ADM: creates a cargo with bblUnit BBL and it appears in the list', () => {
    cy.fixture<CargoFixture>('cargoes').then(({ create }) => {
      cy.get('input[placeholder="e.g. Crude Oil"]').clear().type(create.name);
      selectMantineOption('BBL Unit', 'BBL — Barrels');
      cy.get('button[title="Accept / Save"]').click();
      cy.contains(create.name).should('be.visible');
    });
  });

  // -------------------------------------------------------------------------
  // 3. ADM: select new cargo → form loads with BBL unit showing "BBL"
  // -------------------------------------------------------------------------
  it('ADM: selecting a cargo loads form values including BBL unit "BBL"', () => {
    cy.fixture<CargoFixture>('cargoes').then(({ create }) => {
      // Create first
      cy.get('input[placeholder="e.g. Crude Oil"]').clear().type(create.name);
      selectMantineOption('BBL Unit', 'BBL — Barrels');
      cy.get('button[title="Accept / Save"]').click();
      cy.contains(create.name).should('be.visible');

      // Deselect (New) then re-select via list
      cy.get('button[title="New record"]').click();
      cy.get('form').find('[style*="cursor: pointer"]').contains(create.name).click();

      // Name field should show the cargo name
      cy.get('input[placeholder="e.g. Crude Oil"]').should('have.value', create.name);
      // BBL unit should show "BBL"
      getMantineSelectValue('BBL Unit').should('include', 'BBL');
    });
  });

  // -------------------------------------------------------------------------
  // 4. ADM: edit name + change BBL unit to "MT" → persists after reload
  // -------------------------------------------------------------------------
  it('ADM: edits cargo name and BBL unit to MT, persists after save and reload', () => {
    cy.fixture<CargoFixture>('cargoes').then(({ create, update }) => {
      // Create
      cy.get('input[placeholder="e.g. Crude Oil"]').clear().type(create.name);
      selectMantineOption('BBL Unit', 'BBL — Barrels');
      cy.get('button[title="Accept / Save"]').click();
      cy.contains(create.name).should('be.visible');

      // Select it
      cy.get('form').find('[style*="cursor: pointer"]').contains(create.name).click();

      // Edit name
      cy.get('input[placeholder="e.g. Crude Oil"]').clear().type(update.name);
      // Change BBL unit
      selectMantineOption('BBL Unit', 'MT — Metric Tons');
      cy.get('button[title="Accept / Save"]').click();

      // List reflects new name
      cy.contains(update.name).should('be.visible');
      cy.contains(create.name).should('not.exist');

      // Reload and re-verify
      cy.reload();
      cy.get('form').find('[style*="cursor: pointer"]').contains(update.name).click();
      cy.get('input[placeholder="e.g. Crude Oil"]').should('have.value', update.name);
      getMantineSelectValue('BBL Unit').should('include', 'MT');
    });
  });

  // -------------------------------------------------------------------------
  // 5. ADM: delete cargo via confirmation modal → removed from list
  // -------------------------------------------------------------------------
  it('ADM: deletes cargo via confirmation modal and it disappears from the list', () => {
    cy.fixture<CargoFixture>('cargoes').then(({ create }) => {
      // Create
      cy.get('input[placeholder="e.g. Crude Oil"]').clear().type(create.name);
      selectMantineOption('BBL Unit', 'BBL — Barrels');
      cy.get('button[title="Accept / Save"]').click();
      cy.contains(create.name).should('be.visible');

      // Select
      cy.get('form').find('[style*="cursor: pointer"]').contains(create.name).click();

      // Delete — opens confirmation modal
      cy.get('button[title="Delete record"]').click();
      // Modal confirm button
      cy.get('[role="dialog"]').contains('button', 'Delete').click();

      // Cargo is gone from list
      cy.contains(create.name).should('not.exist');
    });
  });

  // -------------------------------------------------------------------------
  // 6. OPS: fill form and Save → succeeds (OPS can create)
  // -------------------------------------------------------------------------
  it('OPS: can create a cargo successfully', () => {
    // Re-login as OPS (beforeEach logged in as ADM)
    cy.loginAsOPS();
    cy.visit('/master-data/cargoes');

    cy.fixture<CargoFixture>('cargoes').then(({ create }) => {
      cy.get('input[placeholder="e.g. Crude Oil"]').clear().type(create.name);
      selectMantineOption('BBL Unit', 'BBL — Barrels');
      cy.get('button[title="Accept / Save"]').click();
      cy.contains(create.name).should('be.visible');
    });
  });

  // -------------------------------------------------------------------------
  // 7. OPS: Delete button is absent from the button bar
  // -------------------------------------------------------------------------
  it('OPS: Delete button is absent from the button bar', () => {
    cy.loginAsOPS();
    cy.visit('/master-data/cargoes');
    cy.get('button[title="Delete record"]').should('not.exist');
  });

  // -------------------------------------------------------------------------
  // 8. OPS: Direct API DELETE → 403
  // -------------------------------------------------------------------------
  it('OPS: direct API DELETE /cargoes/:id returns 403', () => {
    // Create a cargo as ADM first to have an id to target
    cy.fixture<CargoFixture>('cargoes').then(({ create }) => {
      cy.get('input[placeholder="e.g. Crude Oil"]').clear().type(create.name);
      selectMantineOption('BBL Unit', 'BBL — Barrels');
      cy.get('button[title="Accept / Save"]').click();
      cy.contains(create.name).should('be.visible');

      // Get the cargo id from the API
      cy.request<{ items: Array<{ id: string; name: string }> }>({
        method: 'GET',
        url: `${API_URL}/cargoes`,
        headers: { Authorization: `Bearer ${Cypress.env('ACCESS_TOKEN') as string}` },
      }).then((res) => {
        const cargo = res.body.items.find((c) => c.name === create.name);
        expect(cargo).to.exist;
        const cargoId = cargo!.id;

        // Now switch to OPS and attempt DELETE
        cy.loginAsOPS();
        cy.request({
          method: 'DELETE',
          url: `${API_URL}/cargoes/${cargoId}`,
          headers: { Authorization: `Bearer ${Cypress.env('ACCESS_TOKEN') as string}` },
          failOnStatusCode: false,
        }).then((deleteRes) => {
          expect(deleteRes.status).to.equal(403);
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // 9. Comentarios persists across reload
  // -------------------------------------------------------------------------
  it('Comentarios value persists after save and reload', () => {
    const commentText = 'Persisted comment for cargo';

    cy.fixture<CargoFixture>('cargoes').then(({ create }) => {
      // Create cargo with a comment
      cy.get('input[placeholder="e.g. Crude Oil"]').clear().type(create.name);
      selectMantineOption('BBL Unit', 'BBL — Barrels');
      cy.get('textarea[placeholder="Add comments..."]').clear().type(commentText);
      cy.get('button[title="Accept / Save"]').click();
      cy.contains(create.name).should('be.visible');

      // Reload page and re-select
      cy.reload();
      cy.get('form').find('[style*="cursor: pointer"]').contains(create.name).click();

      // Comentarios should show saved value
      cy.get('textarea[placeholder="Add comments..."]').should('have.value', commentText);
    });
  });

  // -------------------------------------------------------------------------
  // 10. BBL unit Select shows all 4 options: BBL, MT, KG, LT
  // -------------------------------------------------------------------------
  it('BBL unit Select shows exactly 4 options: BBL, MT, KG, LT', () => {
    // Open the BBL Unit dropdown
    cy.contains('label', 'BBL Unit')
      .invoke('attr', 'for')
      .then((inputId) => {
        cy.get(`#${inputId}`).click();
      });

    // All 4 options must be present
    cy.get('[role="option"]').should('have.length', 4);
    cy.get('[role="option"]').eq(0).should('contain.text', 'BBL');
    cy.get('[role="option"]').eq(1).should('contain.text', 'MT');
    cy.get('[role="option"]').eq(2).should('contain.text', 'KG');
    cy.get('[role="option"]').eq(3).should('contain.text', 'LT');
  });
});
