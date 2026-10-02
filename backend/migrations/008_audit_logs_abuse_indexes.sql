-- Migration 008: Index pour la detection d'abus (rate limiting par compte)

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date_action ON audit_logs(date_action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_details_email ON audit_logs((details_json->>'email'));
