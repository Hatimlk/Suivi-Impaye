import nodemailer from 'nodemailer';
import config from '../config/env.js';

let transporter;

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
  const subject = `[GADIMAT] Nouveau commentaire - ${dossier.nom_tire || dossier.numero_valeur}`;
  const safeContent = escapeHtml(action.contenu).replaceAll('\n', '<br>');

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
      `Type : ${action.type_action}`,
      '',
      action.contenu,
      '',
      `Consulter le dossier : ${dossierUrl}`,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172033">
        <div style="padding:20px 24px;background:#1d4ed8;color:#fff;border-radius:12px 12px 0 0">
          <h2 style="margin:0;font-size:20px">Nouveau commentaire sur un dossier</h2>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
          <p>Bonjour <strong>${escapeHtml(commercial.nom)}</strong>,</p>
          <p><strong>${escapeHtml(auteurNom)}</strong> a ajouté un commentaire sur l’un de vos dossiers.</p>
          <div style="padding:14px 16px;background:#f8fafc;border-radius:8px;margin:18px 0">
            <div><strong>Client :</strong> ${escapeHtml(dossier.nom_tire || '-')}</div>
            <div style="margin-top:6px"><strong>N° valeur :</strong> ${escapeHtml(dossier.numero_valeur || '-')}</div>
            <div style="margin-top:6px"><strong>Type :</strong> ${escapeHtml(action.type_action)}</div>
          </div>
          <div style="padding:16px;border-left:4px solid #2563eb;background:#eff6ff;margin-bottom:22px">${safeContent}</div>
          <a href="${escapeHtml(dossierUrl)}" style="display:inline-block;padding:11px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Consulter le dossier</a>
          <p style="margin-top:24px;color:#64748b;font-size:12px">Notification automatique — Suivi des impayés GADIMAT</p>
        </div>
      </div>`,
  });

  return { sent: true };
}
