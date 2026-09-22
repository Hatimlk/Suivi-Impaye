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
