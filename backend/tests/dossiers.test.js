import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeQueryImpl, USERS, authHeader } from './helpers.js';

const db = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock('../src/config/db.js', () => ({ query: db.query, getClient: vi.fn() }));
vi.mock('../src/services/mailer.js', () => ({ sendCommercialActionNotification: vi.fn() }));

const dossiersRouter = (await import('../src/routes/dossiers.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/dossiers', dossiersRouter);
  return app;
}

function dossierRow(overrides = {}) {
  return {
    id: 'd0000000-0000-0000-0000-000000000001',
    numero_valeur: 'V-1',
    nom_tire: 'Client X',
    montant: 1000,
    banque: 'BQ1',
    statut: 'Attente retour du client',
    commercial_id: USERS.commercialA.id,
    ...overrides,
  };
}

beforeEach(() => {
  db.query.mockReset();
  db.query.mockImplementation(async () => ({ rows: [] }));
});

describe('GET /api/dossiers (list)', () => {
  it("scopes the query to the caller's own dossiers for a commercial", async () => {
    db.query.mockImplementation(fakeQueryImpl([{ match: (sql) => sql.includes('SELECT COUNT(*)'), respond: () => [{ count: '0' }] }]));
    await request(buildApp()).get('/api/dossiers').set('Authorization', authHeader(USERS.commercialA));
    const countCall = db.query.mock.calls.find(([sql]) => sql.includes('SELECT COUNT(*)'));
    expect(countCall[0]).toContain('d.commercial_id');
    expect(countCall[1]).toContain(USERS.commercialA.id);
  });

  it('does not scope the query for an admin', async () => {
    db.query.mockImplementation(fakeQueryImpl([{ match: (sql) => sql.includes('SELECT COUNT(*)'), respond: () => [{ count: '0' }] }]));
    await request(buildApp()).get('/api/dossiers').set('Authorization', authHeader(USERS.admin));
    const countCall = db.query.mock.calls.find(([sql]) => sql.includes('SELECT COUNT(*)'));
    expect(countCall[0]).not.toContain('d.commercial_id');
  });
});

describe('GET /api/dossiers/:id', () => {
  it("blocks a commercial from reading another commercial's dossier", async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM dossiers d'), respond: () => [dossierRow({ commercial_id: USERS.commercialB.id })] }])
    );
    const res = await request(buildApp()).get('/api/dossiers/d1').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(403);
  });

  it('lets the owning commercial read their own dossier', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM dossiers d'), respond: () => [dossierRow({ commercial_id: USERS.commercialA.id })] }])
    );
    const res = await request(buildApp()).get('/api/dossiers/d1').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(200);
  });

  it('lets an admin read any dossier', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM dossiers d'), respond: () => [dossierRow({ commercial_id: USERS.commercialB.id })] }])
    );
    const res = await request(buildApp()).get('/api/dossiers/d1').set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/dossiers (create)', () => {
  const payload = {
    banque: 'BQ1',
    montant: 100,
    type_valeur: 'CHQ',
    numero_valeur: 'V-9',
    nom_tire: 'Client Y',
    relation: 'CD',
  };

  it('blocks lecture_seule from creating a dossier', async () => {
    const res = await request(buildApp())
      .post('/api/dossiers')
      .set('Authorization', authHeader(USERS.lecture))
      .send(payload);
    expect(res.status).toBe(403);
  });

  it('forces commercial_id to self for a commercial, ignoring any client-supplied owner', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes('SELECT id FROM users WHERE id'), respond: () => [{ id: USERS.commercialB.id }] },
        { match: (sql) => sql.includes('INSERT INTO dossiers'), respond: () => [dossierRow({ commercial_id: USERS.commercialA.id })] },
      ])
    );
    const res = await request(buildApp())
      .post('/api/dossiers')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ ...payload, commercial_id: USERS.commercialB.id });
    expect(res.status).toBe(201);
    const insertCall = db.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO dossiers'));
    expect(insertCall[1]).toContain(USERS.commercialA.id);
    expect(insertCall[1]).not.toContain(USERS.commercialB.id);
  });
});

