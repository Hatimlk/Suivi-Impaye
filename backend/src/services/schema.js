import { query } from '../config/db.js';

let porteurMigrationPromise;
let partenairesMigrationPromise;
let erpTrackingMigrationPromise;

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

export function ensureErpTrackingTables() {
  if (!erpTrackingMigrationPromise) {
    erpTrackingMigrationPromise = query(`
      CREATE TABLE IF NOT EXISTS erp_impayes_snapshot (
        erp_voucher_id INTEGER PRIMARY KEY,
        date_saisie DATE,
        date_facture DATE,
        date_echeance DATE,
        montant NUMERIC(15, 2) NOT NULL DEFAULT 0,
        type_valeur VARCHAR(10) NOT NULL,
        numero_valeur VARCHAR(255) NOT NULL,
        nom_tire VARCHAR(255) NOT NULL,
        porteur VARCHAR(255) NOT NULL DEFAULT '',
        relation VARCHAR(10) NOT NULL DEFAULT 'CD',
        banque VARCHAR(255) NOT NULL DEFAULT 'Non renseignee',
        erp_partner_id INTEGER,
        erp_commercial_nom VARCHAR(255),
        actif BOOLEAN NOT NULL DEFAULT true,
        synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_erp_snapshot_actif ON erp_impayes_snapshot(actif);
      CREATE INDEX IF NOT EXISTS idx_erp_snapshot_client ON erp_impayes_snapshot(nom_tire);
      CREATE INDEX IF NOT EXISTS idx_erp_snapshot_date ON erp_impayes_snapshot(date_saisie);

      CREATE TABLE IF NOT EXISTS erp_sync_runs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(30) NOT NULL DEFAULT 'running',
        received_count INTEGER NOT NULL DEFAULT 0,
        details JSONB NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS application_migrations (
        migration_key VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM application_migrations
          WHERE migration_key = '006_remove_legacy_test_dossiers'
        ) THEN
          DELETE FROM dossiers;
          INSERT INTO application_migrations (migration_key)
          VALUES ('006_remove_legacy_test_dossiers');
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS erp_dossier_suivi (
        erp_voucher_id INTEGER PRIMARY KEY,
        statut VARCHAR(255) NOT NULL DEFAULT 'Attente retour du client',
        observations TEXT NOT NULL DEFAULT '',
        commercial_id UUID REFERENCES users(id) ON DELETE SET NULL,
        date_derniere_action TIMESTAMP WITH TIME ZONE,
        date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        date_derniere_modification TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS erp_actions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        erp_voucher_id INTEGER NOT NULL,
        auteur_id UUID REFERENCES users(id) ON DELETE SET NULL,
        contenu TEXT NOT NULL,
        type_action VARCHAR(100) DEFAULT 'relance',
        date_action TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_erp_actions_voucher ON erp_actions(erp_voucher_id);
      CREATE INDEX IF NOT EXISTS idx_erp_suivi_commercial ON erp_dossier_suivi(commercial_id);
    `).catch((error) => {
      erpTrackingMigrationPromise = undefined;
      throw error;
    });
  }
  return erpTrackingMigrationPromise;
}
