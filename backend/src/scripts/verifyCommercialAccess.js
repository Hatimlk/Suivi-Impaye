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
  const result = await pool.query(
    `SELECT u.id, u.nom, u.email, u.actif,
            COUNT(d.id)::int AS dossiers,
            COALESCE(SUM(d.montant), 0)::numeric(15,2) AS montant
     FROM users u
     LEFT JOIN dossiers d ON d.commercial_id = u.id
     WHERE u.role = 'commercial'
     GROUP BY u.id, u.nom, u.email, u.actif
     ORDER BY u.nom`,
  );

  console.table(result.rows.map(({ nom, email, actif, dossiers, montant }) => ({
    commercial: nom,
    email,
    actif,
    dossiers,
    montant: Number(montant).toFixed(2),
  })));

  const isolation = await pool.query(
    `SELECT COUNT(*)::int AS violations
     FROM dossiers d
     JOIN users u ON u.id = d.commercial_id
     WHERE u.role <> 'commercial' OR u.actif = false`,
  );
  console.log(`Affectations invalides : ${isolation.rows[0].violations}`);
} finally {
  await pool.end();
}
