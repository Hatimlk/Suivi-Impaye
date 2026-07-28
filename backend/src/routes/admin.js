import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import {
  validate,
  createUserSchema,
  updateUserSchema,
  createBanqueSchema,
  createStatutSchema,
  createRelationSchema,
} from '../schemas/validation.js';

const router = Router();
router.use(authenticateToken);

// ====================== UTILISATEURS ======================

router.get('/users', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nom, email, role, actif, date_creation, date_modification FROM users ORDER BY date_creation DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/users', requireRole('admin'), validate(createUserSchema), async (req, res) => {
  try {
    const { nom, email, mot_de_passe, role, actif } = req.validated;
    const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Cet email est deja utilise' });
    }
    const hash = await bcrypt.hash(mot_de_passe, 12);
    const result = await query(
      'INSERT INTO users (nom, email, mot_de_passe_hash, role, actif) VALUES ($1, $2, $3, $4, $5) RETURNING id, nom, email, role, actif, date_creation',
      [nom, email, hash, role, actif !== undefined ? actif : true]
    );
    await logAudit(req.user.id, null, 'create_user', { user_id: result.rows[0].id, email });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur creation user:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/users/:id', requireRole('admin'), validate(updateUserSchema), async (req, res) => {
  try {
    const existing = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    const data = req.validated;
    const fields = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        if (key === 'mot_de_passe') {
          const h = await bcrypt.hash(value, 12);
          fields.push(`mot_de_passe_hash = $${idx}`);
          values.push(h);
        } else {
          fields.push(`${key} = $${idx}`);
          values.push(value);
        }
        idx++;
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'Aucune donnee a modifier' });
    fields.push('date_modification = NOW()');
    values.push(req.params.id);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, nom, email, role, actif, date_creation, date_modification`,
      values
    );
    await logAudit(req.user.id, null, 'update_user', { user_id: req.params.id });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.patch('/users/:id/toggle', requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      'UPDATE users SET actif = NOT actif, date_modification = NOW() WHERE id = $1 RETURNING id, nom, email, role, actif',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ====================== BANQUES ======================

router.get('/banques', async (req, res) => {
  try {
    const result = await query('SELECT * FROM banques_reference ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/banques', requireRole('admin'), validate(createBanqueSchema), async (req, res) => {
  try {
    const result = await query('INSERT INTO banques_reference (nom) VALUES ($1) RETURNING *', [req.validated.nom]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Cette banque existe deja' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/banques/:id', requireRole('admin'), async (req, res) => {
  try {
    await query('DELETE FROM banques_reference WHERE id = $1', [req.params.id]);
    res.json({ message: 'Banque supprimee' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ====================== STATUTS ======================

router.get('/statuts', async (req, res) => {
  try {
    const result = await query('SELECT * FROM statuts_reference ORDER BY ordre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/statuts', requireRole('admin'), validate(createStatutSchema), async (req, res) => {
  try {
    const { libelle, ordre, couleur } = req.validated;
    const result = await query(
      'INSERT INTO statuts_reference (libelle, ordre, couleur) VALUES ($1, $2, $3) RETURNING *',
      [libelle, ordre || 0, couleur || '#6b7280']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ce statut existe deja' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/statuts/:id', requireRole('admin'), async (req, res) => {
  try {
    const { libelle, ordre, couleur, actif } = req.body;
    const result = await query(
      `UPDATE statuts_reference SET
        libelle = COALESCE($1, libelle), ordre = COALESCE($2, ordre),
        couleur = COALESCE($3, couleur), actif = COALESCE($4, actif)
       WHERE id = $5 RETURNING *`,
      [libelle, ordre, couleur, actif, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Statut introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/statuts/:id', requireRole('admin'), async (req, res) => {
  try {
    await query('DELETE FROM statuts_reference WHERE id = $1', [req.params.id]);
    res.json({ message: 'Statut supprime' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ====================== RELATIONS ======================

router.get('/relations', async (req, res) => {
  try {
    const result = await query('SELECT * FROM relations_reference ORDER BY code');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/relations', requireRole('admin'), validate(createRelationSchema), async (req, res) => {
  try {
    const result = await query(
      'INSERT INTO relations_reference (code, libelle) VALUES ($1, $2) RETURNING *',
      [req.validated.code, req.validated.libelle]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ce code existe deja' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/relations/:id', requireRole('admin'), async (req, res) => {
  try {
    await query('DELETE FROM relations_reference WHERE id = $1', [req.params.id]);
    res.json({ message: 'Relation supprimee' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ====================== AUDIT LOGS ======================

router.get('/audit-logs', requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, utilisateur_id, dossier_id, action_type, date_debut, date_fin } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let idx = 1;

    if (utilisateur_id) { conditions.push(`al.utilisateur_id = $${idx}`); params.push(utilisateur_id); idx++; }
    if (dossier_id) { conditions.push(`al.dossier_id = $${idx}`); params.push(dossier_id); idx++; }
    if (action_type) { conditions.push(`al.action_type = $${idx}`); params.push(action_type); idx++; }
    if (date_debut) { conditions.push(`al.date_action >= $${idx}`); params.push(date_debut); idx++; }
    if (date_fin) { conditions.push(`al.date_action <= $${idx}`); params.push(date_fin); idx++; }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(`SELECT COUNT(*) FROM audit_logs al ${where}`, params);
    const result = await query(
      `SELECT al.*, u.nom as utilisateur_nom
       FROM audit_logs al LEFT JOIN users u ON al.utilisateur_id = u.id
       ${where} ORDER BY al.date_action DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
