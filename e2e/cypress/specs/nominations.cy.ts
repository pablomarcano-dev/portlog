/// <reference types="cypress" />

export {};

/**
 * E2E: Nominations API — derived status + CRUD
 *
 * Status is derived (NOMINATED → IN_PORT → FULL_AWAY) from message sends + laydays;
 * the only manual transition is CANCELLED. This spec validates that contract plus
 * the POST/GET/PATCH/DELETE /api/nominations endpoints directly via cy.request.
 */

const API_URL = Cypress.env('API_URL') as string;

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${Cypress.env('ACCESS_TOKEN') as string}` };
}

describe('Nominations API — E2E', () => {
  let shipParticularId: string;
  let nominationId: string;

  before(() => {
    cy.resetDb();
    cy.loginAsOPS();
    // Grab a seeded ShipParticular id to use as FK in create
    cy.request({
      method: 'GET',
      url: `${API_URL}/master-data/ship-particulars`,
      headers: authHeaders(),
    }).then((res) => {
      const body = res.body as { items: { id: string }[] };
      const first = body.items[0];
      if (!first) throw new Error('No ship particulars in seed data');
      shipParticularId = first.id;
    });
  });

  // ── 1. POST /api/nominations → 201 ──────────────────────────────────────────
  it('1. OPS: creates a nomination and receives 201 with snOt', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/nominations`,
      headers: authHeaders(),
      body: {
        shipParticularId,
        voyageNumber: '01/E2E',
        dateNominated: new Date().toISOString(),
        nominationType: 'FULL_AGENCY',
      },
    }).then((res) => {
      expect(res.status).to.eq(201);
      const body = res.body as { id: string; snOt: string; status: string; correlative: number };
      expect(body.status).to.eq('NOMINATED');
      expect(body.snOt).to.match(/^SN-\d{2}\/\d{4}$/);
      expect(body.correlative).to.be.a('number');
      nominationId = body.id;
    });
  });

  // ── 2. GET /api/nominations → list includes new nomination ──────────────────
  it('2. GET list includes the created nomination', () => {
    cy.request({
      method: 'GET',
      url: `${API_URL}/nominations`,
      headers: authHeaders(),
    }).then((res) => {
      expect(res.status).to.eq(200);
      const body = res.body as { items: { id: string }[]; total: number };
      expect(body.total).to.be.at.least(1);
      const found = body.items.some((n) => n.id === nominationId);
      expect(found).to.be.true;
    });
  });

  // ── 3. GET /api/nominations/:id → full shape with snOt ──────────────────────
  it('3. GET by id returns full nomination shape with snOt and statusHistory', () => {
    cy.request({
      method: 'GET',
      url: `${API_URL}/nominations/${nominationId}`,
      headers: authHeaders(),
    }).then((res) => {
      expect(res.status).to.eq(200);
      const body = res.body as {
        id: string;
        snOt: string;
        statusHistory: { toStatus: string }[];
      };
      expect(body.id).to.eq(nominationId);
      expect(body.snOt).to.match(/^SN-\d{2}\/\d{4}$/);
      expect(body.statusHistory).to.have.length(1);
      expect(body.statusHistory[0]?.toStatus).to.eq('NOMINATED');
    });
  });

  // ── 4. Derived statuses cannot be set manually → 400 ────────────────────────
  it('4. Manual transition to a derived status (IN_PORT) returns 400', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/nominations/${nominationId}/transition`,
      headers: authHeaders(),
      body: { toStatus: 'IN_PORT' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(400);
    });
  });

  // ── 5. PATCH on a non-cancelled nomination → 200 ────────────────────────────
  it('5. PATCH on a NOMINATED nomination succeeds', () => {
    cy.request({
      method: 'PATCH',
      url: `${API_URL}/nominations/${nominationId}`,
      headers: authHeaders(),
      body: { voyageNumber: '01/E2E-UPDATED' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      const body = res.body as { voyageNumber: string };
      expect(body.voyageNumber).to.eq('01/E2E-UPDATED');
    });
  });

  // ── 6. Cancel without a reason → 400 ────────────────────────────────────────
  it('6. Cancel without a reason returns 400', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/nominations/${nominationId}/transition`,
      headers: authHeaders(),
      body: { toStatus: 'CANCELLED' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(400);
    });
  });

  // ── 7. Cancel with a reason → 201, status CANCELLED ─────────────────────────
  it('7. Cancel with a reason succeeds', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/nominations/${nominationId}/transition`,
      headers: authHeaders(),
      body: { toStatus: 'CANCELLED', reason: 'E2E cancellation' },
    }).then((res) => {
      expect(res.status).to.eq(201);
      const body = res.body as { status: string };
      expect(body.status).to.eq('CANCELLED');
    });
  });

  // ── 8. PATCH on CANCELLED → 409 ─────────────────────────────────────────────
  it('8. PATCH on a CANCELLED nomination returns 409', () => {
    cy.request({
      method: 'PATCH',
      url: `${API_URL}/nominations/${nominationId}`,
      headers: authHeaders(),
      body: { voyageNumber: 'BLOCKED' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(409);
    });
  });

  // ── 9. Re-cancelling a CANCELLED nomination → 400 (terminal) ────────────────
  it('9. Cancelling an already-cancelled nomination returns 400', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/nominations/${nominationId}/transition`,
      headers: authHeaders(),
      body: { toStatus: 'CANCELLED', reason: 'again' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(400);
    });
  });

  // ── 10. DELETE → 405 ────────────────────────────────────────────────────────
  it('10. DELETE returns 405 with hint to use CANCELLED transition', () => {
    cy.request({
      method: 'DELETE',
      url: `${API_URL}/nominations/${nominationId}`,
      headers: authHeaders(),
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(405);
    });
  });
});
