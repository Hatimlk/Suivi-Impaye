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

  it('logs every invalid-secret attempt so repeated abuse is visible to an admin', async () => {
    await request(buildApp()).post('/api/erp-sync').set('Authorization', 'Bearer wrong-secret').send({ impayes: [] });
    const log = db.query.mock.calls.find(([sql, params]) => sql.includes('INSERT INTO audit_logs') && params[2] === 'erp_sync_unauthorized');
    expect(log).toBeTruthy();
  });

  it('rejects a row with the wrong field types instead of trusting the source', async () => {
    const res = await request(buildApp())
      .post('/api/erp-sync')
      .set('Authorization', 'Bearer correct-shared-secret')
      .send({ impayes: [{ erp_voucher_id: 'not-a-number', montant: 'also not a number', type_valeur: 'CHQ', numero_valeur: 'V-1', nom_tire: 'Client' }] });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeTruthy();
  });

  it('rejects a row missing required fields', async () => {
    const res = await request(buildApp())
      .post('/api/erp-sync')
      .set('Authorization', 'Bearer correct-shared-secret')
      .send({ impayes: [{ erp_voucher_id: 1 }] });
    expect(res.status).toBe(400);
  });

  it('accepts a well-formed row', async () => {
    const res = await request(buildApp())
      .post('/api/erp-sync')
      .set('Authorization', 'Bearer correct-shared-secret')
      .send({
        impayes: [
          { erp_voucher_id: 1, montant: 100.5, type_valeur: 'CHQ', numero_valeur: 'V-1', nom_tire: 'Client X', date_saisie: '2026-01-01' },
        ],
      });
    expect(res.status).toBe(200);
  });

  it('synchronizes the current ERP partner reference list', async () => {
    const res = await request(buildApp())
      .post('/api/erp-sync')
      .set('Authorization', 'Bearer correct-shared-secret')
      .send({ impayes: [], partenaires: [{ nom: 'CLIENT ERP ACTIF' }] });

    expect(res.status).toBe(200);
    expect(res.body.synchronizedPartners).toBe(1);
    const partnerUpsert = db.client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO partenaires_reference'));
    expect(partnerUpsert).toBeTruthy();
    expect(partnerUpsert[1][0]).toContain('CLIENT ERP ACTIF');
  });

  // Doit rester le dernier test : il epuise volontairement le limiteur par IP partage au
  // niveau du module pour le reste de ce fichier de test.
  it('returns a clear 429 once the per-IP limit is exceeded, regardless of secret validity', async () => {
    const app = buildApp();
    let last;
    for (let i = 0; i < 22; i++) {
      last = await request(app).post('/api/erp-sync').set('Authorization', 'Bearer wrong-secret').send({ impayes: [] });
    }
    expect(last.status).toBe(429);
    expect(last.headers['retry-after']).toBeTruthy();
    const log = db.query.mock.calls.find(([sql, params]) => sql.includes('INSERT INTO audit_logs') && params[2] === 'rate_limited');
    expect(log).toBeTruthy();
  });
});
