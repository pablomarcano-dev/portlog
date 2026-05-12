/// <reference types="cypress" />

/**
 * E2E-S2: App shell — authenticated layout, sidebar nav, logout
 *
 * Covers:
 *   - Authenticated shell renders after programmatic login (no form login)
 *   - User email and role badge visible in header
 *   - Navigation to /master-data and tab strip visible
 *   - Logout clears session and redirects to /login
 */

const OPS_EMAIL = 'ops@portlog.local';
const ADM_EMAIL = 'admin@portlog.local';

// The 10 master-data tab labels defined in MasterDataTabs.tsx
const MASTER_DATA_TAB_LABELS = [
  'Flags',
  'Activities',
  'Cargoes',
  'Ports',
  'Charterers',
  'Shippers',
  'Agents',
  'Operators',
  'Contacts',
  'Ship Particulars',
];

before(() => {
  cy.resetDb();
});

beforeEach(() => {
  cy.loginAsOPS();
  cy.visit('/');
});

describe('Authenticated shell renders', () => {
  it('shows the app shell after login — not the login page', () => {
    // The login page has a heading "Portlog"; the shell header also has "Portlog" but
    // the URL should be "/" not "/login"
    cy.url().should('not.include', '/login');
    // AppShell header is always rendered (Mantine AppShell.Header)
    cy.get('header').should('exist');
  });

  it('displays the logged-in OPS user email in the header', () => {
    cy.get('header').contains(OPS_EMAIL).should('be.visible');
  });

  it('shows the OPS role badge in the header', () => {
    // AppShell renders <Badge variant="light">{currentUser.role}</Badge>
    cy.get('header').contains('OPS').should('be.visible');
  });

  it('shows the ADM role badge when logged in as ADM', () => {
    // Override the beforeEach login with an ADM login
    cy.loginAsADM();
    cy.visit('/');
    cy.get('header').contains(ADM_EMAIL).should('be.visible');
    cy.get('header').contains('ADM').should('be.visible');
  });
});

describe('Master Data navigation', () => {
  it('navigates to /master-data and renders the tab strip', () => {
    cy.visit('/master-data/flags');
    cy.url().should('include', '/master-data');

    // All 10 tab labels should be visible in the tab strip (MasterDataTabs.tsx)
    MASTER_DATA_TAB_LABELS.forEach((label) => {
      cy.contains(label).should('be.visible');
    });
  });

  it('tab strip shows an active tab matching the current route', () => {
    cy.visit('/master-data/flags');
    // The active tab has aria-current="page" (set in MasterDataTabs for isActive tabs)
    cy.get('[aria-current="page"]').contains('Flags').should('be.visible');
  });
});

describe('Logout', () => {
  it('clicking Logout redirects to /login', () => {
    // AppShell renders <Button variant="subtle" size="sm" ...>Logout</Button>
    cy.get('header').contains('button', 'Logout').click();
    cy.url().should('include', '/login');
  });

  it('after logout, visiting / redirects to /login', () => {
    cy.get('header').contains('button', 'Logout').click();
    cy.url().should('include', '/login');
    // Subsequent navigation to "/" should redirect back to login
    cy.visit('/');
    cy.url().should('include', '/login');
  });
});
