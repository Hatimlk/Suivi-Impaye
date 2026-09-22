ALTER TABLE dossiers
ADD COLUMN IF NOT EXISTS porteur VARCHAR(255) DEFAULT '';

-- Initialiser le porteur des dossiers CDC existants à partir de l'ancien
-- format "Partenaire : Porteur". Les modifications futures sont indépendantes.
UPDATE dossiers
SET porteur = BTRIM(SUBSTRING(nom_tire FROM POSITION(':' IN nom_tire) + 1))
WHERE relation = 'CDC'
  AND COALESCE(porteur, '') = ''
  AND POSITION(':' IN nom_tire) > 0;
