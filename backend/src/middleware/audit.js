import { AsyncLocalStorage } from 'node:async_hooks';
import { query } from '../config/db.js';

const requestStorage = new AsyncLocalStorage();

function firstHeaderValue(value) {
  return String(Array.isArray(value) ? value[0] : value || '').split(',')[0].trim();
}

export function requestAuditDetails(req, details = {}) {
  if (!req) return details;
  return {
    ...details,
    ip: firstHeaderValue(req.headers?.['x-forwarded-for']) || req.ip || req.socket?.remoteAddress || 'unknown',
    user_agent: firstHeaderValue(req.headers?.['user-agent']) || 'unknown',
    method: req.method || null,
    route: req.originalUrl || req.url || null,
    session_id: req.user?.sid || details.session_id || null,
  };
}

export function auditContextMiddleware(req, _res, next) {
  requestStorage.run(req, next);
}

export async function logAudit(utilisateurId, dossierId, actionType, details = {}, req = null) {
  try {
    const enrichedDetails = requestAuditDetails(req || requestStorage.getStore(), details);
    await query(
      `INSERT INTO audit_logs (utilisateur_id, dossier_id, action_type, details_json, date_action)
       VALUES ($1, $2, $3, $4, NOW())`,
      [utilisateurId, dossierId, actionType, JSON.stringify(enrichedDetails)]
    );
  } catch (err) {
    console.error('Erreur audit log:', err);
  }
}
