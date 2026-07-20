/// <reference types="cypress" />

import { createNomination, sendSubDoc } from '../support/pedr-helpers';

export {};

/**
 * E2E: Full PEDR lifecycle via API
 *
 * Exercises the PEDR state machine end-to-end:
 *   Nomination (PEDR auto-created) → dispatch sub-documents
 *   → stage transitions (PREARRIBO → ATENCION → DESPACHO → CIERRE)
 *   → assert immutability of closed PEDR.
 *
 * Uses cy.request throughout (no UI) for speed and stability.
 * MinIO storage key assertions are skipped — MinIO may not be available in CI.
 * PEDR event POST and DELETE endpoints do not exist yet — noted as follow-ups.
 */

const API_URL = Cypress.env('API_URL') as string;

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${Cypress.env('ACCESS_TOKEN') as string}` };
}

describe('PEDR lifecycle — E2E', () => {
  let token: string;
  let nominationId: string;
  let pedrId: string;

  before(() => {
    cy.resetDb();
    cy.loginAsADM();
    cy.then(() => {
      token = Cypress.env('ACCESS_TOKEN') as string;
    });
  });

  // ── 1. Create nomination (PEDR auto-created) ────────────────────────────────
  it('1. Create a nomination', () => {
    createNomination(token).then((result) => {
      nominationId = result.nominationId;
      expect(nominationId).to.be.a('string').and.have.length.greaterThan(0);
    });
  });

  // ── 2. PEDR is auto-created at stage = PREARRIBO ────────────────────────────
  it('2. Auto-created PEDR is available at stage = PREARRIBO', () => {
    cy.request({
      method: 'GET',
      url: `${API_URL}/pedr/by-nomination/${nominationId}`,
      headers: authHeaders(),
    }).then((res) => {
      expect(res.status).to.eq(200);
      const body = res.body as { id: string; currentStage: string };
      expect(body.currentStage).to.eq('PREARRIBO');
      expect(body.id).to.be.a('string');
      pedrId = body.id;
    });
  });

  // ── 3. Send Acknowledgement sub-document ────────────────────────────────────
  it('3. Send ACKNOWLEDGEMENT sub-document → 201', () => {
    sendSubDoc(token, pedrId, 'ACKNOWLEDGEMENT').then((res) => {
      expect(res.status).to.eq(201);
    });
  });

  // ── 4. Send Prearrival sub-document ─────────────────────────────────────────
  it('4. Send PREARRIVAL sub-document → 201', () => {
    sendSubDoc(token, pedrId, 'PREARRIVAL').then((res) => {
      expect(res.status).to.eq(201);
    });
  });

  // ── 5. Send ETA_ETB sub-document ────────────────────────────────────────────
  it('5. Send ETA_ETB sub-document → 201', () => {
    sendSubDoc(token, pedrId, 'ETA_ETB', {
      etb: new Date().toISOString(),
      berthNumber: 'B1',
    }).then((res) => {
      expect(res.status).to.eq(201);
    });
  });

  // ── 6. Advance PREARRIBO → ATENCION ─────────────────────────────────────────
  it('6. Transition PREARRIBO → ATENCION → 201', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/pedr/${pedrId}/transition`,
      headers: authHeaders(),
      body: { toStage: 'ATENCION' },
    }).then((res) => {
      expect(res.status).to.eq(201);
      const body = res.body as { currentStage: string };
      expect(body.currentStage).to.eq('ATENCION');
    });
  });

  // ── 7. Send NOR sub-document ─────────────────────────────────────────────────
  it('7. Send NOR sub-document → 201', () => {
    sendSubDoc(token, pedrId, 'NOR', {
      norTenderedAt: new Date().toISOString(),
    }).then((res) => {
      expect(res.status).to.eq(201);
    });
  });

  // ── 8. GET events (GET only — POST not yet implemented) ──────────────────────
  // NOTE: POST /api/pedr/:id/events does not exist yet (follow-up story needed).
  // The GET endpoint from POR-69 is tested here only.
  it('8. GET PEDR events → 200 (events list may be empty)', () => {
    cy.request({
      method: 'GET',
      url: `${API_URL}/pedr/${pedrId}/events`,
      headers: authHeaders(),
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.be.an('array');
    });
  });

  // ── 9. Send SOF sub-document ─────────────────────────────────────────────────
  it('9. Send SOF sub-document → 201', () => {
    sendSubDoc(token, pedrId, 'SOF').then((res) => {
      expect(res.status).to.eq(201);
    });
  });

  // ── 10. Send CARGO_UPDATE sub-document ───────────────────────────────────────
  it('10. Send CARGO_UPDATE sub-document → 201', () => {
    sendSubDoc(token, pedrId, 'CARGO_UPDATE', {
      blQuantity: 1000,
      blDate: '2026-05-22',
    }).then((res) => {
      expect(res.status).to.eq(201);
    });
  });

  // ── 11. Advance ATENCION → DESPACHO ──────────────────────────────────────────
  it('11. Transition ATENCION → DESPACHO → 201', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/pedr/${pedrId}/transition`,
      headers: authHeaders(),
      body: { toStage: 'DESPACHO' },
    }).then((res) => {
      expect(res.status).to.eq(201);
      const body = res.body as { currentStage: string };
      expect(body.currentStage).to.eq('DESPACHO');
    });
  });

  // ── 12. Advance DESPACHO → CIERRE ────────────────────────────────────────────
  it('12. Transition DESPACHO → CIERRE → 201', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/pedr/${pedrId}/transition`,
      headers: authHeaders(),
      body: { toStage: 'CIERRE' },
    }).then((res) => {
      expect(res.status).to.eq(201);
      const body = res.body as { currentStage: string };
      expect(body.currentStage).to.eq('CIERRE');
    });
  });

  // ── 13. Invalid forward transition from CIERRE is rejected ───────────────────
  // NOTE: No DELETE endpoint exists for PEDR — 405 cannot be tested.
  // Instead, assert that an invalid transition from CIERRE is rejected (400).
  it('13. Invalid transition from CIERRE → CIERRE returns 400', () => {
    cy.request({
      method: 'POST',
      url: `${API_URL}/pedr/${pedrId}/transition`,
      headers: authHeaders(),
      body: { toStage: 'CIERRE' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(400);
    });
  });

  // ── 14. GET by id → stage = CIERRE ───────────────────────────────────────────
  it('14. GET PEDR by id → stage = CIERRE', () => {
    cy.request({
      method: 'GET',
      url: `${API_URL}/pedr/${pedrId}`,
      headers: authHeaders(),
    }).then((res) => {
      expect(res.status).to.eq(200);
      const body = res.body as {
        id: string;
        currentStage: string;
        stageHistory: { toStage: string }[];
      };
      expect(body.id).to.eq(pedrId);
      expect(body.currentStage).to.eq('CIERRE');
      // Stage history should record all 4 stages
      const stages = body.stageHistory.map((h) => h.toStage);
      expect(stages).to.include.members(['PREARRIBO', 'ATENCION', 'DESPACHO', 'CIERRE']);
    });
  });

  // ── 15. Dispatch log contains all sent sub-documents ─────────────────────────
  it('15. GET dispatch log → contains all sent sub-documents', () => {
    cy.request({
      method: 'GET',
      url: `${API_URL}/dispatch/pedr/${pedrId}/dispatches`,
      headers: authHeaders(),
    }).then((res) => {
      expect(res.status).to.eq(200);
      const body = res.body as { items: { subDocType: string }[] };
      const types = body.items.map((d) => d.subDocType);
      expect(types).to.include('ACKNOWLEDGEMENT');
      expect(types).to.include('PREARRIVAL');
      expect(types).to.include('ETA_ETB');
      expect(types).to.include('NOR');
      expect(types).to.include('SOF');
      expect(types).to.include('CARGO_UPDATE');
    });
  });
});
