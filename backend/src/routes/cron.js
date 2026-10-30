import { Router } from 'express';
import { query } from '../config/db.js';
import { ensureErpTrackingTables } from '../services/schema.js';
import { sendActionDeadlineReminder } from '../services/mailer.js';

const router = Router();

router.get('/action-reminders', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  await ensureErpTrackingTables();
  const claimed = await query(`
    WITH due AS (
      SELECT a.id
      FROM erp_actions a
      JOIN users auteur ON auteur.id = a.auteur_id
      JOIN erp_impayes_snapshot v ON v.erp_voucher_id = a.erp_voucher_id
      LEFT JOIN erp_dossier_suivi s ON s.erp_voucher_id = a.erp_voucher_id
      WHERE a.date_rappel < CURRENT_DATE
        AND a.date_rappel_email_envoye IS NULL
        AND (a.date_rappel_email_en_cours IS NULL OR a.date_rappel_email_en_cours < NOW() - INTERVAL '1 hour')
        AND auteur.actif = true
        AND NULLIF(BTRIM(auteur.email), '') IS NOT NULL
        AND v.actif = true
        AND COALESCE(s.statut, 'Attente retour du client') <> 'Contentieux'
      ORDER BY a.date_rappel, a.date_action
      LIMIT 100
      FOR UPDATE OF a SKIP LOCKED
    )
    UPDATE erp_actions a
    SET date_rappel_email_en_cours = NOW()
    FROM due
    WHERE a.id = due.id
    RETURNING a.id
  `);

  if (claimed.rows.length === 0) {
    return res.json({ success: true, processed: 0, sent: 0, failed: 0 });
  }

  const ids = claimed.rows.map((row) => row.id);
  const reminders = await query(`
    SELECT a.id, a.erp_voucher_id, a.contenu, a.type_action, a.date_rappel,
           auteur.nom AS auteur_nom, auteur.email AS auteur_email,
           v.nom_tire, v.numero_valeur
    FROM erp_actions a
    JOIN users auteur ON auteur.id = a.auteur_id
    JOIN erp_impayes_snapshot v ON v.erp_voucher_id = a.erp_voucher_id
    WHERE a.id = ANY($1::uuid[])
  `, [ids]);

  let sent = 0;
  let failed = 0;
  for (const reminder of reminders.rows) {
    try {
      await sendActionDeadlineReminder({
        user: { nom: reminder.auteur_nom, email: reminder.auteur_email },
        dossier: reminder,
        action: reminder,
      });
      await query(
        `UPDATE erp_actions
         SET date_rappel_email_envoye = NOW(), date_rappel_email_en_cours = NULL
         WHERE id = $1`,
        [reminder.id]
      );
      sent += 1;
    } catch (error) {
      await query(`UPDATE erp_actions SET date_rappel_email_en_cours = NULL WHERE id = $1`, [reminder.id]);
      console.error(`Rappel e-mail ${reminder.id}:`, error.message);
      failed += 1;
    }
  }

  res.json({ success: failed === 0, processed: reminders.rows.length, sent, failed });
});

export default router;
