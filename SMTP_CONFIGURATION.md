# Configuration SMTP Gadimat

Ajouter les variables suivantes dans `.env.local` en local et dans les variables d’environnement Vercel en production :

```env
SMTP_HOST=mail.infomaniak.com
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
- Ne jamais enregistrer le mot de passe SMTP réel dans Git.

Une notification est envoyée au commercial affecté chaque fois qu’un utilisateur ajoute une action au dossier, y compris lorsque le commercial commente son propre dossier. Une panne SMTP ne bloque pas l’enregistrement de l’action.

Lorsqu’une action possède une date limite et que cette date est dépassée, PROGAD envoie automatiquement un seul e-mail de rappel à l’utilisateur qui a créé l’action. Le contrôle est exécuté quotidiennement par une tâche Vercel sécurisée avec `CRON_SECRET`. En cas d’échec SMTP, l’envoi sera retenté lors d’une prochaine exécution.
