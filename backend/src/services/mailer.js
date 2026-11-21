import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import config from '../config/env.js';

let transporter;
const logoPath = fileURLToPath(new URL('../../../Assets/Asset 6@4x.png', import.meta.url));

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function logoAttachments() {
  return [{ filename: 'progad.png', path: logoPath, cid: 'progad-logo' }];
}

function formatAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('fr-FR');
}

function actionLabel(value) {
  const labels = { commentaire: 'Commentaire', relance: 'Relance', derogation: 'Dérogation' };
  return labels[value] || String(value || 'Commentaire');
}

function detailsTable(rows) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      ${rows.map(([label, value], index) => `
        <tr>
          <td style="padding:11px 14px;width:38%;font-size:12px;line-height:18px;color:#64748b;${index ? 'border-top:1px solid #e2e8f0;' : ''}">${escapeHtml(label)}</td>
          <td style="padding:11px 14px;font-size:13px;line-height:18px;color:#0f172a;font-weight:600;text-align:right;${index ? 'border-top:1px solid #e2e8f0;' : ''}">${escapeHtml(value)}</td>
        </tr>`).join('')}
    </table>`;
}

function emailLayout({ preheader, eyebrow, title, intro, content, buttonUrl, buttonLabel, tone = '#2454d8', footer }) {
  const safeUrl = buttonUrl ? escapeHtml(buttonUrl) : '';
  return `<!doctype html>
  <html lang="fr">
    <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f3f6fb">
        <tr>
          <td align="center" style="padding:32px 12px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dfe5ee;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.06)">
              <tr>
                <td style="padding:24px 30px;background:#ffffff;border-bottom:1px solid #edf1f6">
                  <img src="cid:progad-logo" width="180" alt="PROGAD" style="display:block;width:180px;max-width:55%;height:auto;border:0">
                </td>
              </tr>
              <tr><td style="height:5px;background:${tone};font-size:0;line-height:0">&nbsp;</td></tr>
              <tr>
                <td style="padding:34px 30px 30px">
                  <p style="margin:0 0 10px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${tone}">${escapeHtml(eyebrow)}</p>
                  <h1 style="margin:0 0 14px;font-size:26px;line-height:34px;color:#0f172a;font-weight:750">${escapeHtml(title)}</h1>
                  <div style="margin:0 0 24px;font-size:14px;line-height:23px;color:#475569">${intro}</div>
                  ${content}
                  ${buttonUrl ? `
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px">
                      <tr><td style="border-radius:9px;background:${tone}">
                        <a href="${safeUrl}" style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;line-height:18px">${escapeHtml(buttonLabel)}</a>
                      </td></tr>
                    </table>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding:20px 30px;background:#f8fafc;border-top:1px solid #edf1f6;font-size:11px;line-height:18px;color:#64748b">
                  ${footer || 'Message automatique envoyé par PROGAD — Suivi des impayés.'}<br>
                  Merci de ne pas répondre directement à cet e-mail.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function getTransporter() {
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass || !config.smtp.fromEmail) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  return transporter;
}

export async function sendCommercialActionNotification({ commercial, dossier, action, auteurNom }) {
  const smtp = getTransporter();
  if (!smtp) {
    console.warn('Notification email ignorée : configuration SMTP incomplète');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const dossierUrl = `${config.appUrl.replace(/\/$/, '')}/dossiers/${dossier.id}`;
  const subject = `[PROGAD] Nouveau commentaire - ${dossier.nom_tire || dossier.numero_valeur}`;
  const safeContent = escapeHtml(action.contenu).replaceAll('\n', '<br>');
  const details = detailsTable([
    ['Partenaire', dossier.nom_tire || '-'],
    ['N° de valeur', dossier.numero_valeur || '-'],
    ['Banque', dossier.banque || '-'],
    ['Type de valeur', dossier.type_valeur || '-'],
    ['Total', formatAmount(dossier.total ?? dossier.montant)],
    ['Solde impayé', formatAmount(dossier.montant)],
    ['Échéance', formatDate(dossier.date_echeance)],
    ['Statut', dossier.statut || '-'],
    ['Type d\'action', actionLabel(action.type_action)],
    ['Ajouté par', auteurNom || 'Un utilisateur'],
  ]);

  await smtp.sendMail({
    from: `"${config.smtp.fromName.replaceAll('"', '')}" <${config.smtp.fromEmail}>`,
    to: commercial.email,
    subject,
    text: [
      `Bonjour ${commercial.nom},`,
      '',
      `${auteurNom} a ajouté un commentaire sur l'un de vos dossiers.`,
      `Client : ${dossier.nom_tire || '-'}`,
      `N° valeur : ${dossier.numero_valeur || '-'}`,
      `Banque : ${dossier.banque || '-'}`,
      `Type de valeur : ${dossier.type_valeur || '-'}`,
      `Total : ${formatAmount(dossier.total ?? dossier.montant)}`,
      `Solde impayé : ${formatAmount(dossier.montant)}`,
      `Échéance : ${formatDate(dossier.date_echeance)}`,
      `Statut : ${dossier.statut || '-'}`,
      `Type d'action : ${actionLabel(action.type_action)}`,
      '',
      action.contenu,
      '',
      `Consulter le dossier : ${dossierUrl}`,
    ].join('\n'),
    html: emailLayout({
      preheader: `${auteurNom} a ajouté un commentaire au dossier ${dossier.numero_valeur || ''}`,
      eyebrow: 'Mise à jour dossier',
      title: 'Nouveau commentaire',
      intro: `Bonjour <strong style="color:#0f172a">${escapeHtml(commercial.nom)}</strong>,<br><strong style="color:#0f172a">${escapeHtml(auteurNom)}</strong> a ajouté un commentaire sur un dossier qui vous est affecté.`,
      content: `${details}
        <div style="margin-top:20px;padding:16px 18px;border-left:4px solid #2454d8;background:#eef4ff;border-radius:0 10px 10px 0">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#2454d8">Commentaire</p>
          <div style="font-size:14px;line-height:22px;color:#1e293b">${safeContent}</div>
        </div>`,
      buttonUrl: dossierUrl,
      buttonLabel: 'Ouvrir le dossier',
    }),
    attachments: logoAttachments(),
  });

  return { sent: true };
}

