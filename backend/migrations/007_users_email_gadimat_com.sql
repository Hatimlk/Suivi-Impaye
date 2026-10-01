-- Migration des comptes applicatifs vers le domaine gadimat.com.
UPDATE users
SET email = REGEXP_REPLACE(email, '@gadimat\.ma$', '@gadimat.com', 'i'),
    date_modification = NOW()
WHERE email ~* '@gadimat\.ma$';
