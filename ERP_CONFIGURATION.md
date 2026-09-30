# Connexion OpenPROD en lecture seule

L'application utilise deux connexions PostgreSQL distinctes :

- `DATABASE_URL` : base interne de Suivi Impaye (utilisateurs, dossiers, historique) ;
- `ERP_DB_*` : base OpenPROD de Kazacube, uniquement pour lire les donnees autorisees.

## Parametres a renseigner

Configurer ces variables dans l'environnement du backend ou dans Vercel :

```env
ERP_DB_HOST=ges.gadimat.com
ERP_DB_PORT=5432
ERP_DB_NAME=GADIMAT_PROD_02
ERP_DB_USER=consult_data
ERP_DB_PASSWORD=<fourni-par-kazacube>
```

Ne jamais enregistrer le mot de passe dans Git. Le serveur qui execute le backend doit sortir avec
l'adresse IP publique autorisee `102.50.250.180`; l'ordinateur d'un utilisateur n'accede jamais
directement a OpenPROD.

La connexion impose la validation du certificat TLS, un delai maximal de requete de 15 secondes et
le mode lecture seule au niveau de chaque session, en plus des droits read-only accordes par Kazacube.

## Verification

Une fois les deux secrets renseignes, un administrateur connecte peut appeler :

```text
GET /api/admin/erp/status
```

La reponse doit indiquer `status: connected` et `readOnly: true`.

## Perimetre autorise

Le compte a uniquement le droit de lecture sur :

- `res_partner` ;
- `account_invoice` ;
- `account_invoice_line` ;
- `account_voucher` ;
- `account_voucher_line`.

Il peut se connecter aux bases `GADIMAT_PROD_02` et `GADIMAT_TEST_06_07_2026`. La production est
la source configuree par defaut dans l'application.

## Etape suivante

Analyser les colonnes et les cles de liaison de ces cinq tables, puis valider les regles fonctionnelles
permettant de calculer les encours et les impayes avant d'activer la synchronisation automatique.
