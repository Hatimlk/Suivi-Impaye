import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeQueryImpl, USERS, authHeader } from './helpers.js';

const db = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock('../src/config/db.js', () => ({ query: db.query, getClient: vi.fn() }));
vi.mock('../src/config/erpDb.js', () => ({
  checkErpConnection: vi.fn(),
  getErpConfigurationStatus: vi.fn(() => ({ configured: false, missing: [] })),
}));

const adminRouter = (await import('../src/routes/admin.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  return app;
}

beforeEach(() => {
  db.query.mockReset();
  db.query.mockImplementation(fakeQueryImpl([]));
});

describe('GET /api/admin/users', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('never leaks password hashes to any role', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        {
          match: (sql) => sql.includes('FROM users ORDER BY'),
          respond: () => [{ id: USERS.commercialA.id, nom: 'A', email: 'a@test.com', role: 'commercial', actif: true }],
        },
      ])
    );
    const res = await request(buildApp()).get('/api/admin/users').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('mot_de_passe');
  });
});

describe('POST /api/admin/users (create)', () => {
  const payload = { nom: 'New', email: 'new@test.com', mot_de_passe: 'StrongPass123', role: 'commercial' };

  it('blocks non-admins from creating users', async () => {
    const res = await request(buildApp()).post('/api/admin/users').set('Authorization', authHeader(USERS.responsable)).send(payload);
    expect(res.status).toBe(403);
  });

  it('allows admin to create a user', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes('SELECT id FROM users WHERE email'), respond: () => [] },
        { match: (sql) => sql.includes('INSERT INTO users'), respond: () => [{ id: 'new-id', ...payload }] },
      ])
    );
    const res = await request(buildApp()).post('/api/admin/users').set('Authorization', authHeader(USERS.admin)).send(payload);
    expect(res.status).toBe(201);
  });
});

describe('PUT /api/admin/users/:id (update)', () => {
  it('blocks non-admins from updating users', async () => {
    const res = await request(buildApp())
      .put(`/api/admin/users/${USERS.commercialB.id}`)
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ nom: 'Hacked' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/admin/users/:id/toggle', () => {
  it('blocks non-admins from toggling user activation', async () => {
    const res = await request(buildApp())
      .patch(`/api/admin/users/${USERS.commercialB.id}/toggle`)
      .set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/users/:id/reset-password', () => {
  it('blocks non-admins from resetting another user\'s password', async () => {
    const res = await request(buildApp())
      .post(`/api/admin/users/${USERS.commercialB.id}/reset-password`)
      .set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(403);
  });

  it("generates a new password and invalidates the target user's sessions", async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes('SELECT id, email FROM users WHERE id'), respond: () => [{ id: USERS.commercialB.id, email: USERS.commercialB.email }] },
        { match: (sql) => sql.includes('UPDATE users SET mot_de_passe_hash'), respond: () => [] },
        { match: (sql) => sql.includes('DELETE FROM refresh_tokens'), respond: () => [] },
      ])
    );
    const res = await request(buildApp())
      .post(`/api/admin/users/${USERS.commercialB.id}/reset-password`)
      .set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(200);
    expect(res.body.password).toBeTruthy();
    expect(res.body.password.length).toBeGreaterThanOrEqual(14);
    const revoke = db.query.mock.calls.find(([sql]) => sql.includes('DELETE FROM refresh_tokens'));
    expect(revoke[1]).toContain(USERS.commercialB.id);
  });

  it('404s for a non-existent user instead of generating a password', async () => {
    db.query.mockImplementation(fakeQueryImpl([{ match: (sql) => sql.includes('SELECT id, email FROM users WHERE id'), respond: () => [] }]));
    const res = await request(buildApp())
      .post('/api/admin/users/00000000-0000-0000-0000-000000000000/reset-password')
      .set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/audit-logs', () => {
  it('blocks non-admins from reading the audit log', async () => {
    const res = await request(buildApp()).get('/api/admin/audit-logs').set('Authorization', authHeader(USERS.responsable));
    expect(res.status).toBe(403);
  });

  it('allows admin to read the audit log', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes('SELECT COUNT(*) FROM audit_logs'), respond: () => [{ count: '0' }] },
        { match: (sql) => sql.includes('FROM audit_logs al'), respond: () => [] },
      ])
    );
    const res = await request(buildApp()).get('/api/admin/audit-logs').set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(200);
  });
});

