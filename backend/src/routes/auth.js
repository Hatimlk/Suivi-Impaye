import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import config from '../config/env.js';
import { validate, loginSchema, refreshTokenBodySchema, logoutBodySchema } from '../schemas/validation.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { ipRateLimiter, clientIp, isAccountLocked, FAILED_LOGIN_WINDOW_MINUTES, FAILED_LOGIN_MAX_ATTEMPTS } from '../middleware/rateLimiter.js';

const router = Router();

const loginIpLimiter = ipRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  name: 'login_ip',
  message: 'Trop de tentatives de connexion depuis cette adresse, veuillez réessayer plus tard',
});

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueRefreshToken(userId) {
  const refreshToken = jwt.sign({ id: userId }, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, hashToken(refreshToken), expiresAt]
  );
  return refreshToken;
}

// POST /api/auth/login
router.post('/login', loginIpLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.validated;
    const ip = clientIp(req);

    if (await isAccountLocked(query, email)) {
      await logAudit(null, null, 'login_blocked', { email, ip });
      return res.status(429).json({
        error: `Trop de tentatives échouées (max ${FAILED_LOGIN_MAX_ATTEMPTS}) pour ce compte. Réessayez dans ${FAILED_LOGIN_WINDOW_MINUTES} minutes.`,
        retryAfterSeconds: FAILED_LOGIN_WINDOW_MINUTES * 60,
      });
    }

    const result = await query('SELECT * FROM users WHERE email = $1 AND actif = true', [email]);
    if (result.rows.length === 0) {
      await logAudit(null, null, 'login_failed', { email, ip, reason: 'unknown_email_or_inactive' });
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.mot_de_passe_hash);
    if (!validPassword) {
      await logAudit(user.id, null, 'login_failed', { email, ip, reason: 'wrong_password' });
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      role: user.role,
    };

    const accessToken = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    const refreshToken = await issueRefreshToken(user.id);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', validate(refreshTokenBodySchema), async (req, res) => {
  try {
    const { refreshToken } = req.validated;
    const tokenHash = hashToken(refreshToken);
    const result = await query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [tokenHash]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
    }

    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
    const userResult = await query('SELECT * FROM users WHERE id = $1 AND actif = true', [decoded.id]);
    if (userResult.rows.length === 0) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [tokenHash]);
      return res.status(401).json({ error: 'Utilisateur introuvable ou désactivé' });
    }

    const user = userResult.rows[0];
    const tokenPayload = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      role: user.role,
    };

    // Rotation : le refresh token utilisé est invalidé et remplacé
    await query('DELETE FROM refresh_tokens WHERE token = $1', [tokenHash]);
    const newAccessToken = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    const newRefreshToken = await issueRefreshToken(user.id);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('Erreur refresh:', err);
    res.status(401).json({ error: 'Token invalide' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, validate(logoutBodySchema), async (req, res) => {
  try {
    const { refreshToken } = req.validated;
    if (refreshToken) {
      // Scope la suppression au propriétaire du token pour éviter qu'un utilisateur
      // ne révoque la session d'un autre s'il venait à connaître son refresh token.
      await query('DELETE FROM refresh_tokens WHERE token = $1 AND user_id = $2', [hashToken(refreshToken), req.user.id]);
    }
    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    console.error('Erreur logout:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nom, email, role, actif, date_creation FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
