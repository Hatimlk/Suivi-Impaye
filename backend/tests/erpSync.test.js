import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const db = vi.hoisted(() => ({
  query: vi.fn(async () => ({ rows: [] })),
  client: {
    query: vi.fn(async (sql) => {
      if (sql.includes('INSERT INTO erp_sync_runs')) return { rows: [{ id: 'run-1' }] };
      return { rows: [] };
    }),
    release: vi.fn(),
  },
}));
vi.mock('../src/config/db.js', () => ({ query: db.query, getClient: vi.fn(async () => db.client) }));

const erpSyncRouter = (await import('../src/routes/erpSync.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/erp-sync', erpSyncRouter);
  return app;
}

beforeEach(() => {
  process.env.ERP_SYNC_SECRET = 'correct-shared-secret';
  db.query.mockClear();
  db.client.query.mockClear();
});

describe('POST /api/erp-sync', () => {
  it('rejects a request with no secret', async () => {
    const res = await request(buildApp()).post('/api/erp-sync').send({ impayes: [] });
    expect(res.status).toBe(401);
  });

  it('rejects a request with the wrong secret', async () => {
    const res = await request(buildApp())
      .post('/api/erp-sync')
      .set('Authorization', 'Bearer wrong-secret')
      .send({ impayes: [] });
    expect(res.status).toBe(401);
  });

  it('rejects when no ERP_SYNC_SECRET is configured server-side (fails closed)', async () => {
    delete process.env.ERP_SYNC_SECRET;
    const res = await request(buildApp())
      .post('/api/erp-sync')
      .set('Authorization', 'Bearer anything')
      .send({ impayes: [] });
    expect(res.status).toBe(401);
  });

  it('accepts a request with the correct shared secret', async () => {
    const res = await request(buildApp())
      .post('/api/erp-sync')
      .set('Authorization', 'Bearer correct-shared-secret')
      .send({ impayes: [] });
    expect(res.status).toBe(200);
  });

  it('rejects an oversized payload', async () => {
    const impayes = Array.from({ length: 10001 }, (_, i) => ({ erp_voucher_id: i }));
    const res = await request(buildApp())
      .post('/api/erp-sync')
      .set('Authorization', 'Bearer correct-shared-secret')
      .send({ impayes });
    expect(res.status).toBe(413);
  });
});