describe('mutating reference-data routes require admin', () => {
  it('blocks a commercial from creating a banque', async () => {
    const res = await request(buildApp()).post('/api/admin/banques').set('Authorization', authHeader(USERS.commercialA)).send({ nom: 'BQ' });
    expect(res.status).toBe(403);
  });

  it('blocks a commercial from deleting a banque', async () => {
    const res = await request(buildApp()).delete('/api/admin/banques/1').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(403);
  });

  it('blocks a commercial from creating a statut', async () => {
    const res = await request(buildApp()).post('/api/admin/statuts').set('Authorization', authHeader(USERS.commercialA)).send({ libelle: 'X' });
    expect(res.status).toBe(403);
  });

  it('blocks a commercial from creating a relation', async () => {
    const res = await request(buildApp()).post('/api/admin/relations').set('Authorization', authHeader(USERS.commercialA)).send({ code: 'X', libelle: 'X' });
    expect(res.status).toBe(403);
  });

  it('blocks a commercial from creating a partenaire', async () => {
    const res = await request(buildApp()).post('/api/admin/partenaires').set('Authorization', authHeader(USERS.commercialA)).send({ nom: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/erp/status', () => {
  it('blocks non-admins', async () => {
    const res = await request(buildApp()).get('/api/admin/erp/status').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(403);
  });
});

describe('rate limiting on sensitive admin routes', () => {
  it('returns a clear 429 and logs abuse once user-creation attempts exceed the per-IP limit', async () => {
    const app = buildApp();
    let last;
    for (let i = 0; i < 12; i++) {
      last = await request(app).post('/api/admin/users').set('Authorization', authHeader(USERS.admin)).send({});
    }
    expect(last.status).toBe(429);
    expect(last.headers['retry-after']).toBeTruthy();
    expect(last.body.retryAfterSeconds).toBeGreaterThan(0);
    const log = db.query.mock.calls.find(([sql, params]) => sql.includes('INSERT INTO audit_logs') && params[2] === 'rate_limited');
    expect(log).toBeTruthy();
  });

  it('returns a clear 429 and logs abuse once reset-password attempts exceed the per-IP limit', async () => {
    const app = buildApp();
    let last;
    for (let i = 0; i < 12; i++) {
      last = await request(app)
        .post(`/api/admin/users/${USERS.commercialB.id}/reset-password`)
        .set('Authorization', authHeader(USERS.admin));
    }
    expect(last.status).toBe(429);
    expect(last.headers['retry-after']).toBeTruthy();
    const log = db.query.mock.calls.find(([sql, params]) => sql.includes('INSERT INTO audit_logs') && params[2] === 'rate_limited');
    expect(log).toBeTruthy();
  });
});

describe('body validation on reference-data updates', () => {
  it('rejects an invalid hex colour on PUT /statuts/:id', async () => {
    const res = await request(buildApp())
      .put('/api/admin/statuts/1')
      .set('Authorization', authHeader(USERS.admin))
      .send({ couleur: 'not-a-colour' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty nom on PUT /partenaires/:id', async () => {
    const res = await request(buildApp())
      .put('/api/admin/partenaires/1')
      .set('Authorization', authHeader(USERS.admin))
      .send({ nom: '' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-UUID utilisateur_id filter on GET /audit-logs', async () => {
    const res = await request(buildApp())
      .get('/api/admin/audit-logs?utilisateur_id=not-a-uuid')
      .set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(400);
  });
});