export async function sendSmtpTestEmail({ to, nom }) {
  const smtp = getTransporter();
  if (!smtp) {
    const error = new Error('Configuration SMTP incomplète');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  await smtp.verify();
  const testedAt = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' });
  const securityMode = config.smtp.secure ? 'SSL/TLS direct' : 'STARTTLS';
  const testDetails = detailsTable([
    ['Serveur SMTP', config.smtp.host],
    ['Port', String(config.smtp.port)],
    ['Sécurité', securityMode],
    ['Compte SMTP', config.smtp.user],
    ['Adresse d\'expédition', config.smtp.fromEmail],
    ['Destinataire du test', to],
    ['Vérifié le', `${testedAt} (Casablanca)`],
  ]);
  await smtp.sendMail({
    from: `"${config.smtp.fromName.replaceAll('"', '')}" <${config.smtp.fromEmail}>`,
    to,
    subject: '[PROGAD] Test de configuration SMTP',
    text: [
      `Bonjour ${nom || ''},`,
      '',
      'Le test SMTP PROGAD a réussi. Le serveur est joignable, les identifiants ont été acceptés et l\'envoi fonctionne.',
      `Serveur : ${config.smtp.host}`,
      `Port : ${config.smtp.port}`,
      `Sécurité : ${securityMode}`,
      `Expéditeur : ${config.smtp.fromEmail}`,
      `Destinataire : ${to}`,
      `Vérifié le : ${testedAt} (Casablanca)`,
    ].join('\n'),
    html: emailLayout({
      preheader: 'La configuration SMTP de PROGAD fonctionne correctement.',
      eyebrow: 'Diagnostic messagerie',
      title: 'Test SMTP réussi',
      intro: `Bonjour <strong style="color:#0f172a">${escapeHtml(nom || '')}</strong>,<br>Le serveur est joignable, les identifiants ont été acceptés et PROGAD peut envoyer ses notifications.`,
      content: `${testDetails}
        <div style="margin-top:20px;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;font-size:13px;line-height:20px;color:#166534">
          <strong>Configuration opérationnelle.</strong> Aucun mot de passe n'est affiché dans ce message.
        </div>`,
      tone: '#0f9f6e',
      footer: 'E-mail de diagnostic automatique envoyé par PROGAD — Suivi des impayés.',
    }),
    attachments: logoAttachments(),
  });

  return { sent: true, to };
}

export async function sendActionDeadlineReminder({ user, dossier, action }) {
  const smtp = getTransporter();
  if (!smtp) {
    const error = new Error('Configuration SMTP incomplète');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const dossierUrl = `${config.appUrl.replace(/\/$/, '')}/dossiers/erp-${dossier.erp_voucher_id}`;
  const deadline = new Date(`${action.date_rappel}T12:00:00Z`).toLocaleDateString('fr-FR');
  const safeContent = escapeHtml(action.contenu).replaceAll('\n', '<br>');
  const details = detailsTable([
    ['Partenaire', dossier.nom_tire || '-'],
    ['N° de valeur', dossier.numero_valeur || '-'],
    ['Banque', dossier.banque || '-'],
    ['Type de valeur', dossier.type_valeur || '-'],
    ['Total', formatAmount(dossier.total ?? dossier.montant)],
    ['Solde impayé', formatAmount(dossier.montant)],
    ['Échéance dossier', formatDate(dossier.date_echeance)],
    ['Date limite de l\'action', deadline],
    ['Type d\'action', actionLabel(action.type_action)],
  ]);

  await smtp.sendMail({
    from: `"${config.smtp.fromName.replaceAll('"', '')}" <${config.smtp.fromEmail}>`,
    to: user.email,
    subject: `[PROGAD] Date limite dépassée - ${dossier.nom_tire || dossier.numero_valeur}`,
    text: [
      `Bonjour ${user.nom},`,
      '',
      `La date limite du ${deadline} est dépassée pour l'action suivante :`,
      `Client : ${dossier.nom_tire || '-'}`,
      `N° valeur : ${dossier.numero_valeur || '-'}`,
      `Banque : ${dossier.banque || '-'}`,
      `Total : ${formatAmount(dossier.total ?? dossier.montant)}`,
      `Solde impayé : ${formatAmount(dossier.montant)}`,
      `Type d'action : ${actionLabel(action.type_action)}`,
      '',
      action.contenu,
      '',
      `Consulter le dossier : ${dossierUrl}`,
    ].join('\n'),
    html: emailLayout({
      preheader: `La date limite du ${deadline} est dépassée pour une action PROGAD.`,
      eyebrow: 'Rappel prioritaire',
      title: 'Date limite dépassée',
      intro: `Bonjour <strong style="color:#0f172a">${escapeHtml(user.nom)}</strong>,<br>La date limite du <strong style="color:#b91c1c">${escapeHtml(deadline)}</strong> est dépassée. Consultez le dossier et mettez à jour le suivi.`,
      content: `${details}
        <div style="margin-top:20px;padding:16px 18px;border-left:4px solid #dc2626;background:#fef2f2;border-radius:0 10px 10px 0">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#b91c1c">Action à traiter</p>
          <div style="font-size:14px;line-height:22px;color:#1e293b">${safeContent}</div>
        </div>`,
      buttonUrl: dossierUrl,
      buttonLabel: 'Consulter et mettre à jour',
      tone: '#dc2626',
      footer: 'Rappel automatique envoyé par PROGAD — Suivi des impayés.',
    }),
    attachments: logoAttachments(),
  });

  return { sent: true, to: user.email };
}
