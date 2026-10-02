import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/suivi_impaye';
const isSslNeeded = dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require') || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isSslNeeded ? { rejectUnauthorized: false } : false,
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

    const migration3 = readFileSync(join(__dirname, '../../migrations/003_add_dossier_dates.sql'), 'utf8');
    await client.query(migration3);
    console.log('Migration 003 terminee: dates facture et echeance ajoutees');

    const migration4 = readFileSync(join(__dirname, '../../migrations/004_add_porteur.sql'), 'utf8');
    await client.query(migration4);
    console.log('Migration 004 terminee: champ porteur ajoute et initialise');

    const migration5 = readFileSync(join(__dirname, '../../migrations/005_add_partenaires_reference.sql'), 'utf8');
    await client.query(migration5);
    console.log('Migration 005 terminee: referentiel partenaires cree');

    const migration8 = readFileSync(join(__dirname, '../../migrations/008_audit_logs_abuse_indexes.sql'), 'utf8');
    await client.query(migration8);
    console.log('Migration 008 terminee: index de detection d\'abus crees');

    // Creer l'admin par defaut (mot de passe fourni obligatoirement via l'environnement)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@gadimat.com';
    const adminExists = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (adminExists.rows.length === 0) {
      if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
        console.warn(
          `Utilisateur admin NON cree: definissez ADMIN_PASSWORD (>= 8 caracteres) et relancez la migration pour creer ${adminEmail}`
        );
      } else {
        const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
        await client.query(
          'INSERT INTO users (nom, email, mot_de_passe_hash, role, actif) VALUES ($1, $2, $3, $4, true)',
          [process.env.ADMIN_NOM || 'Administrateur', adminEmail, hash, 'admin']
        );
        console.log(`Utilisateur admin cree: ${adminEmail}`);
      }
    }

    // Creer le Directeur General (mot de passe fourni obligatoirement via l'environnement)
    if (process.env.DG_EMAIL) {
      const dgExists = await client.query('SELECT id FROM users WHERE email = $1', [process.env.DG_EMAIL]);
      if (dgExists.rows.length === 0) {
        if (!process.env.DG_PASSWORD || process.env.DG_PASSWORD.length < 8) {
          console.warn(
            `Utilisateur DG NON cree: definissez DG_PASSWORD (>= 8 caracteres) et relancez la migration pour creer ${process.env.DG_EMAIL}`
          );
        } else {
          const hash = await bcrypt.hash(process.env.DG_PASSWORD, 12);
          await client.query(
            'INSERT INTO users (nom, email, mot_de_passe_hash, role, actif) VALUES ($1, $2, $3, $4, true)',
            [process.env.DG_NOM || 'Directeur General', process.env.DG_EMAIL, hash, 'admin']
          );
          console.log(`Utilisateur DG cree: ${process.env.DG_EMAIL}`);
        }
      }
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
