describe('Auth flows', () => {
  beforeEach(() => {
    cy.resetDb();
  });

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  it('OPS: correct credentials → lands on /, shell renders, email visible', () => {
    cy.visit('/login');
    cy.get('input[name="email"]').type(Cypress.env('OPS_EMAIL') as string);
    cy.get('input[name="password"]').type(Cypress.env('OPS_PASSWORD') as string);
    cy.get('button[type="submit"]').click();
    cy.url().should('eq', `${Cypress.config('baseUrl') as string}/`);
    cy.contains(Cypress.env('OPS_EMAIL') as string).should('be.visible');
    cy.contains('OPS').should('be.visible');
  });

  it('ADM: correct credentials → lands on /, shell renders, email visible', () => {
    cy.visit('/login');
    cy.get('input[name="email"]').type(Cypress.env('ADM_EMAIL') as string);
    cy.get('input[name="password"]').type(Cypress.env('ADM_PASSWORD') as string);
    cy.get('button[type="submit"]').click();
    cy.url().should('eq', `${Cypress.config('baseUrl') as string}/`);
    cy.contains(Cypress.env('ADM_EMAIL') as string).should('be.visible');
    cy.contains('ADM').should('be.visible');
  });

  it('Wrong password → error message shown, stays on /login', () => {
    cy.visit('/login');
    cy.get('input[name="email"]').type(Cypress.env('OPS_EMAIL') as string);
    cy.get('input[name="password"]').type('wrongpassword123');
    cy.get('button[type="submit"]').click();
    cy.contains('Invalid email or password.').should('be.visible');
    cy.url().should('include', '/login');
  });

  it('Empty form submission → client-side validation errors shown', () => {
    cy.visit('/login');
    cy.get('button[type="submit"]').click();
    // react-hook-form + Zod renders error messages into the DOM
    cy.get('[role="alert"], [class*="error"]').should('have.length.greaterThan', 0);
    cy.url().should('include', '/login');
  });

  // ---------------------------------------------------------------------------
  // Protected route redirect
  // ---------------------------------------------------------------------------

  it('Unauthenticated visit to /master-data/flags → redirected to /login', () => {
    cy.visit('/master-data/flags');
    cy.url().should('include', '/login');
  });

  it('After login, cy.visit("/login") → redirected to /', () => {
    cy.loginAsOPS();
    cy.visit('/login');
    cy.url().should('eq', `${Cypress.config('baseUrl') as string}/`);
  });

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  it('Login as OPS, click logout button → redirected to /login', () => {
    cy.loginAsOPS();
    cy.visit('/');
    cy.contains('button', 'Logout').click();
    cy.url().should('include', '/login');
  });

  it('After logout, cy.visit("/") → redirected to /login', () => {
    cy.loginAsOPS();
    cy.visit('/');
    cy.contains('button', 'Logout').click();
    cy.url().should('include', '/login');
    cy.visit('/');
    cy.url().should('include', '/login');
  });

  // ---------------------------------------------------------------------------
  // Silent refresh
  // ---------------------------------------------------------------------------

  it('cy.loginAsADM() + cy.visit("/") → shell renders without visiting /login', () => {
    cy.loginAsADM();
    cy.visit('/');
    cy.url().should('eq', `${Cypress.config('baseUrl') as string}/`);
    cy.contains(Cypress.env('ADM_EMAIL') as string).should('be.visible');
  });
});
