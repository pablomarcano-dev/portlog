/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      loginAsOPS(): Chainable<void>;
      loginAsADM(): Chainable<void>;
      resetDb(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('API_URL') as string}/auth/login`,
    body: { email, password },
    failOnStatusCode: true,
  }).then((response) => {
    cy.getCookie('refresh_token').then((cookie) => {
      if (!cookie) throw new Error('login: refresh_token cookie not set by backend');
    });
    const token = (response.body as { accessToken: string }).accessToken;
    Cypress.env('ACCESS_TOKEN', token);
    // Reload the app with the new session before its in-memory store hydrates.
    // Clearing storage alone can race with a still-running previous session.
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('portlog_at', token);
        win.localStorage.setItem('portlog_at_ts', String(Date.now()));
      },
    });
  });
});

Cypress.Commands.add('loginAsOPS', () => {
  cy.login(Cypress.env('OPS_EMAIL') as string, Cypress.env('OPS_PASSWORD') as string);
});

Cypress.Commands.add('loginAsADM', () => {
  cy.login(Cypress.env('ADM_EMAIL') as string, Cypress.env('ADM_PASSWORD') as string);
});

Cypress.Commands.add('resetDb', () => {
  cy.task('resetDb');
});

export {};
