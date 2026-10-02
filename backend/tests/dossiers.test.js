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
  // Reproduit le gestionnaire d'erreurs de server.js (multer rejette via cb(err), pas via throw).
  app.use((err, _req, res, _next) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Fichier trop volumineux (max 10 Mo)' });
    if (err?.message?.includes('Fichier Excel')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Erreur serveur interne' });
  });
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
  db.query.mockImplementation(fakeQueryImpl([]));
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
    const res = await request(buildApp()).get('/api/dossiers/d0000000-0000-0000-0000-000000000001').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(403);
  });

  it('lets the owning commercial read their own dossier', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM dossiers d'), respond: () => [dossierRow({ commercial_id: USERS.commercialA.id })] }])
    );
    const res = await request(buildApp()).get('/api/dossiers/d0000000-0000-0000-0000-000000000001').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(200);
  });

  it('lets an admin read any dossier', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM dossiers d'), respond: () => [dossierRow({ commercial_id: USERS.commercialB.id })] }])
    );
    const res = await request(buildApp()).get('/api/dossiers/d0000000-0000-0000-0000-000000000001').set('Authorization', authHeader(USERS.admin));
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
      .put('/api/dossiers/d0000000-0000-0000-0000-000000000001')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ observations: 'x' });
    expect(res.status).toBe(403);
  });

  it('blocks lecture_seule from editing', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow()] }])
    );
    const res = await request(buildApp())
      .put('/api/dossiers/d0000000-0000-0000-0000-000000000001')
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
      .put('/api/dossiers/d0000000-0000-0000-0000-000000000001')
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
      .put('/api/dossiers/d0000000-0000-0000-0000-000000000001')
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
      .patch('/api/dossiers/d0000000-0000-0000-0000-000000000001/statut')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ statut: 'Régularisé - OK' });
    expect(res.status).toBe(403);
  });

  it('blocks lecture_seule from changing status', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow()] }])
    );
    const res = await request(buildApp())
      .patch('/api/dossiers/d0000000-0000-0000-0000-000000000001/statut')
      .set('Authorization', authHeader(USERS.lecture))
      .send({ statut: 'Régularisé - OK' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/dossiers/:id/reaffecter', () => {
  it('blocks a commercial from reassigning dossiers', async () => {
    const res = await request(buildApp())
      .patch('/api/dossiers/d0000000-0000-0000-0000-000000000001/reaffecter')
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
      .patch('/api/dossiers/d0000000-0000-0000-0000-000000000001/reaffecter')
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
      .post('/api/dossiers/d0000000-0000-0000-0000-000000000001/actions')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ contenu: 'hello' });
    expect(res.status).toBe(403);
  });

  it('blocks lecture_seule from adding actions', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow()] }])
    );
    const res = await request(buildApp())
      .post('/api/dossiers/d0000000-0000-0000-0000-000000000001/actions')
      .set('Authorization', authHeader(USERS.lecture))
      .send({ contenu: 'hello' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/dossiers/:id', () => {
  it('blocks a commercial from deleting even their own dossier', async () => {
    const res = await request(buildApp()).delete('/api/dossiers/d0000000-0000-0000-0000-000000000001').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(403);
  });

  it('allows admin to delete', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('SELECT * FROM dossiers'), respond: () => [dossierRow()] }])
    );
    const res = await request(buildApp()).delete('/api/dossiers/d0000000-0000-0000-0000-000000000001').set('Authorization', authHeader(USERS.admin));
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

  it('rejects a file with the wrong extension', async () => {
    const res = await request(buildApp())
      .post('/api/dossiers/import')
      .set('Authorization', authHeader(USERS.admin))
      .attach('file', Buffer.from('not a spreadsheet'), 'malware.exe');
    expect(res.status).toBe(400);
  });

  it('rejects a .xlsx file whose content is not actually a zip (spoofed extension)', async () => {
    const res = await request(buildApp())
      .post('/api/dossiers/import')
      .set('Authorization', authHeader(USERS.admin))
      .attach('file', Buffer.from('plain text pretending to be excel'), 'fake.xlsx');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/xlsx/i);
  });

  it('rejects an empty file', async () => {
    const res = await request(buildApp())
      .post('/api/dossiers/import')
      .set('Authorization', authHeader(USERS.admin))
      .attach('file', Buffer.alloc(0), 'empty.csv');
    expect(res.status).toBe(400);
  });
});

describe('malformed route params', () => {
  it('returns 400 (not 500) for a non-UUID dossier id', async () => {
    const res = await request(buildApp()).get('/api/dossiers/not-a-uuid').set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/dossiers — query validation', () => {
  it('rejects a non-numeric montant_min', async () => {
    const res = await request(buildApp()).get('/api/dossiers?montant_min=abc').set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(400);
  });

  it('rejects a malformed date_debut', async () => {
    const res = await request(buildApp()).get('/api/dossiers?date_debut=2026/01/01').set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(400);
  });

  it('applies montant_min=0 as a real filter instead of silently dropping it', async () => {
    db.query.mockImplementation(fakeQueryImpl([{ match: (sql) => sql.includes('SELECT COUNT(*)'), respond: () => [{ count: '0' }] }]));
    await request(buildApp()).get('/api/dossiers?montant_min=0').set('Authorization', authHeader(USERS.admin));
    const call = db.query.mock.calls.find(([sql]) => sql.includes('SELECT COUNT(*)'));
    expect(call[0]).toContain('d.montant >=');
    expect(call[1]).toContain(0);
  });
});

describe('PATCH /api/dossiers/:id/statut — body validation', () => {
  it('rejects an empty statut', async () => {
    const res = await request(buildApp())
      .patch('/api/dossiers/d0000000-0000-0000-0000-000000000001/statut')
      .set('Authorization', authHeader(USERS.admin))
      .send({ statut: '' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/dossiers/:id/reaffecter — body validation', () => {
  it('rejects a non-UUID commercial_id', async () => {
    const res = await request(buildApp())
      .patch('/api/dossiers/d0000000-0000-0000-0000-000000000001/reaffecter')
      .set('Authorization', authHeader(USERS.admin))
      .send({ commercial_id: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });
});
