-- Migration 001: Création du schéma initial
-- Suivi des Impayés - Schéma PostgreSQL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des rôles de référence
CREATE TYPE user_role AS ENUM ('admin', 'responsable_recouvrement', 'commercial', 'lecture_seule');

-- Table des types de valeur
CREATE TYPE type_valeur_enum AS ENUM ('CHQ', 'LCN');

-- Table des relations
CREATE TYPE relation_enum AS ENUM ('CD', 'CDC');

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'commercial',
    actif BOOLEAN NOT NULL DEFAULT true,
    date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    date_modification TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_actif ON users(actif);

-- ============================================================
-- TABLE: banques_reference
-- ============================================================
CREATE TABLE banques_reference (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) NOT NULL UNIQUE,
    actif BOOLEAN NOT NULL DEFAULT true,
    date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: statuts_reference
-- ============================================================
CREATE TABLE statuts_reference (
    id SERIAL PRIMARY KEY,
    libelle VARCHAR(255) NOT NULL UNIQUE,
    ordre INTEGER NOT NULL DEFAULT 0,
    couleur VARCHAR(7) DEFAULT '#6b7280',
    actif BOOLEAN NOT NULL DEFAULT true,
    date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: relations_reference
-- ============================================================
CREATE TABLE relations_reference (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    libelle VARCHAR(255) NOT NULL,
    actif BOOLEAN NOT NULL DEFAULT true,
    date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: dossiers
-- ============================================================
CREATE TABLE dossiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date_saisie DATE NOT NULL DEFAULT CURRENT_DATE,
    banque VARCHAR(255) NOT NULL,
    montant NUMERIC(15, 2) NOT NULL DEFAULT 0,
    type_valeur type_valeur_enum NOT NULL DEFAULT 'CHQ',
    numero_valeur VARCHAR(100) NOT NULL,
    nom_tire VARCHAR(255) NOT NULL,
    relation relation_enum NOT NULL DEFAULT 'C',
    observations TEXT DEFAULT '',
    commercial_id UUID REFERENCES users(id) ON DELETE SET NULL,
    statut VARCHAR(255) NOT NULL DEFAULT 'Attente retour du client',
    date_derniere_action TIMESTAMP WITH TIME ZONE,
    date_cloture TIMESTAMP WITH TIME ZONE,
    date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    date_derniere_modification TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dossiers_commercial ON dossiers(commercial_id);
CREATE INDEX idx_dossiers_statut ON dossiers(statut);
CREATE INDEX idx_dossiers_banque ON dossiers(banque);
CREATE INDEX idx_dossiers_date_saisie ON dossiers(date_saisie);
CREATE INDEX idx_dossiers_type_valeur ON dossiers(type_valeur);
CREATE INDEX idx_dossiers_date_derniere_action ON dossiers(date_derniere_action);
CREATE INDEX idx_dossiers_numero_valeur ON dossiers(numero_valeur);

-- ============================================================
-- TABLE: actions
-- ============================================================
CREATE TABLE actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    date_action TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    auteur_id UUID REFERENCES users(id) ON DELETE SET NULL,
    contenu TEXT NOT NULL,
    type_action VARCHAR(100) DEFAULT 'relance',
    date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_actions_dossier ON actions(dossier_id);
CREATE INDEX idx_actions_auteur ON actions(auteur_id);
CREATE INDEX idx_actions_date_action ON actions(date_action);

-- ============================================================
-- TABLE: refresh_tokens (pour le refresh JWT)
-- ============================================================
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id UUID REFERENCES users(id) ON DELETE SET NULL,
    dossier_id UUID REFERENCES dossiers(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    details_json JSONB DEFAULT '{}',
    date_action TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_utilisateur ON audit_logs(utilisateur_id);
CREATE INDEX idx_audit_logs_dossier ON audit_logs(dossier_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_date_action ON audit_logs(date_action);
