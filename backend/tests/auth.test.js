import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeQueryImpl, USERS, authHeader, signAccessToken } from './helpers.js';

const db = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock('../src/config/db.js', () => ({ query: db.query, getClient: vi.fn() }));

const authRouter = (await import('../src/routes/auth.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

const PASSWORD = 'Secret123!';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

function userRow(user, overrides = {}) {
  return {
    id: user.id,
    email: user.email,
    nom: user.nom,
    role: user.role,
    actif: true,
    mot_de_passe_hash: passwordHash,
    date_creation: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  db.query.mockReset();
  db.query.mockImplementation(async () => ({ rows: [] }));
});

describe('POST /api/auth/login', () => {
  it('rejects a wrong password without revealing which field was wrong', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([{ match: (sql) => sql.includes('FROM users WHERE email'), respond: () => [userRow(USERS.commercialA)] }])
    );
    const res = await request(buildApp())
      .post('/api/auth/login')
      .send({ email: USERS.commercialA.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email', async () => {
    const res = await request(buildApp())
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('logs in with correct credentials and never leaks the password hash', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes('FROM users WHERE email'), respond: () => [userRow(USERS.commercialA)] },
        { match: (sql) => sql.includes('INSERT INTO refresh_tokens'), respond: () => [] },
      ])
    );
    const res = await request(buildApp())
      .post('/api/auth/login')
      .send({ email: USERS.commercialA.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.id).toBe(USERS.commercialA.id);
    expect(JSON.stringify(res.body)).not.toContain(passwordHash);
  });
});

describe('GET /api/auth/me', () => {
  it('rejects requests with no token', async () => {
    const res = await request(buildApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ id: USERS.commercialA.id, role: 'admin' }, 'not-the-real-secret');
    const res = await request(buildApp()).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it("always looks up the caller's own id, never a client-supplied one", async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        {
          match: (sql) => sql.includes('FROM users WHERE id'),
          respond: (params) => (params[0] === USERS.commercialA.id ? [userRow(USERS.commercialA)] : []),
        },
      ])
    );
    const res = await request(buildApp()).get('/api/auth/me').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(USERS.commercialA.id);
    expect(db.query.mock.calls[0][1][0]).toBe(USERS.commercialA.id);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rejects a reused (already rotated) refresh token', async () => {
    db.query.mockImplementation(fakeQueryImpl([{ match: (sql) => sql.includes('FROM refresh_tokens'), respond: () => [] }]));
    const res = await request(buildApp()).post('/api/auth/refresh').send({ refreshToken: 'old-or-unknown-token' });
    expect(res.status).toBe(401);
  });

  it('rotates a valid refresh token and returns a new pair', async () => {
    const refreshToken = jwt.sign({ id: USERS.commercialA.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    db.query.mockImplementation(
      fakeQueryImpl([
        { match: (sql) => sql.includes('FROM refresh_tokens'), respond: () => [{ id: 'row-1', user_id: USERS.commercialA.id }] },
        { match: (sql) => sql.includes('FROM users WHERE id'), respond: () => [userRow(USERS.commercialA)] },
        { match: (sql) => sql.includes('DELETE FROM refresh_tokens'), respond: () => [] },
        { match: (sql) => sql.includes('INSERT INTO refresh_tokens'), respond: () => [] },
      ])
    );
    const res = await request(buildApp()).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    // The used token must be invalidated (rotation) so it can't be replayed.
    expect(db.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM refresh_tokens'))).toBe(true);
  });
});

describe('POST /api/auth/logout', () => {
  it('only deletes a refresh token scoped to the caller, never another user', async () => {
    db.query.mockImplementation(fakeQueryImpl([{ match: (sql) => sql.includes('DELETE FROM refresh_tokens'), respond: () => [] }]));
    const res = await request(buildApp())
      .post('/api/auth/logout')
      .set('Authorization', authHeader(USERS.commercialA))
      .send({ refreshToken: 'some-token' });
    expect(res.status).toBe(200);
    const call = db.query.mock.calls.find(([sql]) => sql.includes('DELETE FROM refresh_tokens'));
    expect(call[0]).toContain('user_id');
    expect(call[1]).toContain(USERS.commercialA.id);
  });
});
