import { Router } from 'express';
import { erpQuery } from '../config/erpDb.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { ensureErpTrackingTables } from '../services/schema.js';
import { validate, createActionSchema } from '../schemas/validation.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticateToken);
router.use(async (_req, res, next) => {
  try {
    await ensureErpTrackingTables();
    next();
  } catch (error) {
    console.error('Initialisation suivi ERP:', error.message);
    res.status(503).json({ error: 'Base de suivi indisponible' });
  }
});

function parseErpId(value) {
  const id = Number(String(value).replace(/^erp-/, ''));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function mergeTracking(row, tracking) {
  return {
    ...row,
    id: `erp-${row.id}`,
    source: 'ERP',
    statut: tracking?.statut || 'Attente retour du client',
    observations: tracking?.observations || '',
    commercial_id: tracking?.commercial_id || null,
    commercial_nom: tracking?.commercial_nom || row.commercial_nom || null,
    date_derniere_action: tracking?.date_derniere_action || null,
    date_creation: tracking?.date_creation || row.date_saisie,
    date_derniere_modification: tracking?.date_derniere_modification || row.date_saisie,
    date_cloture: null,
  };
}

const baseSelect = `
  SELECT
    v.id,
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
    'Impaye ERP'::text AS statut,
    COALESCE(p.seller_id_name, '') AS commercial_nom,
    v.partner_id AS erp_partner_id,
    v.state AS erp_state
  FROM account_voucher v
  LEFT JOIN res_partner p ON p.id = v.partner_id
`;

function buildFilters(query) {
  const conditions = ["v.state = 'impaye'", "v.type = 'receipt'", 'v.impaye_date IS NOT NULL'];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    conditions.push(sql.split('?').join(`$${params.length}`));
  };

  if (query.search) add(`(p.name ILIKE ? OR p.display_name ILIKE ? OR v.number ILIKE ? OR v.reference ILIKE ?)`, `%${query.search}%`);
  // Le même paramètre est utilisé quatre fois dans le filtre de recherche.
  if (query.search) conditions[conditions.length - 1] = conditions[conditions.length - 1].replace(/\$\d+/g, `$${params.length}`);
  if (query.nom_tire) add('(p.name ILIKE ? OR p.display_name ILIKE ?)', `%${query.nom_tire}%`);
  if (query.nom_tire) conditions[conditions.length - 1] = conditions[conditions.length - 1].replace(/\$\d+/g, `$${params.length}`);
  if (query.type_valeur === 'CHQ') conditions.push('v.check_journal = true');
  if (query.type_valeur === 'LCN') conditions.push('v.boe_journal = true');
  if (query.date_debut) add('v.impaye_date >= ?', query.date_debut);
  if (query.date_fin) add('v.impaye_date <= ?', query.date_fin);
  if (query.montant_min) add('v.amount >= ?', Number(query.montant_min));
  if (query.montant_max) add('v.amount <= ?', Number(query.montant_max));
  return { where: `WHERE ${conditions.join(' AND ')}`, params };
}

