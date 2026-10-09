import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: [resolve(projectRoot, '.env.local'), resolve(projectRoot, '.env')] });

import erpPool, { erpQuery } from '../config/erpDb.js';
import { resolveCollectingBankName } from '../services/erpBank.js';
import { buildCommercialMap, resolveCommercialName } from '../services/erpCommercial.js';
import { resolveRelation } from '../services/erpRelation.js';

const targetUrl = process.env.ERP_SYNC_TARGET_URL || 'https://suivi-impaye.vercel.app/api/erp-sync';
const secret = process.env.ERP_SYNC_SECRET;
const commercialMap = buildCommercialMap(process.env.ERP_COMMERCIAL_MAP);

if (!secret) {
  console.error('ERP_SYNC_SECRET est requise.');
  process.exit(1);
}

try {
  const result = await erpQuery(`
    SELECT
      v.id AS erp_voucher_id,
      TO_CHAR(v.impaye_date, 'YYYY-MM-DD') AS date_saisie,
      TO_CHAR(v.date, 'YYYY-MM-DD') AS date_facture,
      TO_CHAR(COALESCE(v.date_due, v.check_end_date, v.boe_end_date), 'YYYY-MM-DD') AS date_echeance,
      GREATEST(COALESCE(v.amount, 0) - COALESCE(v.impaye_amount_paid, 0), 0) AS montant,
      CASE WHEN v.check_journal THEN 'CHQ' WHEN v.boe_journal THEN 'LCN' ELSE 'CHQ' END AS type_valeur,
      COALESCE(NULLIF(v.number, ''), NULLIF(v.reference, ''), v.id::text) AS numero_valeur,
      COALESCE(NULLIF(p.name, ''), NULLIF(p.display_name, ''), 'Client ERP') AS nom_tire,
      COALESCE(v.porteur_cheque, '') AS porteur,
      v.collecting_bank AS erp_collecting_bank_id,
      v.partner_id AS erp_partner_id,
      v.partner_seller_id AS erp_commercial_id,
      COALESCE(p.seller_id_name, '') AS erp_commercial_nom
    FROM account_voucher v
    LEFT JOIN res_partner p ON p.id = v.partner_id
    WHERE v.state = 'impaye'
      AND v.type = 'receipt'
      AND v.impaye_date IS NOT NULL
      AND COALESCE(v.amount, 0) - COALESCE(v.impaye_amount_paid, 0) > 0
    ORDER BY v.id
  `);

  const partnersResult = await erpQuery(`
    SELECT DISTINCT REGEXP_REPLACE(
      BTRIM(COALESCE(NULLIF(p.name, ''), NULLIF(p.display_name, ''))),
      '\\s+', ' ', 'g'
    ) AS nom
    FROM account_voucher v
    JOIN res_partner p ON p.id = v.partner_id
    WHERE v.state = 'impaye'
      AND v.type = 'receipt'
      AND v.impaye_date IS NOT NULL
      AND COALESCE(v.amount, 0) - COALESCE(v.impaye_amount_paid, 0) > 0
      AND COALESCE(NULLIF(BTRIM(p.name), ''), NULLIF(BTRIM(p.display_name), '')) IS NOT NULL
    ORDER BY nom
  `);

  if (result.rows.length === 0) throw new Error('Aucun impaye ERP trouve; synchronisation annulee par securite.');
  const impayes = result.rows.map((row) => ({
    ...row,
    erp_voucher_id: Number(row.erp_voucher_id),
    montant: Number(row.montant),
    erp_partner_id: row.erp_partner_id == null ? null : Number(row.erp_partner_id),
    banque: resolveCollectingBankName(row.erp_collecting_bank_id),
    relation: resolveRelation(row.nom_tire, row.porteur),
    erp_commercial_nom: resolveCommercialName(row, commercialMap),
  }));
  const invalidNumericRow = impayes.find((row) =>
    !Number.isInteger(row.erp_voucher_id)
    || !Number.isFinite(row.montant)
    || (row.erp_partner_id !== null && !Number.isInteger(row.erp_partner_id))
  );
  if (invalidNumericRow) throw new Error('Une ligne ERP contient un identifiant ou un montant invalide.');
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({
      generatedAt: new Date().toISOString(),
      impayes,
      partenaires: partnersResult.rows,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(body.details) && body.details[0]
      ? ` (${body.details[0].field}: ${body.details[0].message})`
      : '';
    throw new Error(`${body.error || `HTTP ${response.status}`}${detail}`);
  }
  console.log(`Synchronisation terminee: ${body.synchronized} impaye(s), ${body.synchronizedPartners || 0} partenaire(s).`);
} catch (error) {
  console.error(`Echec de synchronisation: ${error.message}`);
  process.exitCode = 1;
} finally {
  await erpPool?.end();
}
