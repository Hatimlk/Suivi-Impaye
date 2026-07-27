import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/suivi_impaye',
});

// Mapping colonnes Excel vers schema
const COLUMN_MAP = {
  'Date': 'date_saisie',
  'date': 'date_saisie',
  'BQ': 'banque',
  'Banque': 'banque',
  'banque': 'banque',
  'Mt': 'montant',
  'Montant': 'montant',
  'montant': 'montant',
  'Val': 'type_valeur',
  'Type': 'type_valeur',
  'type_valeur': 'type_valeur',
  'N Val': 'numero_valeur',
  'N° Valeur': 'numero_valeur',
  'numero_valeur': 'numero_valeur',
  'Nom du tire': 'nom_tire',
  'Nom tire': 'nom_tire',
  'nom_tire': 'nom_tire',
  'Relation': 'relation',
  'relation': 'relation',
  'Observations': 'observations',
  'observations': 'observations',
  'Com': 'commercial_nom',
  'Commercial': 'commercial_nom',
  'commercial': 'commercial_nom',
  'Statut': 'statut',
  'statut': 'statut',
  'Action 1': 'action_1',
  'Action 2': 'action_2',
  'Action 3': 'action_3',
};

function mapHeader(header) {
  const trimmed = String(header).trim();
  return COLUMN_MAP[trimmed] || trimmed;
}

function parseFrenchDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  // Format DD/MM/YYYY
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  // Format YYYY-MM-DD
  const match2 = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match2) {
    return `${match2[1]}-${match2[2].padStart(2, '0')}-${match2[3].padStart(2, '0')}`;
  }
  // Excel serial date
  const num = parseFloat(str);
  if (!isNaN(num) && num > 40000 && num < 50000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  return null;
}

async function importExcel() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node importExcel.js <chemin-vers-fichier.xlsx>');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`Fichier introuvable: ${filePath}`);
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log(`Lecture du fichier: ${filePath}`);
    const wb = XLSX.readFile(filePath);
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet);

    if (rawData.length === 0) {
      console.log('Le fichier est vide ou sans donnees exploitables');
      return;
    }

    // Mapper les en-tetes
    const firstRow = rawData[0];
    const headers = Object.keys(firstRow);
    console.log('Colonnes trouvees:', headers.join(', '));

    const mappedData = rawData.map(row => {
      const mapped = {};
      for (const [origKey, value] of Object.entries(row)) {
        const mappedKey = mapHeader(origKey);
        mapped[mappedKey] = value;
      }
      return mapped;
    });

    // Recuperer les commerciaux existants
    const commerciauxResult = await client.query("SELECT id, nom FROM users WHERE role = 'commercial'");
    const commerciauxMap = {};
    for (const c of commerciauxResult.rows) {
      commerciauxMap[c.nom.toLowerCase()] = c.id;
    }

    // Recuperer le statut par defaut
    const defaultStatut = 'Attente retour du client';

    let imported = 0;
    let skipped = 0;

    for (const row of mappedData) {
      try {
        const numeroValeur = String(row.numero_valeur || '').trim();
        if (!numeroValeur) {
          skipped++;
          continue;
        }

        // Verifier doublon
        const exists = await client.query('SELECT id FROM dossiers WHERE numero_valeur = $1', [numeroValeur]);
        if (exists.rows.length > 0) {
          skipped++;
          continue;
        }

        // Trouver le commercial
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

        const result = await client.query(
          `INSERT INTO dossiers (date_saisie, banque, montant, type_valeur, numero_valeur, nom_tire, relation, observations, commercial_id, statut)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [
            dateSaisie,
            String(row.banque || 'N/A').trim(),
            montant,
            validType,
            numeroValeur,
            String(row.nom_tire || '').trim(),
            validRelation,
            String(row.observations || '').trim(),
            commercialId,
            String(row.statut || defaultStatut).trim(),
          ]
        );

        const dossierId = result.rows[0].id;

        // Inserer les actions (Action 1, 2, 3)
        for (let i = 1; i <= 3; i++) {
          const actionContent = row[`action_${i}`];
          if (actionContent && String(actionContent).trim()) {
            await client.query(
              'INSERT INTO actions (dossier_id, contenu, type_action, date_action) VALUES ($1, $2, $3, NOW())',
              [dossierId, String(actionContent).trim(), 'import']
            );
          }
        }

        // Mettre a jour la date derniere action si des actions existent
        const actionCount = await client.query(
          'SELECT COUNT(*) as c FROM actions WHERE dossier_id = $1', [dossierId]
        );
        if (parseInt(actionCount.rows[0].c) > 0) {
          await client.query(
            'UPDATE dossiers SET date_derniere_action = (SELECT MAX(date_action) FROM actions WHERE dossier_id = $1) WHERE id = $1',
            [dossierId]
          );
        }

        imported++;
      } catch (err) {
        console.error(`Erreur ligne importee:`, err.message);
        skipped++;
      }
    }

    console.log(`\nImport termine: ${imported} dossiers importes, ${skipped} ignorés`);
  } catch (err) {
    console.error('Erreur import:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

importExcel();
