import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeQueryImpl } from './helpers.js';

process.env.CRON_SECRET = 'test-cron-secret-at-least-16-characters';

const db = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock('../src/config/db.js', () => ({ query: db.query }));
vi.mock('../src/services/mailer.js', () => ({ sendActionDeadlineReminder: vi.fn() }));

const cronRouter = (await import('../src/routes/cron.js')).default;

function buildApp() {
  const app = express();
  app.use('/api/cron', cronRouter);
  return app;
}

beforeEach(() => {
  db.query.mockReset();
  db.query.mockImplementation(fakeQueryImpl([]));
});

describe('GET /api/cron/action-reminders', () => {
  it('refuses a request without the Vercel cron secret', async () => {
    const response = await request(buildApp()).get('/api/cron/action-reminders');
    expect(response.status).toBe(401);
  });

  it('returns zero when no overdue reminder is available', async () => {
    const response = await request(buildApp())
      .get('/api/cron/action-reminders')
      .set('Authorization', `Bearer ${process.env.CRON_SECRET}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, processed: 0, sent: 0, failed: 0 });
  });
});
