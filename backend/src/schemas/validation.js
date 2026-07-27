import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const createUserSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(255),
  email: z.string().email('Email invalide'),
  mot_de_passe: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  role: z.enum(['admin', 'responsable_recouvrement', 'commercial', 'lecture_seule']),
  actif: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  nom: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  mot_de_passe: z.string().min(6).optional(),
  role: z.enum(['admin', 'responsable_recouvrement', 'commercial', 'lecture_seule']).optional(),
  actif: z.boolean().optional(),
});

export const createDossierSchema = z.object({
  date_saisie: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date requis: YYYY-MM-DD').optional(),
  banque: z.string().min(1, 'Banque requise'),
  montant: z.number().min(0, 'Le montant doit être positif'),
  type_valeur: z.enum(['CHQ', 'LCN']),
  numero_valeur: z.string().min(1, 'Numéro de valeur requis'),
  nom_tire: z.string().min(1, 'Nom du tiré requis'),
  relation: z.enum(['CD', 'CDC']),
  observations: z.string().optional().default(''),
  commercial_id: z.string().uuid().nullable().optional(),
  statut: z.string().optional().default('Attente retour du client'),
});

export const updateDossierSchema = z.object({
  date_saisie: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  banque: z.string().min(1).optional(),
  montant: z.number().min(0).optional(),
  type_valeur: z.enum(['CHQ', 'LCN']).optional(),
  numero_valeur: z.string().min(1).optional(),
  nom_tire: z.string().min(1).optional(),
  relation: z.enum(['CD', 'CDC']).optional(),
  observations: z.string().optional(),
  commercial_id: z.string().uuid().nullable().optional(),
  statut: z.string().optional(),
});

export const createActionSchema = z.object({
  contenu: z.string().min(1, 'Le contenu de l\'action est requis'),
  type_action: z.string().optional().default('relance'),
});

export const createBanqueSchema = z.object({
  nom: z.string().min(1, 'Nom de la banque requis'),
});

export const createStatutSchema = z.object({
  libelle: z.string().min(1, 'Libellé requis'),
  ordre: z.number().int().optional().default(0),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale requise').optional().default('#6b7280'),
});

export const createRelationSchema = z.object({
  code: z.string().min(1).max(10),
  libelle: z.string().min(1),
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ error: 'Données invalides', details: errors });
    }
    req.validated = result.data;
    next();
  };
}
