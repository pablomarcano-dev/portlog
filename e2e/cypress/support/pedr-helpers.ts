/// <reference types="cypress" />

export {};

const API_URL = Cypress.env('API_URL') as string;

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Create a nomination. Its PEDR is auto-created server-side on creation, so no
 * confirm/start step is needed. Returns the nominationId.
 *
 * Creates its vessel and branch fixtures in the isolated test database.
 */
export function createNomination(token: string): Cypress.Chainable<{ nominationId: string }> {
  return cy
    .task<{ shipParticularId: string; branchId: string }>('seedNominationFixture')
    .then(({ shipParticularId, branchId }) => {
      return cy.request({
        method: 'POST',
        url: `${API_URL}/nominations`,
        headers: authHeaders(token),
        body: {
          shipParticularId,
          branchId,
          voyageNumber: `PEDR-${Date.now()}`,
          dateNominated: new Date().toISOString(),
          nominationType: 'FULL_AGENCY',
        },
      });
    })
    .then((res) => {
      expect(res.status).to.eq(201);
      const body = res.body as { id: string; status: string };
      expect(body.status).to.eq('NOMINATED');
      return cy.wrap({ nominationId: body.id });
    });
}

/**
 * Send a PEDR sub-document via the dispatch API.
 * POST /api/dispatch/pedr/:pedrId/sub-document
 */
export function sendSubDoc(
  token: string,
  pedrId: string,
  subDocType: string,
  extraData?: object,
): Cypress.Chainable<Cypress.Response<unknown>> {
  return cy.request({
    method: 'POST',
    url: `${API_URL}/dispatch/pedr/${pedrId}/sub-document`,
    headers: authHeaders(token),
    body: {
      subDocType,
      toAddresses: ['test@example.com'],
      subject: `[E2E] ${subDocType} — PEDR ${pedrId}`,
      ...(extraData ? { extraData } : {}),
    },
  });
}
