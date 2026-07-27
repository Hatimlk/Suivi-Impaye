import { query } from '../config/db.js';

export async function logAudit(utilisateurId, dossierId, actionType, details = {}) {
  try {
    await query(
      `INSERT INTO audit_logs (utilisateur_id, dossier_id, action_type, details_json, date_action)
       VALUES ($1, $2, $3, $4, NOW())`,
      [utilisateurId, dossierId, actionType, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Erreur audit log:', err);
  }
}
