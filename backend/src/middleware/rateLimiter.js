import rateLimit from 'express-rate-limit';
import { logAudit } from './audit.js';

export function clientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || 'unknown';
}

/**
 * IP-based rate limiter that also writes an audit_logs row (action_type 'rate_limited')
 * every time it trips, so abuse shows up in Administration > Journal d'audit.
 */
export function ipRateLimiter({ windowMs, max, name, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    handler: async (req, res, _next, options) => {
      const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
      await logAudit(req.user?.id || null, null, 'rate_limited', {
        limiter: name,
        ip: clientIp(req),
        route: req.originalUrl,
        method: req.method,
      });
      res.set('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ error: message, retryAfterSeconds });
    },
  });
}

export const FAILED_LOGIN_WINDOW_MINUTES = 15;
export const FAILED_LOGIN_MAX_ATTEMPTS = 5;

/**
 * Per-account lockout, independent of IP (catches distributed/credential-stuffing attempts
 * against a single account). Backed by audit_logs so it survives across serverless invocations
 * and is itself visible to an admin, instead of an in-memory counter that a stateless function
 * instance would lose.
 */
export async function isAccountLocked(query, email) {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM audit_logs
     WHERE action_type = 'login_failed'
       AND details_json->>'email' = $1
       AND date_action > NOW() - INTERVAL '${FAILED_LOGIN_WINDOW_MINUTES} minutes'`,
    [email]
  );
  return result.rows[0].count >= FAILED_LOGIN_MAX_ATTEMPTS;
}
