import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

export const ERP_ALLOWED_TABLES = Object.freeze([
  'res_partner',
  'account_invoice',
  'account_invoice_line',
  'account_voucher',
  'account_voucher_line',
]);

const requiredVariables = ['ERP_DB_USER', 'ERP_DB_PASSWORD'];

export function getErpConfigurationStatus() {
  const missing = requiredVariables.filter((name) => !process.env[name]);
  return {
    configured: missing.length === 0,
    missing,
    host: process.env.ERP_DB_HOST || 'ges.gadimat.com',
    port: parseInt(process.env.ERP_DB_PORT || '5432', 10),
    database: process.env.ERP_DB_NAME || 'GADIMAT_PROD_02',
  };
}

const status = getErpConfigurationStatus();

// Connexion distincte de DATABASE_URL : cette base OpenPROD est une source
// externe en lecture seule, pas la base applicative de Suivi Impaye.
const erpPool = status.configured
  ? new pg.Pool({
      host: status.host,
      port: status.port,
      database: status.database,
      user: process.env.ERP_DB_USER,
      password: process.env.ERP_DB_PASSWORD,
      ssl: { rejectUnauthorized: true },
      max: parseInt(process.env.ERP_DB_POOL_MAX || '5', 10),
      connectionTimeoutMillis: parseInt(process.env.ERP_DB_CONNECT_TIMEOUT_MS || '10000', 10),
      idleTimeoutMillis: 30000,
      application_name: 'suivi-impaye',
      options: '-c default_transaction_read_only=on -c statement_timeout=15000',
    })
  : null;

erpPool?.on('error', (error) => {
  console.error('Erreur inattendue sur la connexion ERP:', error.message);
});

export function erpQuery(text, params) {
  if (!erpPool) {
    const error = new Error(`Connexion ERP non configuree (${status.missing.join(', ')})`);
    error.code = 'ERP_NOT_CONFIGURED';
    throw error;
  }
  return erpPool.query(text, params);
}

export async function checkErpConnection() {
  const result = await erpQuery(`
    SELECT
      current_database() AS database,
      current_user AS username,
      current_setting('transaction_read_only') AS read_only,
      NOW() AS checked_at
  `);
  return result.rows[0];
}

export default erpPool;
