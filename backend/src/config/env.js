import dotenv from 'dotenv';
dotenv.config();

function requireSecret(name) {
  const value = process.env[name];
  if (!value || value.length < 16) {
    throw new Error(
      `${name} doit etre defini dans l'environnement avec au moins 16 caracteres (aucune valeur par defaut n'est autorisee)`
    );
  }
  return value;
}

export default {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: requireSecret('JWT_SECRET'),
  jwtRefreshSecret: requireSecret('JWT_REFRESH_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  dormantDaysThreshold: 7,
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.SMTP_FROM_NAME || 'GADIMAT - Suivi des impayés',
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
  },
};
