import { query } from '../config/db.js';

let porteurMigrationPromise;
let partenairesMigrationPromise;

/**
 * Migration légère et idempotente pour les environnements serverless où le
 * script de migration n'est pas nécessairement exécuté avant le déploiement.
 */
export function ensurePorteurColumn() {
  if (!porteurMigrationPromise) {
    porteurMigrationPromise = query(`
      ALTER TABLE dossiers
      ADD COLUMN IF NOT EXISTS porteur VARCHAR(255) DEFAULT '';

      UPDATE dossiers
      SET porteur = BTRIM(SUBSTRING(nom_tire FROM POSITION(':' IN nom_tire) + 1))
      WHERE relation = 'CDC'
        AND COALESCE(porteur, '') = ''
        AND POSITION(':' IN nom_tire) > 0;
    `).catch((error) => {
      // Autoriser une nouvelle tentative lors de la prochaine requête.
      porteurMigrationPromise = undefined;
      throw error;
    });
  }

  return porteurMigrationPromise;
}

export function ensurePartenairesTable() {
  if (!partenairesMigrationPromise) {
    partenairesMigrationPromise = query(`
      CREATE TABLE IF NOT EXISTS partenaires_reference (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(255) NOT NULL UNIQUE,
        actif BOOLEAN NOT NULL DEFAULT true,
        date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      INSERT INTO partenaires_reference (nom)
      SELECT DISTINCT CASE
        WHEN relation = 'CDC' AND POSITION(':' IN nom_tire) > 0
          THEN BTRIM(SPLIT_PART(nom_tire, ':', 1))
        ELSE BTRIM(nom_tire)
      END
      FROM dossiers
      WHERE nom_tire IS NOT NULL AND BTRIM(nom_tire) <> ''
      ON CONFLICT (nom) DO NOTHING;
    `).catch((error) => {
      partenairesMigrationPromise = undefined;
      throw error;
    });
  }
  return partenairesMigrationPromise;
}
