import { readFileSync } from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/suivi_impaye';
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

try {
  const sql = readFileSync(new URL('../../migrations/003_add_dossier_dates.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('Migration 003 appliquée avec succès.');
} finally {
  await pool.end();
}
