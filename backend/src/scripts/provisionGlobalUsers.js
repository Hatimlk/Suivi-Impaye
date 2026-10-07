import { randomBytes } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const USERS = [
  { nom: 'Nabil Safouane', email: 'nabil.safouane@gadimat.com' },
  { nom: 'Ania Guillet', email: 'ania.guillet@gadimat.com' },
  { nom: 'Nadia Nouiti', email: 'nadia.nouiti@gadimat.com' },
  { nom: 'Mostafa Hilali', email: 'mostafa.hilali@gadimat.com' },
  { nom: 'Hassan Feriziz', email: 'hassan.feriziz@gadimat.com' },
  { nom: 'Mustapha Bengouram', email: 'mustapha.bengouram@gadimat.com' },
];

const APPLY_FLAG = '--apply';
const shouldApply = process.argv.includes(APPLY_FLAG);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL est requise.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

function generatePassword() {
  return `Gd!${randomBytes(9).toString('base64url')}`;
}

async function provision() {
  const client = await pool.connect();
  try {
    const emails = USERS.map(({ email }) => email);
    const existing = await client.query(
      'SELECT nom, email, role, actif FROM users WHERE LOWER(email) = ANY($1::text[]) ORDER BY email',
      [emails]
    );

    if (!shouldApply) {
      console.log(JSON.stringify({
        mode: 'verification',
        comptesDemandes: USERS,
        comptesExistants: existing.rows,
        commandeApplication: 'npm --prefix backend run provision-global-users -- --apply',
      }, null, 2));
      return;
    }

    const credentials = [];
    const existingEmails = new Set(existing.rows.map(({ email }) => email.toLowerCase()));
    await client.query('BEGIN');
    for (const user of USERS) {
      const password = generatePassword();
      const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 12));
      const result = await client.query(
        `INSERT INTO users (nom, email, mot_de_passe_hash, role, actif)
         VALUES ($1, LOWER($2), $3, 'responsable_recouvrement', true)
         ON CONFLICT (email) DO UPDATE SET
           nom = EXCLUDED.nom,
           role = EXCLUDED.role,
           actif = true,
           date_modification = NOW()
         RETURNING nom, email, role, actif`,
        [user.nom, user.email, hash]
      );
      credentials.push({
        ...result.rows[0],
        mot_de_passe_initial: existingEmails.has(user.email) ? '(mot de passe conserve)' : password,
      });
    }
    await client.query('COMMIT');

    console.log('Comptes globaux crees ou mis a jour. Conservez ces mots de passe maintenant :');
    console.table(credentials);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Echec du provisionnement:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

provision();