describe('PUT /api/dossiers/:id (update)', () => {
  it("blocks a commercial from editing another commercial's dossier", async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow({ commercial_id: USERS.commercialB.id })] }])
    );
    const res = await request(buildApp())
      .put('/api/dossiers/d1')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ observations: 'x' });
    expect(res.status).toBe(403);
  });

  it('blocks lecture_seule from editing', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow()] }])
    );
    const res = await request(buildApp())
      .put('/api/dossiers/d1')
      .set('Authorization', authHeader(USERS.lecture))
      .send({ observations: 'x' });
    expect(res.status).toBe(403);
  });

  it('strips commercial_id from a commercial\'s own update (no self-service reassignment)', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow({ commercial_id: USERS.commercialA.id })] },
        { match: (sql) => sql.includes('UPDATE dossiers SET'), respond: () => [dossierRow({ commercial_id: USERS.commercialA.id })] },
      ])
    );
    const res = await request(buildApp())
      .put('/api/dossiers/d1')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ observations: 'updated', commercial_id: USERS.commercialB.id });
    expect(res.status).toBe(200);
    const updateCall = db.query.mock.calls.find(([sql]) => sql.includes('UPDATE dossiers SET'));
    expect(updateCall[0]).not.toContain('commercial_id');
    expect(updateCall[1]).not.toContain(USERS.commercialB.id);
  });

  it('allows an admin to reassign commercial_id via update', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow({ commercial_id: USERS.commercialA.id })] },
        { match: (sql) => sql.includes('UPDATE dossiers SET'), respond: () => [dossierRow({ commercial_id: USERS.commercialB.id })] },
      ])
    );
    const res = await request(buildApp())
      .put('/api/dossiers/d1')
      .set('Authorization', authHeader(USERS.admin))
      .send({ commercial_id: USERS.commercialB.id });
    expect(res.status).toBe(200);
    const updateCall = db.query.mock.calls.find(([sql]) => sql.includes('UPDATE dossiers SET'));
    expect(updateCall[0]).toContain('commercial_id');
  });
});

describe('PATCH /api/dossiers/:id/statut', () => {
  it("blocks a commercial from changing another's dossier status", async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow({ commercial_id: USERS.commercialB.id })] }])
    );
    const res = await request(buildApp())
      .patch('/api/dossiers/d1/statut')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ statut: 'Régularisé - OK' });
    expect(res.status).toBe(403);
  });

  it('blocks lecture_seule from changing status', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow()] }])
    );
    const res = await request(buildApp())
      .patch('/api/dossiers/d1/statut')
      .set('Authorization', authHeader(USERS.lecture))
      .send({ statut: 'Régularisé - OK' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/dossiers/:id/reaffecter', () => {
  it('blocks a commercial from reassigning dossiers', async () => {
    const res = await request(buildApp())
      .patch('/api/dossiers/d1/reaffecter')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ commercial_id: USERS.commercialB.id });
    expect(res.status).toBe(403);
  });

  it('allows responsable_recouvrement to reassign', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow()] },
        { match: (sql) => sql.includes("role = 'commercial'"), respond: () => [{ id: USERS.commercialB.id, nom: 'CommB' }] },
        { match: (sql) => sql.includes('UPDATE dossiers SET commercial_id'), respond: () => [dossierRow({ commercial_id: USERS.commercialB.id })] },
      ])
    );
    const res = await request(buildApp())
      .patch('/api/dossiers/d1/reaffecter')
      .set('Authorization', authHeader(USERS.responsable))
      .send({ commercial_id: USERS.commercialB.id });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/dossiers/:id/actions', () => {
  it("blocks a commercial from commenting on another's dossier", async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow({ commercial_id: USERS.commercialB.id })] }])
    );
    const res = await request(buildApp())
      .post('/api/dossiers/d1/actions')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ contenu: 'hello' });
    expect(res.status).toBe(403);
  });

  it('blocks lecture_seule from adding actions', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow()] }])
    );
    const res = await request(buildApp())
      .post('/api/dossiers/d1/actions')
      .set('Authorization', authHeader(USERS.lecture))
      .send({ contenu: 'hello' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/dossiers/:id', () => {
  it('blocks a commercial from deleting even their own dossier', async () => {
    const res = await request(buildApp()).delete('/api/dossiers/d1').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(403);
  });

  it('allows admin to delete', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow()] }])
    );
    const res = await request(buildApp()).delete('/api/dossiers/d1').set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/dossiers/import', () => {
  it('blocks a commercial from importing', async () => {
    const res = await request(buildApp())
      .post('/api/dossiers/import')
      .set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(403);
  });
});
