import { query } from '../config/db.js';

let porteurMigrationPromise;

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
