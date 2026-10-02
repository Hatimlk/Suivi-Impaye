import { Router } from 'express';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { getClient } from '../config/db.js';
import { ensureErpTrackingTables } from '../services/schema.js';
import { logAudit } from '../middleware/audit.js';
import { ipRateLimiter, clientIp } from '../middleware/rateLimiter.js';
import { erpSyncItemSchema } from '../schemas/validation.js';

const impayesListSchema = z.array(erpSyncItemSchema);

const router = Router();

// Webhook machine-à-machine protégé par secret partagé : limite stricte par IP et on journalise
// chaque tentative avec un secret invalide (signal d'abus même sous le seuil de la limite).
const syncLimiter = ipRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  name: 'erp_sync',
  message: 'Trop de tentatives de synchronisation depuis cette adresse, veuillez réessayer plus tard',
});

function validSecret(received) {
  const expected = process.env.ERP_SYNC_SECRET || '';
  if (!expected || !received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

router.post('/', syncLimiter, async (req, res) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!validSecret(token)) {
    await logAudit(null, null, 'erp_sync_unauthorized', { ip: clientIp(req) });
    return res.status(401).json({ error: 'Cle de synchronisation invalide' });
  }
  if (!Array.isArray(req.body?.impayes)) return res.status(400).json({ error: 'Liste impayes requise' });
  if (req.body.impayes.length > 10000) return res.status(413).json({ error: 'Trop de lignes' });

  const parsed = impayesListSchema.safeParse(req.body.impayes);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Donnees impayes invalides',
      details: parsed.error.errors.slice(0, 20).map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
  }
  const impayes = parsed.data;

  await ensureErpTrackingTables();
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const run = await client.query(`INSERT INTO erp_sync_runs (received_count) VALUES ($1) RETURNING id`, [impayes.length]);
    await client.query(
      `INSERT INTO erp_impayes_snapshot (
         erp_voucher_id, date_saisie, date_facture, date_echeance, montant, type_valeur,
         numero_valeur, nom_tire, porteur, relation, banque, erp_partner_id,
         erp_commercial_nom, actif, synced_at
       )
       SELECT x.erp_voucher_id, x.date_saisie, x.date_facture, x.date_echeance,
              x.montant, x.type_valeur, x.numero_valeur, x.nom_tire,
              COALESCE(x.porteur, ''), COALESCE(x.relation, 'CD'),
              COALESCE(x.banque, 'Non renseignee'), x.erp_partner_id,
              x.erp_commercial_nom, true, NOW()
       FROM jsonb_to_recordset($1::jsonb) AS x(
         erp_voucher_id integer, date_saisie date, date_facture date, date_echeance date,
         montant numeric, type_valeur text, numero_valeur text, nom_tire text, porteur text,
         relation text, banque text, erp_partner_id integer, erp_commercial_nom text
       )
       ON CONFLICT (erp_voucher_id) DO UPDATE SET
         date_saisie = EXCLUDED.date_saisie, date_facture = EXCLUDED.date_facture,
         date_echeance = EXCLUDED.date_echeance, montant = EXCLUDED.montant,
         type_valeur = EXCLUDED.type_valeur, numero_valeur = EXCLUDED.numero_valeur,
         nom_tire = EXCLUDED.nom_tire, porteur = EXCLUDED.porteur,
         relation = EXCLUDED.relation, banque = EXCLUDED.banque,
         erp_partner_id = EXCLUDED.erp_partner_id,
         erp_commercial_nom = EXCLUDED.erp_commercial_nom,
         actif = true, synced_at = NOW()`,
      [JSON.stringify(impayes)]
    );
    const ids = impayes.map((row) => row.erp_voucher_id);
    await client.query(`UPDATE erp_impayes_snapshot SET actif = false, synced_at = NOW() WHERE actif = true AND NOT (erp_voucher_id = ANY($1::int[]))`, [ids]);
    await client.query(`UPDATE erp_sync_runs SET status = 'success', completed_at = NOW() WHERE id = $1`, [run.rows[0].id]);
    await client.query('COMMIT');
    res.json({ status: 'ok', synchronized: ids.length, runId: run.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Synchronisation ERP:', error.message);
    res.status(500).json({ error: 'Echec de la synchronisation' });
  } finally {
    client.release();
  }
});

export default router;
