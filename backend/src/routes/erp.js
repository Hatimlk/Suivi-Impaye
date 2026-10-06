import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { ensureErpTrackingTables } from '../services/schema.js';
import { validate, validateQuery, createActionSchema, erpImpayesQuerySchema, statutBodySchema, reaffecterBodySchema } from '../schemas/validation.js';
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

const selectDossier = `
  SELECT v.*, s.statut AS suivi_statut, s.observations AS suivi_observations,
         s.commercial_id, s.date_derniere_action, s.date_creation AS suivi_date_creation,
         s.date_derniere_modification, u.nom AS suivi_commercial_nom
  FROM erp_impayes_snapshot v
  LEFT JOIN erp_dossier_suivi s ON s.erp_voucher_id = v.erp_voucher_id
  LEFT JOIN users u ON u.id = s.commercial_id
`;

function mapDossier(row) {
  return {
    id: `erp-${row.erp_voucher_id}`,
    source: 'ERP',
    date_saisie: row.date_saisie,
    date_facture: row.date_facture,
    date_echeance: row.date_echeance,
    montant: Number(row.montant || 0),
    type_valeur: row.type_valeur,
    numero_valeur: row.numero_valeur,
    nom_tire: row.nom_tire,
    porteur: row.porteur || '',
    relation: row.relation || 'CD',
    banque: row.banque || 'Non renseignee',
    statut: row.suivi_statut || 'Attente retour du client',
    observations: row.suivi_observations || '',
    commercial_id: row.commercial_id || null,
    commercial_nom: row.suivi_commercial_nom || row.erp_commercial_nom || null,
    date_derniere_action: row.date_derniere_action || null,
    date_creation: row.suivi_date_creation || row.synced_at,
    date_derniere_modification: row.date_derniere_modification || row.synced_at,
    date_cloture: null,
  };
}

function buildFilters(requestQuery, user) {
  const conditions = ['v.actif = true'];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    conditions.push(sql.split('?').join(`$${params.length}`));
  };
  // Un commercial ne doit voir que les dossiers qui lui sont affectés
  if (user?.role === 'commercial') add('s.commercial_id = ?', user.id);
  if (requestQuery.search) add('(v.nom_tire ILIKE ? OR v.numero_valeur ILIKE ? OR v.banque ILIKE ?)', `%${requestQuery.search}%`);
  if (requestQuery.nom_tire) add('v.nom_tire = ?', requestQuery.nom_tire);
  if (requestQuery.banque) add('v.banque = ?', requestQuery.banque);
  if (requestQuery.relation) add('v.relation = ?', requestQuery.relation);
  if (requestQuery.commercial_id === '__UNASSIGNED__') {
    conditions.push("COALESCE(NULLIF(BTRIM(u.nom), ''), NULLIF(BTRIM(v.erp_commercial_nom), '')) IS NULL");
  } else if (requestQuery.commercial_id) {
    add("COALESCE(NULLIF(BTRIM(u.nom), ''), NULLIF(BTRIM(v.erp_commercial_nom), '')) = ?", requestQuery.commercial_id);
  }
  if (requestQuery.type_valeur) add('v.type_valeur = ?', requestQuery.type_valeur);
  if (requestQuery.date_debut) add('v.date_saisie >= ?', requestQuery.date_debut);
  if (requestQuery.date_fin) add('v.date_saisie <= ?', requestQuery.date_fin);
  if (requestQuery.montant_min !== undefined) add('v.montant >= ?', requestQuery.montant_min);
  if (requestQuery.montant_max !== undefined) add('v.montant <= ?', requestQuery.montant_max);
  if (requestQuery.statut) add(`COALESCE(s.statut, 'Attente retour du client') = ?`, requestQuery.statut);
  return { where: `WHERE ${conditions.join(' AND ')}`, params };
}

router.get('/impayes', validateQuery(erpImpayesQuerySchema), async (req, res) => {
  try {
    const { page, limit } = req.validatedQuery;
    const offset = (page - 1) * limit;
    const { where, params } = buildFilters(req.validatedQuery, req.user);
    const sortMap = { date_saisie: 'v.date_saisie', date_facture: 'v.date_facture', date_echeance: 'v.date_echeance', montant: 'v.montant', nom_tire: 'v.nom_tire', type_valeur: 'v.type_valeur' };
    const sort = sortMap[req.validatedQuery.sort] || 'v.date_saisie';
    const order = String(req.validatedQuery.order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const [count, rows] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count
        FROM erp_impayes_snapshot v
        LEFT JOIN erp_dossier_suivi s ON s.erp_voucher_id = v.erp_voucher_id
        LEFT JOIN users u ON u.id = s.commercial_id
        ${where}`, params),
      query(`${selectDossier} ${where} ORDER BY ${sort} ${order} NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
    ]);
    res.json({ dossiers: rows.rows.map(mapDossier), total: count.rows[0].count, page, limit, totalPages: Math.ceil(count.rows[0].count / limit) });
  } catch (error) {
    console.error('Erreur liste impayes synchronises:', error.message);
    res.status(503).json({ error: 'Donnees ERP synchronisees indisponibles' });
  }
});

