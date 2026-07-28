import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { query } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import {
  validate,
  createDossierSchema,
  updateDossierSchema,
  createActionSchema,
} from '../schemas/validation.js';

const router = Router();
router.use(authenticateToken);

// GET /api/dossiers - Liste avec filtres, pagination, recherche
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      banque = '',
      statut = '',
      commercial_id = '',
      type_valeur = '',
      date_debut = '',
      date_fin = '',
      montant_min = '',
      montant_max = '',
      sort = 'date_saisie',
      order = 'DESC',
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    // Filtrage rôle: commercial ne voit que ses dossiers
    if (req.user.role === 'commercial') {
      conditions.push(`d.commercial_id = $${paramIndex}`);
      params.push(req.user.id);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(d.nom_tire ILIKE $${paramIndex} OR d.numero_valeur ILIKE $${paramIndex} OR d.banque ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (banque) {
      conditions.push(`d.banque = $${paramIndex}`);
      params.push(banque);
      paramIndex++;
    }

    if (statut) {
      conditions.push(`d.statut = $${paramIndex}`);
      params.push(statut);
      paramIndex++;
    }

    if (commercial_id) {
      conditions.push(`d.commercial_id = $${paramIndex}`);
      params.push(commercial_id);
      paramIndex++;
    }

    if (type_valeur) {
      conditions.push(`d.type_valeur = $${paramIndex}`);
      params.push(type_valeur);
      paramIndex++;
    }

    if (date_debut) {
      conditions.push(`d.date_saisie >= $${paramIndex}`);
      params.push(date_debut);
      paramIndex++;
    }

    if (date_fin) {
      conditions.push(`d.date_saisie <= $${paramIndex}`);
      params.push(date_fin);
      paramIndex++;
    }

    if (montant_min) {
      conditions.push(`d.montant >= $${paramIndex}`);
      params.push(parseFloat(montant_min));
      paramIndex++;
    }

    if (montant_max) {
      conditions.push(`d.montant <= $${paramIndex}`);
      params.push(parseFloat(montant_max));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Tri sécurisé
    const allowedSorts = ['date_saisie', 'montant', 'nom_tire', 'banque', 'statut', 'date_derniere_action'];
    const sortField = allowedSorts.includes(sort) ? sort : 'date_saisie';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) FROM dossiers d ${whereClause}`,
      params
    );

    const dossiersResult = await query(
      `SELECT d.*, u.nom as commercial_nom
       FROM dossiers d
       LEFT JOIN users u ON d.commercial_id = u.id
       ${whereClause}
       ORDER BY d.${sortField} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      dossiers: dossiersResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    console.error('Erreur liste dossiers:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/dossiers/alerts - Dossiers dormants et contentieux
router.get('/alerts', async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    if (req.user.role === 'commercial') {
      conditions.push(`commercial_id = $${paramIndex}`);
      params.push(req.user.id);
      paramIndex++;
    }

    const whereBase = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const thresholdDays = 7;

    // Dossiers dormants (pas d'action depuis X jours)
    const dormantsResult = await query(
      `SELECT d.*, u.nom as commercial_nom,
        EXTRACT(DAY FROM NOW() - COALESCE(d.date_derniere_action, d.date_creation)) as jours_sans_action
       FROM dossiers d
       LEFT JOIN users u ON d.commercial_id = u.id
       ${whereBase ? whereBase + ' AND' : 'WHERE'}
       d.date_derniere_action < NOW() - INTERVAL '${thresholdDays} days'
       OR (d.date_derniere_action IS NULL AND d.date_creation < NOW() - INTERVAL '${thresholdDays} days')
       ORDER BY d.date_derniere_action ASC NULLS FIRST`,
      params
    );

    // Dossiers contentieux / pré-contentieux
    const contentieuxResult = await query(
      `SELECT d.*, u.nom as commercial_nom
       FROM dossiers d
       LEFT JOIN users u ON d.commercial_id = u.id
       ${whereBase ? whereBase + ' AND' : 'WHERE'}
       d.statut IN ('Contentieux', 'Pré-contentieux')
       ORDER BY d.montant DESC`,
      params
    );

    res.json({
      dormants: dormantsResult.rows,
      contentieux: contentieuxResult.rows,
    });
  } catch (err) {
    console.error('Erreur alerts:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/dossiers/stats - Statistiques pour le dashboard
router.get('/stats', async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    if (req.user.role === 'commercial') {
      conditions.push(`commercial_id = $${paramIndex}`);
      params.push(req.user.id);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [
      totalResult,
      parStatutResult,
      parBanqueResult,
      parCommercialResult,
      parTypeResult,
      evolutionMensuelleResult,
      dormantsCountResult,
    ] = await Promise.all([
      // Total en cours
      query(
        `SELECT COUNT(*) as count, COALESCE(SUM(montant), 0) as total_montant
         FROM dossiers d ${whereClause}`,
        params
      ),
      // Par statut
      query(
        `SELECT statut, COUNT(*) as count, COALESCE(SUM(montant), 0) as total_montant
         FROM dossiers d ${whereClause}
         GROUP BY statut ORDER BY total_montant DESC`,
        params
      ),
      // Par banque
      query(
        `SELECT banque, COUNT(*) as count, COALESCE(SUM(montant), 0) as total_montant
         FROM dossiers d ${whereClause}
         GROUP BY banque ORDER BY total_montant DESC`,
        params
      ),
      // Par commercial
      query(
        `SELECT u.nom as commercial_nom, COUNT(*) as count, COALESCE(SUM(d.montant), 0) as total_montant
         FROM dossiers d
         LEFT JOIN users u ON d.commercial_id = u.id
         ${whereClause}
         GROUP BY u.nom ORDER BY total_montant DESC`,
        params
      ),
      // Par type de valeur
      query(
        `SELECT type_valeur, COUNT(*) as count, COALESCE(SUM(montant), 0) as total_montant
         FROM dossiers d ${whereClause}
         GROUP BY type_valeur`,
        params
      ),
      // Évolution mensuelle
      query(
        `SELECT TO_CHAR(date_saisie, 'YYYY-MM') as mois,
                COUNT(*) as count,
                COALESCE(SUM(montant), 0) as total_montant
         FROM dossiers d ${whereClause}
         GROUP BY TO_CHAR(date_saisie, 'YYYY-MM')
         ORDER BY mois DESC LIMIT 12`,
        params
      ),
      // Nombre de dossiers dormants
      query(
        `SELECT COUNT(*) as count FROM dossiers d
         ${whereClause ? whereClause + ' AND' : 'WHERE'}
         (d.date_derniere_action < NOW() - INTERVAL '7 days'
          OR (d.date_derniere_action IS NULL AND d.date_creation < NOW() - INTERVAL '7 days'))`,
        params
      ),
    ]);

    res.json({
      total: {
        count: parseInt(totalResult.rows[0].count),
        montant: parseFloat(totalResult.rows[0].total_montant),
      },
      parStatut: parStatutResult.rows,
      parBanque: parBanqueResult.rows,
      parCommercial: parCommercialResult.rows,
      parType: parTypeResult.rows,
      evolutionMensuelle: evolutionMensuelleResult.rows.reverse(),
      dossiersDormants: parseInt(dormantsCountResult.rows[0].count),
    });
  } catch (err) {
    console.error('Erreur stats:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx?|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Fichier Excel (.xlsx, .xls) ou CSV accepte uniquement'));
    }
  },
});

const COLUMN_MAP = {
  'Date': 'date_saisie', 'date': 'date_saisie',
  'BQ': 'banque', 'Banque': 'banque', 'banque': 'banque',
  'Mt': 'montant', 'Montant': 'montant', 'montant': 'montant',
  'Val': 'type_valeur', 'Type': 'type_valeur', 'type_valeur': 'type_valeur',
  'N Val': 'numero_valeur', 'N° Valeur': 'numero_valeur', 'numero_valeur': 'numero_valeur',
  'Nom du tire': 'nom_tire', 'Nom tire': 'nom_tire', 'nom_tire': 'nom_tire',
  'Relation': 'relation', 'relation': 'relation',
  'Observations': 'observations', 'observations': 'observations',
  'Com': 'commercial_nom', 'Commercial': 'commercial_nom', 'commercial': 'commercial_nom',
  'Statut': 'statut', 'statut': 'statut',
  'Action 1': 'action_1', 'Action 2': 'action_2', 'Action 3': 'action_3',
};

function parseFrenchDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  const match2 = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match2) return `${match2[1]}-${match2[2].padStart(2, '0')}-${match2[3].padStart(2, '0')}`;
  const num = parseFloat(str);
  if (!isNaN(num) && num > 40000 && num < 50000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  return null;
}

// POST /api/dossiers/import - Importer un fichier Excel
router.post('/import', requireRole('admin', 'responsable_recouvrement'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet);

    if (rawData.length === 0) {
      return res.status(400).json({ error: 'Le fichier est vide ou sans donnees exploitables' });
    }

    const mappedData = rawData.map(row => {
      const mapped = {};
      for (const [origKey, value] of Object.entries(row)) {
        const trimmed = String(origKey).trim();
        mapped[COLUMN_MAP[trimmed] || trimmed] = value;
      }
      return mapped;
    });

    const commerciauxResult = await query("SELECT id, nom FROM users WHERE role = 'commercial'");
    const commerciauxMap = {};
    for (const c of commerciauxResult.rows) {
      commerciauxMap[c.nom.toLowerCase()] = c.id;
    }

    const defaultStatut = 'Attente retour du client';
    const imported = [];
    const skipped = [];
    const errors = [];

    for (let i = 0; i < mappedData.length; i++) {
      try {
        const row = mappedData[i];
        const numeroValeur = String(row.numero_valeur || '').trim();
        if (!numeroValeur) {
          skipped.push({ ligne: i + 1, raison: 'Numero de valeur manquant' });
          continue;
        }

        const exists = await query('SELECT id FROM dossiers WHERE numero_valeur = $1', [numeroValeur]);
        if (exists.rows.length > 0) {
          skipped.push({ ligne: i + 1, numero_valeur: numeroValeur, raison: 'Doublon' });
          continue;
        }

        let commercialId = null;
        if (row.commercial_nom) {
          const nom = String(row.commercial_nom).trim().toLowerCase();
          commercialId = commerciauxMap[nom] || null;
        }

        const montant = parseFloat(String(row.montant || '0').replace(/[^\d.,\-]/g, '').replace(',', '.')) || 0;
        const typeValeur = String(row.type_valeur || 'CHQ').trim().toUpperCase();
        const validType = ['CHQ', 'LCN'].includes(typeValeur) ? typeValeur : 'CHQ';
        const relation = String(row.relation || 'CD').trim().toUpperCase();
        const validRelation = ['CD', 'CDC'].includes(relation) ? relation : 'CD';
        const dateSaisie = parseFrenchDate(row.date_saisie) || new Date().toISOString().split('T')[0];

        const result = await query(
          `INSERT INTO dossiers (date_saisie, banque, montant, type_valeur, numero_valeur, nom_tire, relation, observations, commercial_id, statut)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [
            dateSaisie,
            String(row.banque || 'N/A').trim(),
            montant, validType, numeroValeur,
            String(row.nom_tire || '').trim(),
            validRelation,
            String(row.observations || '').trim(),
            commercialId,
            String(row.statut || defaultStatut).trim(),
          ]
        );

        const dossierId = result.rows[0].id;

        for (let j = 1; j <= 3; j++) {
          const actionContent = row[`action_${j}`];
          if (actionContent && String(actionContent).trim()) {
            await query(
              'INSERT INTO actions (dossier_id, contenu, type_action, date_action) VALUES ($1, $2, $3, NOW())',
              [dossierId, String(actionContent).trim(), 'import']
            );
          }
        }

        const actionCount = await query('SELECT COUNT(*) as c FROM actions WHERE dossier_id = $1', [dossierId]);
        if (parseInt(actionCount.rows[0].c) > 0) {
          await query(
            'UPDATE dossiers SET date_derniere_action = (SELECT MAX(date_action) FROM actions WHERE dossier_id = $1) WHERE id = $1',
            [dossierId]
          );
        }

        imported.push({ ligne: i + 1, numero_valeur: numeroValeur });
      } catch (err) {
        errors.push({ ligne: i + 1, erreur: err.message });
      }
    }

    await logAudit(req.user.id, null, 'import_excel', {
      fichier: req.file.originalname,
      lignes_total: rawData.length,
      importes: imported.length,
      ignores: skipped.length,
      erreurs: errors.length,
    });

    res.json({
      message: `Import termine: ${imported.length} importe(s), ${skipped.length} ignore(s), ${errors.length} erreur(s)`,
      total: rawData.length,
      imported: imported.length,
      skipped: skipped.length,
      errors: errors.length,
      details: { imported, skipped, errors },
    });
  } catch (err) {
    console.error('Erreur import Excel:', err);
    res.status(500).json({ error: 'Erreur lors de l\'import du fichier' });
  }
});

// GET /api/dossiers/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*, u.nom as commercial_nom
       FROM dossiers d
       LEFT JOIN users u ON d.commercial_id = u.id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier introuvable' });
    }

    // Vérification accès pour commercial
    if (req.user.role === 'commercial' && dossier.commercial_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé à ce dossier' });
    }

    // Récupérer les actions
    const actionsResult = await query(
      `SELECT a.*, u.nom as auteur_nom
       FROM actions a
       LEFT JOIN users u ON a.auteur_id = u.id
       WHERE a.dossier_id = $1
       ORDER BY a.date_action DESC`,
      [req.params.id]
    );

    res.json({ ...dossier, actions: actionsResult.rows });
  } catch (err) {
    console.error('Erreur dossier:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/dossiers
router.post('/', validate(createDossierSchema), async (req, res) => {
  try {
    const data = req.validated;

    // Vérifier que le commercial assigné existe
    if (data.commercial_id) {
      const userCheck = await query('SELECT id FROM users WHERE id = $1 AND actif = true', [data.commercial_id]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Commercial assigné introuvable ou inactif' });
      }
    }

    // Si le user est commercial, il ne peut créer que pour lui-même
    let commercialId = data.commercial_id || req.user.id;
    if (req.user.role === 'commercial') {
      commercialId = req.user.id;
    }

    const result = await query(
      `INSERT INTO dossiers (date_saisie, banque, montant, type_valeur, numero_valeur, nom_tire, relation, observations, commercial_id, statut)
       VALUES (COALESCE($1::date, CURRENT_DATE), $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.date_saisie,
        data.banque,
        data.montant,
        data.type_valeur,
        data.numero_valeur,
        data.nom_tire,
        data.relation,
        data.observations || '',
        commercialId,
        data.statut || 'Attente retour du client',
      ]
    );

    await logAudit(req.user.id, result.rows[0].id, 'create', { dossier: result.rows[0] });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création dossier:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/dossiers/:id
router.put('/:id', validate(updateDossierSchema), async (req, res) => {
  try {
    const existing = await query('SELECT * FROM dossiers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier introuvable' });
    }

    if (req.user.role === 'commercial' && dossier.commercial_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (req.user.role === 'lecture_seule') {
      return res.status(403).json({ error: 'Lecture seule - modification interdite' });
    }

    const data = req.validated;
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à modifier' });
    }

    fields.push(`date_derniere_modification = NOW()`);
    values.push(req.params.id);

    const result = await query(
      `UPDATE dossiers SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    await logAudit(req.user.id, req.params.id, 'update', { modifications: data });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur modification dossier:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/dossiers/:id/statut
router.patch('/:id/statut', async (req, res) => {
  try {
    const { statut } = req.body;
    if (!statut) {
      return res.status(400).json({ error: 'Statut requis' });
    }

    const existing = await query('SELECT * FROM dossiers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier introuvable' });
    }

    if (req.user.role === 'commercial' && dossier.commercial_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (req.user.role === 'lecture_seule') {
      return res.status(403).json({ error: 'Lecture seule - modification interdite' });
    }

    const updates = { statut };
    if (statut === 'Régularisé - OK') {
      // Clôturer si régularisé
    }

    const result = await query(
      `UPDATE dossiers SET statut = $1, date_derniere_modification = NOW()
       WHERE id = $2 RETURNING *`,
      [statut, req.params.id]
    );

    await logAudit(req.user.id, req.params.id, 'statut', { ancien: dossier.statut, nouveau: statut });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur statut:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/dossiers/:id/reaffecter
router.patch('/:id/reaffecter', requireRole('admin', 'responsable_recouvrement'), async (req, res) => {
  try {
    const { commercial_id } = req.body;
    if (!commercial_id) {
      return res.status(400).json({ error: 'Commercial destinataire requis' });
    }

    const existing = await query('SELECT * FROM dossiers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier introuvable' });
    }

    const userCheck = await query(
      "SELECT id, nom FROM users WHERE id = $1 AND actif = true AND role = 'commercial'",
      [commercial_id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Commercial destinataire introuvable ou inactif' });
    }

    const result = await query(
      'UPDATE dossiers SET commercial_id = $1, date_derniere_modification = NOW() WHERE id = $2 RETURNING *',
      [commercial_id, req.params.id]
    );

    await logAudit(req.user.id, req.params.id, 'reaffectation', {
      ancien_commercial_id: existing.rows[0].commercial_id,
      nouveau_commercial_id: commercial_id,
      nouveau_commercial_nom: userCheck.rows[0].nom,
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur réaffectation:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/dossiers/:id/actions - Ajouter une action
router.post('/:id/actions', validate(createActionSchema), async (req, res) => {
  try {
    const existing = await query('SELECT * FROM dossiers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier introuvable' });
    }

    const dossier = existing.rows[0];
    if (req.user.role === 'commercial' && dossier.commercial_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }


    if (req.user.role === 'lecture_seule') {
      return res.status(403).json({ error: 'Lecture seule - ajout interdit' });
    }

    const { contenu, type_action } = req.validated;

    const result = await query(
      `INSERT INTO actions (dossier_id, auteur_id, contenu, type_action, date_action)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [req.params.id, req.user.id, contenu, type_action]
    );

    // Mettre à jour la date de dernière action du dossier
    await query(
      'UPDATE dossiers SET date_derniere_action = NOW(), date_derniere_modification = NOW() WHERE id = $1',
      [req.params.id]
    );

    const actionAvecAuteur = await query(
      `SELECT a.*, u.nom as auteur_nom FROM actions a
       LEFT JOIN users u ON a.auteur_id = u.id WHERE a.id = $1`,
      [result.rows[0].id]
    );

    await logAudit(req.user.id, req.params.id, 'action', { action_id: result.rows[0].id, type_action });

    res.status(201).json(actionAvecAuteur.rows[0]);
  } catch (err) {
    console.error('Erreur action:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/dossiers/:id
router.delete('/:id', requireRole('admin', 'responsable_recouvrement'), async (req, res) => {
  try {
    const existing = await query('SELECT * FROM dossiers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier introuvable' });
    }

    await query('DELETE FROM dossiers WHERE id = $1', [req.params.id]);
    await logAudit(req.user.id, req.params.id, 'delete', { dossier_numero: existing.rows[0].numero_valeur });

    res.json({ message: 'Dossier supprimé' });
  } catch (err) {
    console.error('Erreur suppression:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
