import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/suivi_impaye',
});

const commercialsList = [
  { nom: 'Fahd', email: 'fahd@gadimat.ma' },
  { nom: 'Nabil', email: 'nabil@gadimat.ma' },
  { nom: 'Lahcen', email: 'lahcen@gadimat.ma' },
  { nom: 'Naoufal', email: 'naoufal@gadimat.ma' },
  { nom: 'Faycal', email: 'faycal@gadimat.ma' },
  { nom: 'Rachid', email: 'rachid@gadimat.ma' },
];

const banquesList = ['BMCI', 'BP', 'CAM', 'AWB', 'BMCE', 'Attijariwafa Bank', 'CIH Bank', 'Crédit du Maroc'];

const tableData = [
  {
    date_saisie: '2026-01-08',
    banque: 'BMCI',
    montant: 107479.13,
    type_valeur: 'LCN',
    numero_valeur: '5529',
    nom_tire: 'HAJAR BOIS 107479,13',
    relation: 'CD',
    observations: 'EFFET IMP AU 31/12/25 : HAJAR BOIS',
    commercial_nom: 'Fahd',
    statut: 'Régularisé - OK',
    actions: ['A voir avec FAHD', 'Vir recu 30/04/26']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'BMCI',
    montant: 63312.50,
    type_valeur: 'LCN',
    numero_valeur: 'LCN-2026-02',
    nom_tire: 'COGEMAT (63312,50)',
    relation: 'C',
    observations: 'EFFET IMP AU 22/01/26',
    commercial_nom: 'Nabil',
    statut: 'Régularisé - OK',
    actions: ['Date défini de repres']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'BMCI',
    montant: 5000.00,
    type_valeur: 'LCN',
    numero_valeur: 'LCN-2026-03',
    nom_tire: 'AIT LAASRI IDDER 5000',
    relation: 'C',
    observations: 'EFFET IMP AU 20/01/26 : ID EL OURF LAHCEN',
    commercial_nom: 'Fahd',
    statut: 'Régularisé - OK',
    actions: ['Contre Esp / A recup par fahd depla 18/02/26', 'Esp recup par FAHD 02/04/26']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'BP',
    montant: 0.00,
    type_valeur: 'CHQ',
    numero_valeur: 'CHQ-2026-04',
    nom_tire: 'RACHID IHIHI',
    relation: 'C',
    observations: 'CHEQUE DE BELAADIM AHMAD SIDI BIBI',
    commercial_nom: 'Lahcen',
    statut: 'Régularisé - OK',
    actions: ['esp + chèq / engagement cit refusé par lahcen']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'BP',
    montant: 36115.40,
    type_valeur: 'CHQ',
    numero_valeur: 'CHQ-2026-05',
    nom_tire: 'FREMBAL 36115,40',
    relation: 'C',
    observations: 'CHEQUE DU 20/01/26',
    commercial_nom: 'Fahd',
    statut: 'Régularisé - OK',
    actions: ['Attente virement', 'Cheq a verser 30/03/26']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'CAM',
    montant: 0.00,
    type_valeur: 'CHQ',
    numero_valeur: 'CHQ-2026-06',
    nom_tire: 'STE SORAYASS',
    relation: 'C',
    observations: 'CHEQUE IMP REP LE 20/01/26',
    commercial_nom: 'Naoufal',
    statut: 'Régularisé - OK',
    actions: ['A representer / A recup eff endoss', 'EFF RECU / ENDOSS']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'CAM',
    montant: 0.00,
    type_valeur: 'CHQ',
    numero_valeur: 'CHQ-2026-07',
    nom_tire: 'DHIM MED',
    relation: 'C',
    observations: 'CHEQUE IMP REP LE 20/01/26 : LGRARA KHALID',
    commercial_nom: 'Nabil',
    statut: 'Régularisé - OK',
    actions: ['Contre esp']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'AWB',
    montant: 278239.33,
    type_valeur: 'LCN',
    numero_valeur: 'LCN-2026-08',
    nom_tire: 'BOUKEROUAN (278239,33)',
    relation: 'CD',
    observations: 'EFFET IMP AU 21/01/26',
    commercial_nom: 'Nabil',
    statut: 'Régularisé - OK',
    actions: ['vir recu 100000', 'Vers partiel 80 - 90k / semaine', 'VIR RECU 50 K/ VIR 50 RECU']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'CAM',
    montant: 10000.00,
    type_valeur: 'LCN',
    numero_valeur: 'LCN-2026-09',
    nom_tire: 'RISSAJOR0(10000)',
    relation: 'C',
    observations: 'EFFET IMP AU 20/01/26 : WOOD COM',
    commercial_nom: 'Nabil',
    statut: 'Régularisé - OK',
    actions: ['A rendre au client']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'CAM',
    montant: 43557.00,
    type_valeur: 'LCN',
    numero_valeur: 'LCN-2026-10',
    nom_tire: 'STE MEDIA WOOD43557',
    relation: 'C',
    observations: 'EFFET IMP AU 20/01/26 : BENNASSER ABDELFATTAH',
    commercial_nom: 'Faycal',
    statut: 'Régularisé - OK',
    actions: ['Attente date de representetaion / A repres 19/02/26']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'CAM',
    montant: 40023.68,
    type_valeur: 'LCN',
    numero_valeur: 'LCN-2026-11',
    nom_tire: 'STE AW DECOR40023,68',
    relation: 'C',
    observations: 'EFFET IMP AU 20/01/26',
    commercial_nom: 'Naoufal',
    statut: 'Régularisé - OK',
    actions: ['Vir / a recevoir au cours de la semaine']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'AWB',
    montant: 40000.00,
    type_valeur: 'CHQ',
    numero_valeur: 'CHQ-2026-12',
    nom_tire: 'WAHAB CHAIMAA',
    relation: 'C',
    observations: 'CHEQUE DE TABI BOIS',
    commercial_nom: 'Rachid',
    statut: 'Régularisé - OK',
    actions: []
  },
  {
    date_saisie: '2026-01-26',
    banque: 'AWB',
    montant: 46943.34,
    type_valeur: 'CHQ',
    numero_valeur: 'CHQ-2026-13',
    nom_tire: 'WAHAB CHAIMAA (46943,34)',
    relation: 'C',
    observations: 'CHEQUE DE TABI BOIS',
    commercial_nom: 'Rachid',
    statut: 'Régularisé - OK',
    actions: ['Récup par RACHID']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'AWB',
    montant: 0.00,
    type_valeur: 'CHQ',
    numero_valeur: 'CHQ-2026-14',
    nom_tire: 'STE SORAYASS',
    relation: 'C',
    observations: 'CHEQUE DU 19/01/26',
    commercial_nom: 'Naoufal',
    statut: 'Régularisé - OK',
    actions: ['A representer / A recup eff endoss', 'EFF RECU / ENDOSS']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'BMCE',
    montant: 0.00,
    type_valeur: 'CHQ',
    numero_valeur: 'CHQ-2026-15',
    nom_tire: 'STE SORAYASS',
    relation: 'C',
    observations: 'CHEQUE DU 16/01/26',
    commercial_nom: 'Naoufal',
    statut: 'Régularisé - OK',
    actions: ['A representer / A recup eff endoss', 'EFF RECU / ENDOSS']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'BMCE',
    montant: 20000.00,
    type_valeur: 'LCN',
    numero_valeur: 'LCN-2026-16',
    nom_tire: 'AGORRAM (20000)',
    relation: 'C',
    observations: 'EFFET IMP AU 18/01/26 : EL AIN BOIS',
    commercial_nom: 'Faycal',
    statut: 'Régularisé - OK',
    actions: ['A rendre au client / Contre chèq AIN BOIS/ eff recup par faical le']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'BMCE',
    montant: 64000.00,
    type_valeur: 'LCN',
    numero_valeur: 'LCN-2026-17',
    nom_tire: 'COGEMAT (64000)',
    relation: 'C',
    observations: 'EFFET IMP AU 19/01/26',
    commercial_nom: 'Nabil',
    statut: 'Régularisé - OK',
    actions: ['Date défini de repres']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'BMCE',
    montant: 15400.00,
    type_valeur: 'LCN',
    numero_valeur: 'LCN-2026-18',
    nom_tire: 'RISSAJOR (15400)',
    relation: 'C',
    observations: 'EFFET IMP AU 17/01/26 : WOOD COM',
    commercial_nom: 'Nabil',
    statut: 'Régularisé - OK',
    actions: ['A rendre au client']
  },
  {
    date_saisie: '2026-01-26',
    banque: 'BMCE',
    montant: 107094.89,
    type_valeur: 'CHQ',
    numero_valeur: 'CHQ-2026-19',
    nom_tire: 'STE DISAMA (107094.89)',
    relation: 'C',
    observations: 'CHEQUE DE AMAZAL MED',
    commercial_nom: 'Lahcen',
    statut: 'Régularisé - OK',
    actions: ['Vir recu 50000/ vir 20 k 16/02/']
  }
];