router.get('/impayes/:id', async (req, res) => {
  const id = parseErpId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant ERP invalide' });
  const result = await query(`${selectDossier} WHERE v.erp_voucher_id = $1 AND v.actif = true`, [id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Impaye ERP introuvable' });
  const dossier = mapDossier(result.rows[0]);
  if (req.user.role === 'commercial' && dossier.commercial_id !== req.user.id) return res.status(403).json({ error: 'Acces refuse' });
  const actions = await query(`SELECT a.*, ('erp-' || a.erp_voucher_id) AS dossier_id, u.nom AS auteur_nom FROM erp_actions a LEFT JOIN users u ON u.id = a.auteur_id WHERE a.erp_voucher_id = $1 ORDER BY a.date_action DESC`, [id]);
  res.json({ ...dossier, actions: actions.rows });
});

router.get('/partenaires', async (req, res) => {
  const isCommercial = req.user.role === 'commercial';
  const params = isCommercial ? [req.user.id] : [];
  const filterClause = isCommercial ? 'AND s.commercial_id = $1' : '';
  const result = await query(
    `SELECT DISTINCT v.nom_tire AS nom
     FROM erp_impayes_snapshot v
     LEFT JOIN erp_dossier_suivi s ON s.erp_voucher_id = v.erp_voucher_id
     WHERE v.actif = true AND v.nom_tire <> '' ${filterClause}
     ORDER BY nom`,
    params
  );
  res.json(result.rows.map((row) => row.nom));
});

router.get('/filters', async (req, res) => {
  try {
    const isCommercial = req.user.role === 'commercial';
    const params = isCommercial ? [req.user.id] : [];
    const roleFilter = isCommercial ? 'AND s.commercial_id = $1' : '';
    const joins = `FROM erp_impayes_snapshot v
      LEFT JOIN erp_dossier_suivi s ON s.erp_voucher_id = v.erp_voucher_id
      LEFT JOIN users u ON u.id = s.commercial_id
      WHERE v.actif = true ${roleFilter}`;
    const [partners, commercials, statuses, banks] = await Promise.all([
      query(`SELECT DISTINCT v.nom_tire AS value ${joins} AND NULLIF(BTRIM(v.nom_tire), '') IS NOT NULL ORDER BY value`, params),
      query(`SELECT DISTINCT COALESCE(NULLIF(BTRIM(u.nom), ''), NULLIF(BTRIM(v.erp_commercial_nom), '')) AS value ${joins} ORDER BY value NULLS LAST`, params),
      query(`SELECT DISTINCT COALESCE(NULLIF(BTRIM(s.statut), ''), 'Attente retour du client') AS value ${joins} ORDER BY value`, params),
      query(`SELECT DISTINCT COALESCE(NULLIF(BTRIM(v.banque), ''), 'Non renseignee') AS value ${joins} ORDER BY value`, params),
    ]);
    const commercialValues = commercials.rows.map((row) => row.value).filter(Boolean);
    const hasUnassigned = commercials.rows.some((row) => !row.value);
    res.json({
      partenaires: partners.rows.map((row) => row.value),
      commerciaux: [
        ...commercialValues.map((name) => ({ id: name, nom: name })),
        ...(hasUnassigned ? [{ id: '__UNASSIGNED__', nom: 'Non affecte' }] : []),
      ],
      statuts: statuses.rows.map((row) => row.value),
      banques: banks.rows.map((row) => row.value),
    });
  } catch (error) {
    console.error('Erreur filtres ERP:', error.message);
    res.status(503).json({ error: 'Filtres ERP indisponibles' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const isCommercial = req.user.role === 'commercial';
    const params = isCommercial ? [req.user.id] : [];
    const filterClause = isCommercial ? 'AND s.commercial_id = $1' : '';
    const base = `FROM erp_impayes_snapshot v LEFT JOIN erp_dossier_suivi s ON s.erp_voucher_id = v.erp_voucher_id WHERE v.actif = true ${filterClause}`;
    const [total, types, monthly, sync] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(v.montant), 0)::float8 AS montant, MAX(v.date_saisie) AS date_reference ${base}`, params),
      query(`SELECT v.type_valeur, COUNT(*)::int AS count, COALESCE(SUM(v.montant), 0)::float8 AS total_montant ${base} GROUP BY v.type_valeur ORDER BY v.type_valeur`, params),
      query(`SELECT TO_CHAR(v.date_saisie, 'YYYY-MM') AS mois, COUNT(*)::int AS count, COALESCE(SUM(v.montant), 0)::float8 AS total_montant ${base} GROUP BY 1 ORDER BY 1`, params),
      query(`SELECT MAX(completed_at) AS last_sync FROM erp_sync_runs WHERE status = 'success'`),
    ]);
    res.json({ total: total.rows[0], parStatut: [{ statut: 'Impayes ERP', count: total.rows[0].count, total_montant: total.rows[0].montant }], parBanque: [], parCommercial: [], parType: types.rows, evolutionMensuelle: monthly.rows.slice(-12), evolutionHebdo: [], evolutionMensuelleDetail: [], evolutionAnnuelle: [], dossiersDormants: 0, lastSync: sync.rows[0].last_sync });
  } catch (error) {
    res.status(503).json({ error: 'Donnees ERP synchronisees indisponibles' });
  }
});

async function assertErpOwnership(req, res, id) {
  if (req.user.role !== 'commercial') return true;
  const assign = await query('SELECT commercial_id FROM erp_dossier_suivi WHERE erp_voucher_id = $1', [id]);
  const ownerId = assign.rows[0]?.commercial_id || null;
  if (ownerId !== req.user.id) {
    res.status(403).json({ error: 'Accès refusé' });
    return false;
  }
  return true;
}

router.patch('/impayes/:id/statut', validate(statutBodySchema), async (req, res) => {
  const id = parseErpId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant ERP invalide' });
  if (req.user.role === 'lecture_seule') return res.status(403).json({ error: 'Lecture seule' });
  if (!(await assertErpOwnership(req, res, id))) return;
  const { statut } = req.validated;
  const result = await query(`INSERT INTO erp_dossier_suivi (erp_voucher_id, statut) VALUES ($1, $2) ON CONFLICT (erp_voucher_id) DO UPDATE SET statut = EXCLUDED.statut, date_derniere_modification = NOW() RETURNING *`, [id, statut]);
  await logAudit(req.user.id, null, 'erp_statut', { erp_voucher_id: id, statut });
  res.json(result.rows[0]);
});

router.post('/impayes/:id/actions', validate(createActionSchema), async (req, res) => {
  const id = parseErpId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant ERP invalide' });
  if (req.user.role === 'lecture_seule') return res.status(403).json({ error: 'Lecture seule' });
  if (!(await assertErpOwnership(req, res, id))) return;
  await query(`INSERT INTO erp_dossier_suivi (erp_voucher_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  const result = await query(`INSERT INTO erp_actions (erp_voucher_id, auteur_id, contenu, type_action) VALUES ($1, $2, $3, $4) RETURNING *`, [id, req.user.id, req.validated.contenu, req.validated.type_action]);
  await query(`UPDATE erp_dossier_suivi SET date_derniere_action = NOW(), date_derniere_modification = NOW() WHERE erp_voucher_id = $1`, [id]);
  await logAudit(req.user.id, null, 'erp_action', { erp_voucher_id: id, action_id: result.rows[0].id });
  const action = await query(`SELECT a.*, ('erp-' || a.erp_voucher_id) AS dossier_id, u.nom AS auteur_nom FROM erp_actions a LEFT JOIN users u ON u.id = a.auteur_id WHERE a.id = $1`, [result.rows[0].id]);
  res.status(201).json(action.rows[0]);
});

router.patch('/impayes/:id/reaffecter', requireRole('admin', 'responsable_recouvrement'), validate(reaffecterBodySchema), async (req, res) => {
  const id = parseErpId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant ERP invalide' });
  const { commercial_id } = req.validated;
  const user = await query(`SELECT id FROM users WHERE id = $1 AND actif = true AND role = 'commercial'`, [commercial_id]);
  if (!user.rows[0]) return res.status(400).json({ error: 'Commercial destinataire introuvable ou inactif' });
  const result = await query(`INSERT INTO erp_dossier_suivi (erp_voucher_id, commercial_id) VALUES ($1, $2) ON CONFLICT (erp_voucher_id) DO UPDATE SET commercial_id = EXCLUDED.commercial_id, date_derniere_modification = NOW() RETURNING *`, [id, commercial_id]);
  res.json(result.rows[0]);
});

export default router;
