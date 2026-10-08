import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { ipRateLimiter } from '../middleware/rateLimiter.js';
import { ensurePartenairesTable } from '../services/schema.js';
import { checkErpConnection, getErpConfigurationStatus } from '../config/erpDb.js';
import { sendSmtpTestEmail } from '../services/mailer.js';
import {
  validate,
  validateQuery,
  createUserSchema,
  updateUserSchema,
  createBanqueSchema,
  createStatutSchema,
  updateStatutRefSchema,
  createRelationSchema,
  auditLogQuerySchema,
} from '../schemas/validation.js';

const router = Router();
router.use(authenticateToken);

router.post('/smtp/test', requireRole('admin'), async (req, res) => {
  try {
    const result = await sendSmtpTestEmail({ to: req.user.email, nom: req.user.nom });
    res.json(result);
  } catch (err) {
    console.error('Erreur test SMTP:', err.message);
    res.status(503).json({ error: 'Échec du test SMTP. Vérifiez les variables Vercel et le mot de passe.' });
  }
});

// Création de compte ("signup" admin) et réinitialisation de mot de passe sont des cibles
// de choix pour un abus (admin compromis / script en boucle) : on les limite en plus du rôle requis.
const createUserLimiter = ipRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  name: 'admin_create_user',
  message: 'Trop de créations de compte depuis cette adresse, veuillez réessayer plus tard',
});

const resetPasswordLimiter = ipRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  name: 'admin_reset_password',
  message: 'Trop de réinitialisations de mot de passe depuis cette adresse, veuillez réessayer plus tard',
});

function generateRandomPassword(length = 14) {
  const categories = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%^&*-_=+',
  ];
  const all = categories.join('');
  const chars = categories.map((cat) => cat[crypto.randomInt(cat.length)]);
  while (chars.length < length) {
    chars.push(all[crypto.randomInt(all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// ====================== CONNEXION ERP ======================

router.get('/erp/status', requireRole('admin'), async (_req, res) => {
  const configuration = getErpConfigurationStatus();
  if (!configuration.configured) {
    return res.status(503).json({
      status: 'not_configured',
      missing: configuration.missing,
      host: configuration.host,
      database: configuration.database,
    });
  }

  try {
    const result = await checkErpConnection();
    res.json({
      status: 'connected',
      host: configuration.host,
      database: result.database,
      readOnly: result.read_only === 'on',
      checkedAt: result.checked_at,
    });
  } catch (error) {
    console.error('Verification connexion ERP:', error.message);
    res.status(503).json({
      status: 'unavailable',
      host: configuration.host,
      database: configuration.database,
      error: 'Connexion ERP indisponible',
    });
  }
});

// ====================== PARTENAIRES ======================

router.get('/partenaires', async (_req, res) => {
  try {
    await ensurePartenairesTable();
    const result = await query(
      `SELECT * FROM partenaires_reference
       WHERE source <> 'legacy' AND (source <> 'ERP' OR actif = true)
       ORDER BY nom`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur partenaires:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/partenaires', requireRole('admin'), validate(createBanqueSchema), async (req, res) => {
  try {
    await ensurePartenairesTable();
    const result = await query('INSERT INTO partenaires_reference (nom) VALUES ($1) RETURNING *', [req.validated.nom.trim()]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ce partenaire existe déjà' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/partenaires/:id', requireRole('admin'), validate(createBanqueSchema), async (req, res) => {
  try {
    await ensurePartenairesTable();
    const result = await query('UPDATE partenaires_reference SET nom = $1 WHERE id = $2 RETURNING *', [req.validated.nom.trim(), req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Partenaire introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ce partenaire existe déjà' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.patch('/partenaires/:id/toggle', requireRole('admin'), async (req, res) => {
  try {
    await ensurePartenairesTable();
    const result = await query('UPDATE partenaires_reference SET actif = NOT actif WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Partenaire introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

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

router.post('/users', createUserLimiter, requireRole('admin'), validate(createUserSchema), async (req, res) => {
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

router.post('/users/:id/reset-password', resetPasswordLimiter, requireRole('admin'), async (req, res) => {
  try {
    const existing = await query('SELECT id, email FROM users WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const newPassword = generateRandomPassword();
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET mot_de_passe_hash = $1, date_modification = NOW() WHERE id = $2', [
      hash,
      req.params.id,
    ]);
    // Invalide toutes les sessions actives : l'utilisateur doit se reconnecter avec le nouveau mot de passe
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.params.id]);
    await logAudit(req.user.id, null, 'reset_user_password', {
      user_id: req.params.id,
      email: existing.rows[0].email,
    });

    res.json({ password: newPassword });
  } catch (err) {
    console.error('Erreur reset password:', err);
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

router.put('/statuts/:id', requireRole('admin'), validate(updateStatutRefSchema), async (req, res) => {
  try {
    const { libelle, ordre, couleur, actif } = req.validated;
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

router.get('/audit-logs', requireRole('admin'), validateQuery(auditLogQuerySchema), async (req, res) => {
  try {
    const { page, limit, utilisateur_id, dossier_id, action_type, date_debut, date_fin } = req.validatedQuery;
    const offset = (page - 1) * limit;
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

router.delete('/audit-logs/:id', requireRole('admin'), async (req, res) => {
  try {
    const existing = await query('SELECT id FROM audit_logs WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "Entrée d'audit introuvable" });

    await query('DELETE FROM audit_logs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur suppression audit:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
