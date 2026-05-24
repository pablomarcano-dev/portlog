// ---------------------------------------------------------------------------
// Custom Cypress commands for the Portlog E2E suite
// ---------------------------------------------------------------------------

const API_URL = (Cypress.env('apiUrl') as string | undefined) ?? 'http://localhost:3000';

/**
 * Log in via the REST API.  The backend sets an httpOnly refresh_token cookie
 * which Cypress stores in its own cookie jar.  When the SPA subsequently loads
 * it calls attemptSilentRefresh(), exchanges that cookie for an in-memory
 * access token, and renders as authenticated.
 */
Cypress.Commands.add('loginAsOps', () => {
  cy.request({
    method: 'POST',
    url: `${API_URL}/api/auth/login`,
    body: { email: 'ops@portlog.local', password: 'portlog_ops_dev' },
    failOnStatusCode: true,
  });
  // The access token returned in the response body cannot be used directly
  // because the frontend stores it in an in-memory module variable.
  // We rely on the httpOnly refresh_token cookie being present when the SPA
  // boots and calls attemptSilentRefresh().
});

/**
 * Look up the nomination with correlative=2 via the API.
 * The backend uses the refresh_token cookie (credentials: include) to refresh
 * the access token for this request.  Because this is a direct cy.request to
 * the backend the frontend in-memory token is irrelevant here.
 *
 * Returns the nomination id as the subject of the Cypress chain.
 */
Cypress.Commands.add('getNom2Id', () => {
  // First get a fresh access token via the refresh endpoint
  cy.request({
    method: 'POST',
    url: `${API_URL}/api/auth/refresh`,
    failOnStatusCode: true,
  }).then((refreshRes) => {
    const accessToken = (refreshRes.body as { accessToken: string }).accessToken;
    return cy
      .request({
        method: 'GET',
        url: `${API_URL}/api/nominations?limit=50`,
        headers: { Authorization: `Bearer ${accessToken}` },
        failOnStatusCode: true,
      })
      .then((response) => {
        const body = response.body as {
          items: Array<{ id: string; correlative: number }>;
        };
        const nom2 = body.items.find((n) => n.correlative === 2);
        if (!nom2) throw new Error('nom2 (correlative=2) not found in nominations list');
        return nom2.id;
      });
  });
});

/**
 * Clear the in-memory sent-emails store on the backend (test mode only).
 */
Cypress.Commands.add('clearSentEmails', () => {
  cy.request({
    method: 'DELETE',
    url: `${API_URL}/api/test/__sent-emails`,
    failOnStatusCode: false,
  });
});

// ---------------------------------------------------------------------------
// TypeScript declarations
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Log in as the seeded OPS user; sets httpOnly refresh_token cookie. */
      loginAsOps(): Chainable<void>;
      /** Fetch the UUID of nom2 (correlative=2) via the API. */
      getNom2Id(): Chainable<string>;
      /** Clear the in-memory sent-emails store (backend test mode only). */
      clearSentEmails(): Chainable<void>;
    }
  }
}
