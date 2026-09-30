import dotenv from 'dotenv';
import { mkdirSync, statSync, writeFileSync } from 'fs';
import { resolve } from 'path';

dotenv.config({ path: ['.env.production.local', '.env.local', '.env'] });

if (!process.argv.includes('--confirm-clear-dossiers')) {
  console.error('Annule: ajouter --confirm-clear-dossiers pour confirmer la suppression.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('Annule: DATABASE_URL est absente.');
  process.exit(1);
}

const { default: pg } = await import('pg');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10000,
});

const client = await pool.connect();
let backupPath;

try {
  await client.query('BEGIN');
  await client.query('LOCK TABLE dossiers IN SHARE ROW EXCLUSIVE MODE');

  const [dossiers, actions, auditLogs] = await Promise.all([
    client.query('SELECT * FROM dossiers ORDER BY date_creation, id'),
    client.query('SELECT * FROM actions ORDER BY date_creation, id'),
    client.query('SELECT * FROM audit_logs WHERE dossier_id IS NOT NULL ORDER BY date_action, id'),
  ]);

  const backup = {
    format: 'suivi-impaye-dossiers-backup-v1',
    created_at: new Date().toISOString(),
    counts: {
      dossiers: dossiers.rowCount,
      actions: actions.rowCount,
      audit_logs_lies: auditLogs.rowCount,
    },
    dossiers: dossiers.rows,
    actions: actions.rows,
    audit_logs_lies: auditLogs.rows,
  };

  const backupDir = resolve('backups');
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  backupPath = resolve(backupDir, `dossiers-avant-erp-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 2), { encoding: 'utf8', flag: 'wx' });

  if (statSync(backupPath).size === 0) {
    throw new Error('Le fichier de sauvegarde est vide.');
  }

  const deleted = await client.query('DELETE FROM dossiers RETURNING id');
  const remaining = await client.query('SELECT COUNT(*)::int AS count FROM dossiers');
  if (remaining.rows[0].count !== 0) {
    throw new Error(`Verification echouee: ${remaining.rows[0].count} dossier(s) restant(s).`);
  }

  await client.query('COMMIT');
  console.log(JSON.stringify({
    backupPath,
    backupBytes: statSync(backupPath).size,
    backedUp: backup.counts,
    deletedDossiers: deleted.rowCount,
    remainingDossiers: remaining.rows[0].count,
  }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  console.error(`Echec: ${error.message}`);
  if (backupPath) console.error(`Sauvegarde conservee: ${backupPath}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
