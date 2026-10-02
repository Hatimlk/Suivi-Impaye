import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeQueryImpl, USERS, authHeader } from './helpers.js';

const db = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock('../src/config/db.js', () => ({ query: db.query, getClient: vi.fn() }));

const erpRouter = (await import('../src/routes/erp.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/erp', erpRouter);
  return app;
}

function snapshotRow(overrides = {}) {
  return {
    erp_voucher_id: 42,
    date_saisie: '2026-01-01',
    montant: 500,
    type_valeur: 'CHQ',
    numero_valeur: 'V-42',
    nom_tire: 'Client Z',
    banque: 'BQ1',
    suivi_statut: null,
    suivi_observations: null,
    commercial_id: USERS.commercialA.id,
    suivi_commercial_nom: 'CommA',
    erp_commercial_nom: null,
    date_derniere_action: null,
    suivi_date_creation: null,
    synced_at: '2026-01-01T00:00:00Z',
    date_derniere_modification: null,
    ...overrides,
  };
}

beforeEach(() => {
  db.query.mockReset();
  db.query.mockImplementation(async () => ({ rows: [] }));
});

describe('GET /api/erp/impayes (list)', () => {
  it("scopes the list to the caller's own assignments for a commercial", async () => {
    db.query.mockImplementation(fakeQueryImpl([{ match: (sql) => sql.includes('SELECT COUNT(*)'), respond: () => [{ count: '0' }] }]));
    await request(buildApp()).get('/api/erp/impayes').set('Authorization', authHeader(USERS.commercialA));
    const countCall = db.query.mock.calls.find(([sql]) => sql.includes('SELECT COUNT(*)'));
    expect(countCall[0]).toContain('s.commercial_id');
    expect(countCall[1]).toContain(USERS.commercialA.id);
  });

  it('does not scope the list for an admin', async () => {
    db.query.mockImplementation(fakeQueryImpl([{ match: (sql) => sql.includes('SELECT COUNT(*)'), respond: () => [{ count: '0' }] }]));
    await request(buildApp()).get('/api/erp/impayes').set('Authorization', authHeader(USERS.admin));
    const countCall = db.query.mock.calls.find(([sql]) => sql.includes('SELECT COUNT(*)'));
    expect(countCall[0]).not.toContain('s.commercial_id');
  });

  it('does not scope the list for a lecture_seule (global read access)', async () => {
    db.query.mockImplementation(fakeQueryImpl([{ match: (sql) => sql.includes('SELECT COUNT(*)'), respond: () => [{ count: '0' }] }]));
    await request(buildApp()).get('/api/erp/impayes').set('Authorization', authHeader(USERS.lecture));
    const countCall = db.query.mock.calls.find(([sql]) => sql.includes('SELECT COUNT(*)'));
    expect(countCall[0]).not.toContain('s.commercial_id');
  });
});

describe('GET /api/erp/impayes/:id', () => {
  it("blocks a commercial from reading another commercial's ERP dossier", async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM erp_impayes_snapshot'), respond: () => [snapshotRow({ commercial_id: USERS.commercialB.id })] }])
    );
    const res = await request(buildApp()).get('/api/erp/impayes/erp-42').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(403);
  });

  it('blocks a commercial from reading an unassigned ERP dossier', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM erp_impayes_snapshot'), respond: () => [snapshotRow({ commercial_id: null })] }])
    );
    const res = await request(buildApp()).get('/api/erp/impayes/erp-42').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(403);
  });

  it('lets the assigned commercial read their own ERP dossier', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM erp_impayes_snapshot'), respond: () => [snapshotRow({ commercial_id: USERS.commercialA.id })] }])
    );
    const res = await request(buildApp()).get('/api/erp/impayes/erp-42').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(200);
  });

  it('rejects a malformed id', async () => {
    const res = await request(buildApp()).get('/api/erp/impayes/not-an-id').set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/erp/partenaires', () => {
  it('scopes partner names to the commercial assignment', async () => {
    await request(buildApp()).get('/api/erp/partenaires').set('Authorization', authHeader(USERS.commercialA));
    const call = db.query.mock.calls.find(([sql]) => sql.includes('erp_impayes_snapshot'));
    expect(call[0]).toContain('s.commercial_id');
    expect(call[1]).toContain(USERS.commercialA.id);
  });

  it('does not scope partner names for an admin', async () => {
    await request(buildApp()).get('/api/erp/partenaires').set('Authorization', authHeader(USERS.admin));
    const call = db.query.mock.calls.find(([sql]) => sql.includes('erp_impayes_snapshot'));
    expect(call[0]).not.toContain('s.commercial_id');
  });
});

