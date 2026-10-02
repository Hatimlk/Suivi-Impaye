import express from 'express';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { USERS, authHeader, fakeQueryImpl } from './helpers.js';

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
  db.query.mockImplementation(fakeQueryImpl([]));
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

  it('rejects a malformed date_debut query param', async () => {
    const res = await request(buildApp())
      .get('/api/export/excel?date_debut=01-01-2026')
      .set('Authorization', authHeader(USERS.admin));
    expect(res.status).toBe(400);
  });

  it('neutralizes formula-injection payloads (CSV/Excel injection) in exported cells', async () => {
    db.query.mockImplementation(
      fakeQueryImpl([
        {
          match: (sql) => sql.includes('FROM dossiers d'),
          respond: () => [
            {
              date_saisie: '2026-01-01',
              date_facture: null,
              date_echeance: null,
              banque: 'BQ1',
              montant: 100,
              type_valeur: 'CHQ',
              numero_valeur: 'V-1',
              nom_tire: '=HYPERLINK("http://evil.test","click")',
              porteur: '',
              relation: 'CD',
              observations: '+2+2',
              commercial: 'CommA',
              statut: '-DROP',
              date_derniere_action: null,
              date_creation: null,
            },
          ],
        },
      ])
    );
    const res = await request(buildApp())
      .get('/api/export/excel')
      .set('Authorization', authHeader(USERS.admin))
      .buffer()
      .parse((streamRes, cb) => {
        const chunks = [];
        streamRes.on('data', (c) => chunks.push(c));
        streamRes.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    const wb = XLSX.read(res.body, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    expect(rows[0]['Partenaire']).toBe('\'=HYPERLINK("http://evil.test","click")');
    expect(rows[0]['Observation']).toBe("'+2+2");
    expect(rows[0]['Statut']).toBe("'-DROP");
  });
});
