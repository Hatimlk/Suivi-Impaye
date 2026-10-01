import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: [resolve(projectRoot, '.env.local'), resolve(projectRoot, '.env')] });

import erpPool, { erpQuery } from '../config/erpDb.js';

const targetUrl = process.env.ERP_SYNC_TARGET_URL || 'https://suivi-impaye.vercel.app/api/erp-sync';
const secret = process.env.ERP_SYNC_SECRET;

if (!secret) {
  console.error('ERP_SYNC_SECRET est requise.');
  process.exit(1);
}

try {
  const result = await erpQuery(`
    SELECT
      v.id AS erp_voucher_id,
      v.impaye_date AS date_saisie,
      v.date AS date_facture,
      COALESCE(v.date_due, v.check_end_date, v.boe_end_date) AS date_echeance,
      COALESCE(v.amount, 0) AS montant,
      CASE WHEN v.check_journal THEN 'CHQ' WHEN v.boe_journal THEN 'LCN' ELSE 'CHQ' END AS type_valeur,
      COALESCE(NULLIF(v.number, ''), NULLIF(v.reference, ''), v.id::text) AS numero_valeur,
      COALESCE(NULLIF(p.name, ''), NULLIF(p.display_name, ''), 'Client ERP') AS nom_tire,
      COALESCE(v.porteur_cheque, '') AS porteur,
      'CD'::text AS relation,
      CASE WHEN v.collecting_bank IS NULL THEN 'Non renseignee' ELSE 'Banque #' || v.collecting_bank::text END AS banque,
      v.partner_id AS erp_partner_id,
      COALESCE(p.seller_id_name, '') AS erp_commercial_nom
    FROM account_voucher v
    LEFT JOIN res_partner p ON p.id = v.partner_id
    WHERE v.state = 'impaye' AND v.type = 'receipt' AND v.impaye_date IS NOT NULL
    ORDER BY v.id
  `);

  if (result.rows.length === 0) throw new Error('Aucun impaye ERP trouve; synchronisation annulee par securite.');
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ generatedAt: new Date().toISOString(), impayes: result.rows }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  console.log(`Synchronisation terminee: ${body.synchronized} impaye(s).`);
} catch (error) {
  console.error(`Echec de synchronisation: ${error.message}`);
  process.exitCode = 1;
} finally {
  await erpPool?.end();
}
