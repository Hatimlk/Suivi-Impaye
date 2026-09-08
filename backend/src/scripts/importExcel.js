import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import XLSX from 'xlsx';

dotenv.config();

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/suivi_impaye';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

const DATA_SHEETS = new Set([
  'NABIL', 'OMAR', 'DIRECTION', 'FAYCAL', 'NAOUFAL',
  'FAHD', 'GII', 'LAHCEN', 'RACHID', 'OUSSAMA',
]);

function clean(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function normalizeName(value) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function canonicalCommercialName(value) {
  const name = clean(value);
  return normalizeName(name) === 'dirct' ? 'DIRECTION' : name;
}

function recordKey(row) {
  const date = row.date_saisie instanceof Date
    ? `${row.date_saisie.getFullYear()}-${String(row.date_saisie.getMonth() + 1).padStart(2, '0')}-${String(row.date_saisie.getDate()).padStart(2, '0')}`
    : (clean(row.date_saisie).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || clean(row.date_saisie));
  return [
    clean(row.numero_valeur), clean(row.banque), Number(row.montant).toFixed(2),
    clean(row.nom_tire), date,
  ].join('\u001f');
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = clean(value);
  let match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const month = Number(match[2]);
  const day = Number(match[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function parseAmount(value) {
  if (typeof value === 'number') return value;
  const text = clean(value).replace(/\s/g, '').replace(/,/g, '');
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

function findHeaderRow(rows) {
  return rows.findIndex((row) => row.some((cell) => normalizeName(cell) === 'nom client'));
}

function parseWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const records = [];
  const skipped = [];

  for (const sheetName of workbook.SheetNames) {
    if (!DATA_SHEETS.has(sheetName.toUpperCase())) continue;
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
    const headerIndex = findHeaderRow(rows);
    if (headerIndex < 0) {
      skipped.push({ feuille: sheetName, raison: 'En-tête introuvable' });
      continue;
    }
    const headers = rows[headerIndex].map(normalizeName);
    const column = (name) => headers.indexOf(normalizeName(name));
    const indexes = {
      client: column('NOM CLIENT'), commercial: column('COM'), facture: column('Dte Facture'),
      mode: column('M'), banque: column('Bqe'), numero: column('N°'),
      echeance: column('Échéance'), montant: column('Montant'), commentaire: column('Commentaire'),
    };

    for (let index = headerIndex + 1; index < rows.length; index++) {
      const row = rows[index];
      const client = clean(row[indexes.client]);
      const commercial = canonicalCommercialName(clean(row[indexes.commercial]) || sheetName);
      const numero = clean(row[indexes.numero]);
      const montant = parseAmount(row[indexes.montant]);
      const mode = clean(row[indexes.mode]).toUpperCase();

      // Les totaux et tableaux historiques n'ont pas la combinaison minimale d'une valeur impayée.
      if (!client || /\bTOTAL\b/i.test(client) || montant == null) continue;
      if (!numero && ['C', 'T'].includes(mode)) {
        skipped.push({ feuille: sheetName, ligne: index + 1, raison: 'Numéro de valeur manquant', montant });
        continue;
      }
      if (!numero) continue;
      if (!['C', 'T'].includes(mode)) {
        skipped.push({ feuille: sheetName, ligne: index + 1, numero, raison: `Mode de valeur inconnu: ${mode || '(vide)'}`, montant });
        continue;
      }

      const facture = parseDate(row[indexes.facture]);
      const echeance = parseDate(row[indexes.echeance]);
      if (!echeance && !facture) {
        skipped.push({ feuille: sheetName, ligne: index + 1, numero, raison: 'Date invalide' });
        continue;
      }
      const commentaire = clean(row[indexes.commentaire]);
      const observations = [
        commentaire,
        facture ? `Date facture : ${facture.split('-').reverse().join('/')}` : '',
        echeance ? `Échéance : ${echeance.split('-').reverse().join('/')}` : '',
      ].filter(Boolean).join(' | ');

      records.push({
        feuille: sheetName,
        ligne: index + 1,
        date_saisie: echeance || facture,
        date_facture: facture,
        date_echeance: echeance,
        banque: clean(row[indexes.banque]) || 'N/A',
        montant,
        type_valeur: mode === 'T' ? 'LCN' : 'CHQ',
        numero_valeur: numero,
        nom_tire: client,
        relation: client.includes(':') ? 'CDC' : 'CD',
        observations,
        commercial_nom: commercial,
        statut: 'Attente retour du client',
      });
    }
  }
  return { records, skipped };
}

async function ensureCommercial(client, commercialName, map) {
  const key = normalizeName(commercialName);
  if (map.has(key)) return map.get(key);
  const slug = key.replace(/[^a-z0-9]+/g, '.') || 'non.assigne';
  const password = await bcrypt.hash(`${crypto.randomUUID()}-${crypto.randomUUID()}`, 10);
  const result = await client.query(
    `INSERT INTO users (nom, email, mot_de_passe_hash, role, actif)
     VALUES ($1, $2, $3, 'commercial', true)
     ON CONFLICT (email) DO UPDATE SET nom = EXCLUDED.nom
     RETURNING id`,
    [commercialName, `${slug}@gadimat.ma`, password],
  );
  map.set(key, result.rows[0].id);
  return result.rows[0].id;
}

async function main() {
  const filePath = process.argv.find((arg, index) => index > 1 && !arg.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  const replace = process.argv.includes('--replace');
  if (!filePath || !existsSync(filePath)) {
    console.error('Usage: node importExcel.js <fichier.xlsx> [--dry-run]');
    process.exitCode = 1;
    return;
  }

  const { records, skipped: invalidRows } = parseWorkbook(filePath);
  const totals = records.reduce((sum, row) => sum + row.montant, 0);
  console.log(`${records.length} lignes valides, total ${totals.toFixed(2)} MAD, ${invalidRows.length} ligne(s) invalide(s).`);
  invalidRows.forEach((row) => console.log(`! ${row.feuille} ligne ${row.ligne || '-'}: ${row.raison}${row.numero ? ` (N° ${row.numero})` : ''}`));
  const byCommercial = Object.entries(records.reduce((acc, row) => {
    acc[row.commercial_nom] = (acc[row.commercial_nom] || 0) + row.montant;
    return acc;
  }, {}));
  byCommercial.forEach(([name, amount]) => console.log(`- ${name}: ${amount.toFixed(2)} MAD`));
  if (dryRun) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRows = await client.query("SELECT id, nom FROM users WHERE role = 'commercial'");
    for (const user of userRows.rows) {
      if (normalizeName(user.nom) === 'dirct' || (normalizeName(user.nom) === 'direction' && user.email === 'dirct@gadimat.ma')) {
        await client.query("UPDATE users SET nom = 'DIRECTION', email = 'direction@gadimat.ma' WHERE id = $1", [user.id]);
        user.nom = 'DIRECTION';
      }
    }
    const commercialMap = new Map(userRows.rows.map((row) => [normalizeName(row.nom), row.id]));
    let imported = 0;
    let duplicates = 0;

    for (const row of records) {
      const commercialId = await ensureCommercial(client, row.commercial_nom, commercialMap);
      const existing = await client.query(
        `SELECT id FROM dossiers
         WHERE numero_valeur = $1 AND banque = $2 AND montant = $3
           AND nom_tire = $4 AND date_saisie = $5`,
        [row.numero_valeur, row.banque, row.montant, row.nom_tire, row.date_saisie],
      );
      if (existing.rowCount) {
        await client.query(
          `UPDATE dossiers SET date_facture = $1, date_echeance = $2, observations = $3
           WHERE id = $4`,
          [row.date_facture, row.date_echeance, row.observations, existing.rows[0].id],
        );
        duplicates++;
        continue;
      }
      await client.query(
        `INSERT INTO dossiers
          (date_saisie, date_facture, date_echeance, banque, montant, type_valeur,
           numero_valeur, nom_tire, relation, observations, commercial_id, statut)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [row.date_saisie, row.date_facture, row.date_echeance, row.banque, row.montant,
          row.type_valeur, row.numero_valeur, row.nom_tire, row.relation, row.observations,
          commercialId, row.statut],
      );
      imported++;
    }

    let removed = 0;
    let backupPath = null;
    if (replace) {
      const sourceKeys = new Set(records.map(recordKey));
      const databaseRows = await client.query(
        `SELECT d.*, COALESCE(
           (SELECT json_agg(a ORDER BY a.date_action) FROM actions a WHERE a.dossier_id = d.id),
           '[]'::json
         ) AS actions
         FROM dossiers d`,
      );
      const retainedKeys = new Set();
      const obsolete = databaseRows.rows.filter((row) => {
        const key = recordKey(row);
        if (!sourceKeys.has(key) || retainedKeys.has(key)) return true;
        retainedKeys.add(key);
        return false;
      });
      if (obsolete.length) {
        const backupDir = resolve('backups');
        mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = resolve(backupDir, `dossiers-avant-remplacement-${stamp}.json`);
        writeFileSync(backupPath, JSON.stringify({ created_at: new Date().toISOString(), dossiers: obsolete }, null, 2));
        await client.query('DELETE FROM dossiers WHERE id = ANY($1::uuid[])', [obsolete.map((row) => row.id)]);
        removed = obsolete.length;
      }
    }
    await client.query('COMMIT');
    console.log(`Import terminé : ${imported} dossier(s) ajouté(s), ${duplicates} doublon(s) ignoré(s).`);
    if (replace) console.log(`Remplacement : ${removed} ancien(s) dossier(s) supprimé(s).${backupPath ? ` Sauvegarde : ${backupPath}` : ''}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error('Échec de l’import :', error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