describe('GET /api/erp/stats', () => {
  it("scopes aggregate stats to the caller's own portfolio for a commercial", async () => {
    await request(buildApp()).get('/api/erp/stats').set('Authorization', authHeader(USERS.commercialA));
    const call = db.query.mock.calls.find(([sql]) => sql.includes('COUNT(*)::int AS count, COALESCE(SUM'));
    expect(call[0]).toContain('s.commercial_id');
    expect(call[1]).toContain(USERS.commercialA.id);
  });

  it('does not scope aggregate stats for an admin', async () => {
    await request(buildApp()).get('/api/erp/stats').set('Authorization', authHeader(USERS.admin));
    const call = db.query.mock.calls.find(([sql]) => sql.includes('COUNT(*)::int AS count, COALESCE(SUM'));
    expect(call[0]).not.toContain('s.commercial_id');
  });
});

describe('PATCH /api/erp/impayes/:id/statut', () => {
  it("blocks a commercial from changing another's ERP dossier status", async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM erp_dossier_suivi WHERE erp_voucher_id'), respond: () => [{ commercial_id: USERS.commercialB.id }] }])
    );
    const res = await request(buildApp())
      .patch('/api/erp/impayes/erp-42/statut')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ statut: 'Régularisé - OK' });
    expect(res.status).toBe(403);
  });

  it('blocks a commercial from changing status on an unassigned ERP dossier', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM erp_dossier_suivi WHERE erp_voucher_id'), respond: () => [] }])
    );
    const res = await request(buildApp())
      .patch('/api/erp/impayes/erp-42/statut')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ statut: 'Régularisé - OK' });
    expect(res.status).toBe(403);
  });

  it('allows the assigned commercial to change their own ERP dossier status', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes('FROM erp_dossier_suivi WHERE erp_voucher_id'), respond: () => [{ commercial_id: USERS.commercialA.id }] },
        { match: (sql) => sql.includes('INSERT INTO erp_dossier_suivi (erp_voucher_id, statut)'), respond: () => [{ erp_voucher_id: 42, statut: 'Régularisé - OK' }] },
      ])
    );
    const res = await request(buildApp())
      .patch('/api/erp/impayes/erp-42/statut')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ statut: 'Régularisé - OK' });
    expect(res.status).toBe(200);
  });

  it('blocks lecture_seule from changing status', async () => {
    const res = await request(buildApp())
      .patch('/api/erp/impayes/erp-42/statut')
      .set('Authorization', authHeader(USERS.lecture))
      .send({ statut: 'Régularisé - OK' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/erp/impayes/:id/actions', () => {
  it("blocks a commercial from commenting on another's ERP dossier", async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM erp_dossier_suivi WHERE erp_voucher_id'), respond: () => [{ commercial_id: USERS.commercialB.id }] }])
    );
    const res = await request(buildApp())
      .post('/api/erp/impayes/erp-42/actions')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ contenu: 'hello' });
    expect(res.status).toBe(403);
  });

  it('allows the assigned commercial to comment on their own ERP dossier', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes('FROM erp_dossier_suivi WHERE erp_voucher_id'), respond: () => [{ commercial_id: USERS.commercialA.id }] },
        { match: (sql) => sql.includes('INSERT INTO erp_actions'), respond: () => [{ id: 'a1', erp_voucher_id: 42 }] },
        { match: (sql) => sql.includes('SELECT a.*'), respond: () => [{ id: 'a1', erp_voucher_id: 42, auteur_nom: 'CommA' }] },
      ])
    );
    const res = await request(buildApp())
      .post('/api/erp/impayes/erp-42/actions')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ contenu: 'hello' });
    expect(res.status).toBe(201);
  });

  it('blocks lecture_seule from adding actions', async () => {
    const res = await request(buildApp())
      .post('/api/erp/impayes/erp-42/actions')
      .set('Authorization', authHeader(USERS.lecture))
      .send({ contenu: 'hello' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/erp/impayes/:id/reaffecter', () => {
  it('blocks a commercial from reassigning ERP dossiers', async () => {
    const res = await request(buildApp())
      .patch('/api/erp/impayes/erp-42/reaffecter')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ commercial_id: USERS.commercialB.id });
    expect(res.status).toBe(403);
  });

  it('allows admin to reassign', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes("role = 'commercial'"), respond: () => [{ id: USERS.commercialB.id }] },
        { match: (sql) => sql.includes('INSERT INTO erp_dossier_suivi (erp_voucher_id, commercial_id)'), respond: () => [{ erp_voucher_id: 42, commercial_id: USERS.commercialB.id }] },
      ])
    );
    const res = await request(buildApp())
      .patch('/api/erp/impayes/erp-42/reaffecter')
      .set('Authorization', authHeader(USERS.admin))
      .send({ commercial_id: USERS.commercialB.id });
    expect(res.status).toBe(200);
  });
});
