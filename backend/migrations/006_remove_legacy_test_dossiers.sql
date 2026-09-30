-- Suppression definitive des anciens dossiers de test.
-- Les actions associees sont supprimees par ON DELETE CASCADE.
-- Les utilisateurs, l'authentification, les references et les audits sont conserves.
DELETE FROM dossiers;
