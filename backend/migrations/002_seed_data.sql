-- Migration 002: Données initiales
-- Statuts de référence
INSERT INTO statuts_reference (libelle, ordre, couleur) VALUES
    ('Contentieux', 0, '#dc2626'),
    ('Pré-contentieux', 1, '#ea580c'),
    ('A rendre au client', 2, '#d97706'),
    ('A voir avec le commercial', 3, '#ca8a04'),
    ('Attente retour du client', 4, '#65a30d'),
    ('Valeur à représenter', 5, '#16a34a'),
    ('Règlement à recevoir', 6, '#059669'),
    ('Règlement à récupérer', 7, '#0d9488'),
    ('Règlement partiel', 8, '#0891b2'),
    ('Régularisé - OK', 9, '#0284c7'),
    ('Représenté', 10, '#2563eb'),
    ('Sans suite', 11, '#7c3aed'),
    ('Valeur à remplacer', 12, '#9333ea'),
    ('Valeur envoyée à l''encaissement', 13, '#c026d3')
ON CONFLICT DO NOTHING;

-- Relations de référence
INSERT INTO relations_reference (code, libelle) VALUES
    ('CD', 'Client Direct'),
    ('CDC', 'Client de Client')
ON CONFLICT DO NOTHING;

-- Banques de référence (exemple)
INSERT INTO banques_reference (nom) VALUES
    ('BMCE'),
    ('Attijariwafa Bank'),
    ('CIH Bank'),
    ('Banque Populaire'),
    ('Crédit du Maroc'),
    ('BNP Paribas'),
    ('Société Générale'),
    ('AL Barid Bank'),
    ('Arab Bank'),
    ('Autre')
ON CONFLICT DO NOTHING;

-- Utilisateur admin par défaut (mot de passe: admin123)
-- Le hash sera généré par le script seed
