import { Router } from 'express';
import * as XLSX from 'xlsx';
import { query } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/export/excel
router.get('/excel', async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    let idx = 1;


    const { banque, statut, type_valeur, date_debut, date_fin } = req.query;
    if (banque) { conditions.push(`d.banque = $${idx}`); params.push(banque); idx++; }
    if (statut) { conditions.push(`d.statut = $${idx}`); params.push(statut); idx++; }
    if (type_valeur) { conditions.push(`d.type_valeur = $${idx}`); params.push(type_valeur); idx++; }
    if (date_debut) { conditions.push(`d.date_saisie >= $${idx}`); params.push(date_debut); idx++; }
    if (date_fin) { conditions.push(`d.date_saisie <= $${idx}`); params.push(date_fin); idx++; }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(
      `SELECT d.date_saisie, d.banque, d.montant, d.type_valeur, d.numero_valeur,
              d.nom_tire, d.relation, d.observations, u.nom as commercial, d.statut,
              d.date_derniere_action, d.date_creation
       FROM dossiers d LEFT JOIN users u ON d.commercial_id = u.id
       ${where} ORDER BY d.date_saisie DESC`,
      params
    );

    const data = result.rows.map(r => ({
      'Date': r.date_saisie,
      'Banque': r.banque,
      'Montant': parseFloat(r.montant),
      'Type': r.type_valeur,
      'N Valeur': r.numero_valeur,
      'Nom du tire': r.nom_tire,
      'Relation': r.relation,
      'Observations': r.observations,
      'Commercial': r.commercial,
      'Statut': r.statut,
      'Derniere action': r.date_derniere_action,
      'Date creation': r.date_creation,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 6 }, { wch: 15 },
      { wch: 25 }, { wch: 6 }, { wch: 30 }, { wch: 20 }, { wch: 25 },
      { wch: 18 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Impayes');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="impayes_export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Erreur export Excel:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
