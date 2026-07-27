import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/suivi_impaye';
const isSslNeeded = dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require') || process.env.NODE_ENV === 'production';

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: isSslNeeded ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Erreur inattendue sur le pool de connexion:', err);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
