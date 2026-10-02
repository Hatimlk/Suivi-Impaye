# Configuration SMTP Gadimat

Ajouter les variables suivantes dans `.env.local` en local et dans les variables d’environnement Vercel en production :

```env
SMTP_HOST=<hote-smtp-fourni-par-votre-hebergeur>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<adresse-expediteur>
SMTP_PASS=<mot-de-passe-smtp>
SMTP_FROM_EMAIL=<adresse-expediteur>
SMTP_FROM_NAME=GADIMAT - Suivi des impayés
APP_URL=https://adresse-de-l-application.vercel.app
```

- Utiliser `SMTP_SECURE=true` avec le port `465`.
- Utiliser `SMTP_SECURE=false` avec le port `587` (STARTTLS).
- Ne jamais enregistrer l'hote, l'adresse d'expedition ou le mot de passe SMTP reels dans Git — y
  compris dans ce fichier.

Une notification est envoyée au commercial affecté lorsqu’un autre utilisateur ajoute une action au dossier. L’auteur ne reçoit pas de notification s’il commente son propre dossier. Une panne SMTP ne bloque pas l’enregistrement de l’action.
