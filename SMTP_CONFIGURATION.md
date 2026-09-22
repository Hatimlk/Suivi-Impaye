# Configuration SMTP Gadimat

Ajouter les variables suivantes dans `.env.local` en local et dans les variables d’environnement Vercel en production :

```env
SMTP_HOST=smtp.gadimat.ma
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=recouvrement@gadimat.ma
SMTP_PASS=mot_de_passe_smtp
SMTP_FROM_EMAIL=recouvrement@gadimat.ma
SMTP_FROM_NAME=GADIMAT - Suivi des impayés
APP_URL=https://adresse-de-l-application.vercel.app
```

- Utiliser `SMTP_SECURE=true` avec le port `465`.
- Utiliser `SMTP_SECURE=false` avec le port `587` (STARTTLS).
- Ne jamais enregistrer le mot de passe SMTP dans Git.

Une notification est envoyée au commercial affecté lorsqu’un autre utilisateur ajoute une action au dossier. L’auteur ne reçoit pas de notification s’il commente son propre dossier. Une panne SMTP ne bloque pas l’enregistrement de l’action.
