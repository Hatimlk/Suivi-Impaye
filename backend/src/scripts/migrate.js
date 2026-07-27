import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/suivi_impaye',
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Debut des migrations...');
    const migration1 = readFileSync(join(__dirname, '../../migrations/001_create_schema.sql'), 'utf8');
    await client.query(migration1);
    console.log('Migration 001 terminee: schema cree');

    const migration2 = readFileSync(join(__dirname, '../../migrations/002_seed_data.sql'), 'utf8');
    await client.query(migration2);
    console.log('Migration 002 terminee: donnees initiales inserees');

    // Creer l'admin par defaut
    const adminExists = await client.query("SELECT id FROM users WHERE email = 'admin@gadimat.ma'");
    if (adminExists.rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 12);
      await client.query(
        "INSERT INTO users (nom, email, mot_de_passe_hash, role, actif) VALUES ($1, $2, $3, $4, true)",
        ['Administrateur', 'admin@gadimat.ma', hash, 'admin']
      );
      console.log('Utilisateur admin cree: admin@gadimat.ma / admin123');
    }

    console.log('Toutes les migrations sont terminees avec succes!');
  } catch (err) {
    console.error('Erreur migration:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
