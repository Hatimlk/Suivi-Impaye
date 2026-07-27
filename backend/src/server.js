import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import config from './config/env.js';
import authRoutes from './routes/auth.js';
import dossierRoutes from './routes/dossiers.js';
import adminRoutes from './routes/admin.js';
import exportRoutes from './routes/export.js';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Trop de requetes, veuillez reessayer plus tard' },
});
app.use('/api/', limiter);

// Login rate limit
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Trop de tentatives de connexion' },
});
app.use('/api/auth/login', loginLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dossiers', dossierRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvee' });
});

// Error handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Fichier trop volumineux (max 10 Mo)' });
  }
  if (err.message && err.message.includes('Fichier Excel')) {
    return res.status(400).json({ error: err.message });
  }
  console.error('Erreur non geree:', err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`Serveur demarre sur le port ${config.port}`);
  });
}

export default app;
