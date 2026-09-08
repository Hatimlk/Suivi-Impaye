ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS date_facture DATE,
  ADD COLUMN IF NOT EXISTS date_echeance DATE;

CREATE INDEX IF NOT EXISTS idx_dossiers_date_facture ON dossiers(date_facture);
CREATE INDEX IF NOT EXISTS idx_dossiers_date_echeance ON dossiers(date_echeance);
