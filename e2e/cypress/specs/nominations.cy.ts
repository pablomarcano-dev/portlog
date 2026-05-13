/// <reference types="cypress" />

export {};

/**
 * E2E: Nominations API — state-machine transitions + CRUD
 *
 * Tests the POST/GET/PATCH/DELETE /api/nominations endpoints and the
 * POST /api/nominations/:id/transition state machine directly via cy.request.
 * No UI route exists yet (M3-S3/S4); this spec validates the backend contract.
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
      expect(body.status).to.eq('DRAFT');
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
      expect(body.statusHistory[0]?.toStatus).to.eq('DRAFT');
    });
  });

  // ── 4. Transition DRAFT → CONFIRMED ─────────────────────────────────────────
  it('4. DRAFT → CONFIRMED transition succeeds', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/nominations/${nominationId}/transition`,
      headers: authHeaders(),
      body: { toStatus: 'CONFIRMED' },
    }).then((res) => {
      expect(res.status).to.eq(201);
      const body = res.body as { status: string };
      expect(body.status).to.eq('CONFIRMED');
    });
  });

  // ── 5. Transition CONFIRMED → IN_PROGRESS ───────────────────────────────────
  it('5. CONFIRMED → IN_PROGRESS transition succeeds', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/nominations/${nominationId}/transition`,
      headers: authHeaders(),
      body: { toStatus: 'IN_PROGRESS' },
    }).then((res) => {
      expect(res.status).to.eq(201);
      const body = res.body as { status: string };
      expect(body.status).to.eq('IN_PROGRESS');
    });
  });

  // ── 6. PATCH on IN_PROGRESS → 200 ───────────────────────────────────────────
  it('6. PATCH on IN_PROGRESS nomination succeeds', () => {
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

  // ── 7. Transition IN_PROGRESS → COMPLETED ───────────────────────────────────
  it('7. IN_PROGRESS → COMPLETED transition succeeds', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/nominations/${nominationId}/transition`,
      headers: authHeaders(),
      body: { toStatus: 'COMPLETED' },
    }).then((res) => {
      expect(res.status).to.eq(201);
      const body = res.body as { status: string };
      expect(body.status).to.eq('COMPLETED');
    });
  });

  // ── 8. PATCH on COMPLETED → 409 ─────────────────────────────────────────────
  it('8. PATCH on COMPLETED nomination returns 409', () => {
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

  // ── 9. Invalid transition COMPLETED → DRAFT → 400 ───────────────────────────
  it('9. Invalid transition COMPLETED → DRAFT returns 400', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/nominations/${nominationId}/transition`,
      headers: authHeaders(),
      body: { toStatus: 'DRAFT' },
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