async function seedData() {
  const client = await pool.connect();
  try {
    console.log('--- Nettoyage préalable des dossiers de test ---');
    await client.query('DELETE FROM actions');
    await client.query('DELETE FROM dossiers');

    console.log('--- Insertion des banques de référence ---');
    for (const bq of banquesList) {
      await client.query(
        'INSERT INTO banques_reference (nom) VALUES ($1) ON CONFLICT (nom) DO NOTHING',
        [bq]
      );
    }

    console.log('--- Insertion / Mise à jour des commerciaux ---');
    const defaultPasswordHash = await bcrypt.hash('commercial123', 10);
    const commerciauxMap = {};

    for (const com of commercialsList) {
      const res = await client.query(
        `INSERT INTO users (nom, email, mot_de_passe_hash, role, actif)
         VALUES ($1, $2, $3, 'commercial', true)
         ON CONFLICT (email) DO UPDATE SET nom = EXCLUDED.nom
         RETURNING id, nom`,
        [com.nom, com.email, defaultPasswordHash]
      );
      commerciauxMap[com.nom.toLowerCase()] = res.rows[0].id;
    }

    console.log('--- Insertion des 19 dossiers exacts du tableau ---');
    let count = 0;

    for (const row of tableData) {
      const commId = commerciauxMap[row.commercial_nom.toLowerCase()] || null;

      const res = await client.query(
        `INSERT INTO dossiers (date_saisie, banque, montant, type_valeur, numero_valeur, nom_tire, relation, observations, commercial_id, statut)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          row.date_saisie,
          row.banque,
          row.montant,
          row.type_valeur,
          row.numero_valeur,
          row.nom_tire,
          row.relation,
          row.observations,
          commId,
          row.statut
        ]
      );
      const dossierId = res.rows[0].id;
      count++;

      // Inserer les actions associees
      for (const act of row.actions) {
        await client.query(
          `INSERT INTO actions (dossier_id, auteur_id, contenu, type_action, date_action)
           VALUES ($1, $2, $3, 'import', NOW())`,
          [dossierId, commId, act]
        );
      }

      if (row.actions.length > 0) {
        await client.query(
          `UPDATE dossiers SET date_derniere_action = NOW() WHERE id = $1`,
          [dossierId]
        );
      }
    }

    console.log(`\nSuccès total! Exactement ${count} dossiers et toutes leurs actions ont été insérés en base de données.`);
  } catch (err) {
    console.error('Erreur lors du remplissage des données:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedData();