router.get('/impayes', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { where, params } = buildFilters(req.query);
    const sortMap = {
      date_saisie: 'v.impaye_date', date_facture: 'v.date', date_echeance: 'v.date_due',
      montant: 'v.amount', nom_tire: 'p.name', type_valeur: 'v.check_journal',
    };
    const sort = sortMap[req.query.sort] || 'v.impaye_date';
    const order = String(req.query.order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const [count, rows] = await Promise.all([
      erpQuery(`SELECT COUNT(*)::int AS count FROM account_voucher v LEFT JOIN res_partner p ON p.id = v.partner_id ${where}`, params),
      erpQuery(`${baseSelect} ${where} ORDER BY ${sort} ${order} NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
    ]);
    const ids = rows.rows.map((row) => row.id);
    const tracking = ids.length ? await query(
      `SELECT s.*, u.nom AS commercial_nom FROM erp_dossier_suivi s
       LEFT JOIN users u ON u.id = s.commercial_id WHERE s.erp_voucher_id = ANY($1::int[])`,
      [ids]
    ) : { rows: [] };
    const trackingMap = new Map(tracking.rows.map((row) => [row.erp_voucher_id, row]));
    res.json({
      dossiers: rows.rows.map((row) => mergeTracking(row, trackingMap.get(row.id))),
      total: count.rows[0].count,
      page,
      limit,
      totalPages: Math.ceil(count.rows[0].count / limit),
    });
  } catch (error) {
    console.error('Erreur liste impayes ERP:', error.message);
    res.status(503).json({ error: 'Donnees ERP indisponibles' });
  }
});

router.get('/impayes/:id', async (req, res) => {
  const id = parseErpId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant ERP invalide' });
  try {
    const erp = await erpQuery(`${baseSelect} WHERE v.id = $1 AND v.state = 'impaye'`, [id]);
    if (!erp.rows[0]) return res.status(404).json({ error: 'Impaye ERP introuvable' });
    const tracking = await query(
      `SELECT s.*, u.nom AS commercial_nom FROM erp_dossier_suivi s
       LEFT JOIN users u ON u.id = s.commercial_id WHERE s.erp_voucher_id = $1`, [id]
    );
    const actions = await query(
      `SELECT a.*, ('erp-' || a.erp_voucher_id) AS dossier_id, u.nom AS auteur_nom
       FROM erp_actions a LEFT JOIN users u ON u.id = a.auteur_id
       WHERE a.erp_voucher_id = $1 ORDER BY a.date_action DESC`, [id]
    );
    const dossier = mergeTracking(erp.rows[0], tracking.rows[0]);
    if (req.user.role === 'commercial' && dossier.commercial_id && dossier.commercial_id !== req.user.id) {
      return res.status(403).json({ error: 'Acces refuse a ce dossier' });
    }
    res.json({ ...dossier, actions: actions.rows });
  } catch (error) {
    console.error('Erreur detail ERP:', error.message);
    res.status(503).json({ error: 'Donnees ERP indisponibles' });
  }
});

router.patch('/impayes/:id/statut', async (req, res) => {
  const id = parseErpId(req.params.id);
  if (!id || !req.body.statut) return res.status(400).json({ error: 'Identifiant et statut requis' });
  if (req.user.role === 'lecture_seule') return res.status(403).json({ error: 'Lecture seule' });
  const result = await query(
    `INSERT INTO erp_dossier_suivi (erp_voucher_id, statut) VALUES ($1, $2)
     ON CONFLICT (erp_voucher_id) DO UPDATE SET statut = EXCLUDED.statut, date_derniere_modification = NOW()
     RETURNING *`, [id, req.body.statut]
  );
  await logAudit(req.user.id, null, 'erp_statut', { erp_voucher_id: id, statut: req.body.statut });
  res.json(result.rows[0]);
});

router.post('/impayes/:id/actions', validate(createActionSchema), async (req, res) => {
  const id = parseErpId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant ERP invalide' });
  if (req.user.role === 'lecture_seule') return res.status(403).json({ error: 'Lecture seule' });
  const { contenu, type_action } = req.validated;
  await query(`INSERT INTO erp_dossier_suivi (erp_voucher_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  const result = await query(
    `INSERT INTO erp_actions (erp_voucher_id, auteur_id, contenu, type_action)
     VALUES ($1, $2, $3, $4) RETURNING *`, [id, req.user.id, contenu, type_action]
  );
  await query(`UPDATE erp_dossier_suivi SET date_derniere_action = NOW(), date_derniere_modification = NOW() WHERE erp_voucher_id = $1`, [id]);
  await logAudit(req.user.id, null, 'erp_action', { erp_voucher_id: id, action_id: result.rows[0].id });
  const action = await query(
    `SELECT a.*, ('erp-' || a.erp_voucher_id) AS dossier_id, u.nom AS auteur_nom
     FROM erp_actions a LEFT JOIN users u ON u.id = a.auteur_id WHERE a.id = $1`, [result.rows[0].id]
  );
  res.status(201).json(action.rows[0]);
});

router.patch('/impayes/:id/reaffecter', requireRole('admin', 'responsable_recouvrement'), async (req, res) => {
  const id = parseErpId(req.params.id);
  const user = await query(`SELECT id, nom FROM users WHERE id = $1 AND actif = true AND role = 'commercial'`, [req.body.commercial_id]);
  if (!id || !user.rows[0]) return res.status(400).json({ error: 'Dossier ou commercial invalide' });
  const result = await query(
    `INSERT INTO erp_dossier_suivi (erp_voucher_id, commercial_id) VALUES ($1, $2)
     ON CONFLICT (erp_voucher_id) DO UPDATE SET commercial_id = EXCLUDED.commercial_id, date_derniere_modification = NOW()
     RETURNING *`, [id, req.body.commercial_id]
  );
  await logAudit(req.user.id, null, 'erp_reaffectation', { erp_voucher_id: id, commercial_id: req.body.commercial_id });
  res.json(result.rows[0]);
});

router.get('/partenaires', async (_req, res) => {
  try {
    const result = await erpQuery(`
      SELECT DISTINCT COALESCE(NULLIF(p.name, ''), NULLIF(p.display_name, '')) AS nom
      FROM account_voucher v JOIN res_partner p ON p.id = v.partner_id
      WHERE v.state = 'impaye' AND v.type = 'receipt' AND v.impaye_date IS NOT NULL
      ORDER BY nom
    `);
    res.json(result.rows.map((row) => row.nom).filter(Boolean));
  } catch (error) {
    res.status(503).json({ error: 'Donnees ERP indisponibles' });
  }
});

router.get('/stats', async (_req, res) => {
  try {
    const [total, types, monthly] = await Promise.all([
      erpQuery(`SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float8 AS montant, MAX(impaye_date) AS date_reference FROM account_voucher WHERE state = 'impaye' AND type = 'receipt' AND impaye_date IS NOT NULL`),
      erpQuery(`SELECT CASE WHEN check_journal THEN 'CHQ' WHEN boe_journal THEN 'LCN' ELSE 'AUTRE' END AS type_valeur, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float8 AS total_montant FROM account_voucher WHERE state = 'impaye' AND type = 'receipt' AND impaye_date IS NOT NULL GROUP BY 1 ORDER BY 1`),
      erpQuery(`SELECT TO_CHAR(impaye_date, 'YYYY-MM') AS mois, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float8 AS total_montant FROM account_voucher WHERE state = 'impaye' AND type = 'receipt' AND impaye_date IS NOT NULL GROUP BY 1 ORDER BY 1`),
    ]);
    res.json({
      total: total.rows[0],
      parStatut: [{ statut: 'Impaye ERP', count: total.rows[0].count, total_montant: total.rows[0].montant }],
      parBanque: [], parCommercial: [], parType: types.rows,
      evolutionMensuelle: monthly.rows.slice(-12),
      evolutionHebdo: [], evolutionMensuelleDetail: [], evolutionAnnuelle: [], dossiersDormants: 0,
    });
  } catch (error) {
    console.error('Erreur statistiques ERP:', error.message);
    res.status(503).json({ error: 'Donnees ERP indisponibles' });
  }
});

export default router;
