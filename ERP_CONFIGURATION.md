# Connexion OpenPROD en lecture seule

L'application utilise deux connexions PostgreSQL distinctes :

- `DATABASE_URL` : base interne de Suivi Impaye (utilisateurs, dossiers, historique) ;
- `ERP_DB_*` : base OpenPROD de Kazacube, uniquement pour lire les donnees autorisees.

## Parametres a renseigner

Configurer ces variables dans l'environnement du backend ou dans Vercel :

```env
ERP_DB_HOST=<fourni-par-kazacube>
ERP_DB_PORT=5432
ERP_DB_NAME=<fourni-par-kazacube>
ERP_DB_USER=<fourni-par-kazacube>
ERP_DB_PASSWORD=<fourni-par-kazacube>
```

Ne jamais enregistrer ces valeurs (hote, utilisateur, mot de passe) dans Git — y compris dans ce
fichier. Le serveur qui execute le backend doit sortir avec l'adresse IP publique autorisee par
Kazacube (voir le gestionnaire de secrets de l'equipe); l'ordinateur d'un utilisateur n'accede jamais
directement a OpenPROD.

La connexion impose la validation du certificat TLS, un delai maximal de requete de 15 secondes et
le mode lecture seule au niveau de chaque session, en plus des droits read-only accordes par Kazacube.

## Verification

Une fois les deux secrets renseignes, un administrateur connecte peut appeler :

```text
GET /api/admin/erp/status
```

La reponse doit indiquer `status: connected` et `readOnly: true`.

## Synchronisation vers l'application hebergee

Le backend Vercel ne peut pas joindre directement PostgreSQL, car seule l'adresse IP publique de la
machine G5 est autorisee par Kazacube (voir le gestionnaire de secrets de l'equipe). Le script suivant
doit donc etre execute depuis cette connexion :

```text
npm --prefix backend run sync-erp
```

`ERP_SYNC_SECRET` doit avoir exactement la meme valeur sur la machine G5 et dans les variables
d'environnement Vercel. Le script transmet uniquement les impayes actifs necessaires a l'application.

## Perimetre autorise

Le compte a uniquement le droit de lecture sur :

- `res_partner` ;
- `account_invoice` ;
- `account_invoice_line` ;
- `account_voucher` ;
- `account_voucher_line`.

Il peut se connecter a la base de production et a une base de test dediees (noms fournis par
Kazacube). La production est la source configuree par defaut dans l'application.

## Etape suivante

Analyser les colonnes et les cles de liaison de ces cinq tables, puis valider les regles fonctionnelles
permettant de calculer les encours et les impayes avant d'activer la synchronisation automatique.
