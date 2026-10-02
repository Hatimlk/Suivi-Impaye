import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { USERS, authHeader } from './helpers.js';

const db = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock('../src/config/db.js', () => ({ query: db.query, getClient: vi.fn() }));

const exportRouter = (await import('../src/routes/export.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/export', exportRouter);
  return app;
}

beforeEach(() => {
  db.query.mockReset();
  db.query.mockImplementation(async () => ({ rows: [] }));
});

describe('GET /api/export/excel', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).get('/api/export/excel');
    expect(res.status).toBe(401);
  });

  it("scopes the export to the caller's own dossiers for a commercial", async () => {
    const res = await request(buildApp()).get('/api/export/excel').set('Authorization', authHeader(USERS.commercialA));
    expect(res.status).toBe(200);
    const call = db.query.mock.calls.find(([sql]) => sql.includes('FROM dossiers d'));
    expect(call[0]).toContain('d.commercial_id');
    expect(call[1]).toContain(USERS.commercialA.id);
  });

  it('does not scope the export for an admin', async () => {
    const res = await request(buildApp()).get('/api/export/excel').set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(200);
    const call = db.query.mock.calls.find(([sql]) => sql.includes('FROM dossiers d'));
    expect(call[0]).not.toContain('WHERE d.commercial_id');
  });
});
