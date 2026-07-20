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
 * Relies on a seeded ShipParticular being present in the database
 * (same assumption as nominations.cy.ts).
 */
export function createNomination(token: string): Cypress.Chainable<{ nominationId: string }> {
  let shipParticularId: string;

  return cy
    .request({
      method: 'GET',
      url: `${API_URL}/master-data/ship-particulars`,
      headers: authHeaders(token),
    })
    .then((res) => {
      const body = res.body as { items: { id: string }[] };
      const first = body.items[0];
      if (!first) throw new Error('No ship particulars in seed data');
      shipParticularId = first.id;

      return cy.request({
        method: 'POST',
        url: `${API_URL}/nominations`,
        headers: authHeaders(token),
        body: {
          shipParticularId,
          voyageNumber: `E2E-PEDR-${Date.now()}`,
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
