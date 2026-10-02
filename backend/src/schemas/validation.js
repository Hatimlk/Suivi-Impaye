import { z } from 'zod';

const emailField = z.string().email('Email invalide').transform((v) => v.trim().toLowerCase());

// Les query params arrivent toujours en string ; un filtre non renseigné par le frontend
// est envoyé comme chaîne vide plutôt qu'absent, donc on la traite comme "non fournie".
const emptyToUndefined = (v) => (v === '' || v === undefined || v === null ? undefined : v);
const optionalTrimmedString = (max = 255) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const optionalNumber = (opts = {}) =>
  z.preprocess(emptyToUndefined, z.coerce.number(opts).optional());
const optionalDateString = () =>
  z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date requis: YYYY-MM-DD').optional());
const optionalUuid = () =>
  z.preprocess(emptyToUndefined, z.string().uuid('Identifiant invalide').optional());
const pageParam = z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional().default(1));
const limitParam = (max = 100, def = 20) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(max).optional().default(def));

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Mot de passe requis'),
});

export const createUserSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(255),
  email: emailField,
  mot_de_passe: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  role: z.enum(['admin', 'responsable_recouvrement', 'commercial', 'lecture_seule']),
  actif: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  nom: z.string().min(1).max(255).optional(),
  email: emailField.optional(),
  mot_de_passe: z.string().min(8).optional(),
  role: z.enum(['admin', 'responsable_recouvrement', 'commercial', 'lecture_seule']).optional(),
  actif: z.boolean().optional(),
});

export const createDossierSchema = z.object({
  date_saisie: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date requis: YYYY-MM-DD').optional(),
  date_facture: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date requis: YYYY-MM-DD').nullable().optional(),
  date_echeance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date requis: YYYY-MM-DD').nullable().optional(),
  banque: z.string().min(1, 'Banque requise').max(255),
  montant: z.number().min(0, 'Le montant doit être positif').max(1_000_000_000),
  type_valeur: z.enum(['CHQ', 'LCN']),
  numero_valeur: z.string().min(1, 'Numéro de valeur requis').max(100),
  nom_tire: z.string().min(1, 'Nom du tiré requis').max(255),
  porteur: z.string().max(255).optional().default(''),
  relation: z.enum(['CD', 'CDC']),
  observations: z.string().max(5000).optional().default(''),
  commercial_id: z.string().uuid().nullable().optional(),
  statut: z.string().max(255).optional().default('Attente retour du client'),
});

export const updateDossierSchema = z.object({
  date_saisie: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_facture: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  date_echeance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  banque: z.string().min(1).max(255).optional(),
  montant: z.number().min(0).max(1_000_000_000).optional(),
  type_valeur: z.enum(['CHQ', 'LCN']).optional(),
  numero_valeur: z.string().min(1).max(100).optional(),
  nom_tire: z.string().min(1).max(255).optional(),
  porteur: z.string().max(255).optional(),
  relation: z.enum(['CD', 'CDC']).optional(),
  observations: z.string().max(5000).optional(),
  commercial_id: z.string().uuid().nullable().optional(),
  statut: z.string().max(255).optional(),
});

export const createActionSchema = z.object({
  contenu: z.string().min(1, 'Le contenu de l\'action est requis').max(5000),
  type_action: z.string().max(100).optional().default('relance'),
});

export const createBanqueSchema = z.object({
  nom: z.string().min(1, 'Nom de la banque requis').max(255),
});

export const createStatutSchema = z.object({
  libelle: z.string().min(1, 'Libellé requis').max(255),
  ordre: z.number().int().min(0).max(1000).optional().default(0),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale requise').optional().default('#6b7280'),
});

export const updateStatutRefSchema = z.object({
  libelle: z.string().min(1).max(255).optional(),
  ordre: z.number().int().min(0).max(1000).optional(),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale requise').optional(),
  actif: z.boolean().optional(),
});

export const createRelationSchema = z.object({
  code: z.string().min(1).max(10),
  libelle: z.string().min(1).max(255),
});

export const statutBodySchema = z.object({
  statut: z.string().min(1, 'Statut requis').max(255),
});

export const reaffecterBodySchema = z.object({
  commercial_id: z.string().uuid('Identifiant commercial invalide'),
});

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requis').max(2000),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().max(2000).optional(),
});

// ====================== Query params (listes / exports) ======================

const sortOrderField = () => z.enum(['ASC', 'DESC', 'asc', 'desc']).optional().catch('DESC');
const relationField = () =>
  z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : String(v).toUpperCase()),
    z.enum(['CD', 'CDC']).optional().catch(undefined)
  );

export const dossierListQuerySchema = z.object({
  page: pageParam,
  limit: limitParam(100),
  search: optionalTrimmedString(255),
  nom_tire: optionalTrimmedString(255),
  banque: optionalTrimmedString(255),
  statut: optionalTrimmedString(255),
  relation: relationField(),
  commercial_id: optionalUuid(),
  type_valeur: z.preprocess(emptyToUndefined, z.enum(['CHQ', 'LCN']).optional().catch(undefined)),
  date_debut: optionalDateString(),
  date_fin: optionalDateString(),
  montant_min: optionalNumber({ message: 'Montant minimum invalide' }),
  montant_max: optionalNumber({ message: 'Montant maximum invalide' }),
  sort: optionalTrimmedString(50),
  order: sortOrderField(),
});

export const erpImpayesQuerySchema = z.object({
  page: pageParam,
  limit: limitParam(100),
  search: optionalTrimmedString(255),
  nom_tire: optionalTrimmedString(255),
  type_valeur: z.preprocess(emptyToUndefined, z.enum(['CHQ', 'LCN']).optional().catch(undefined)),
  date_debut: optionalDateString(),
  date_fin: optionalDateString(),
  montant_min: optionalNumber({ message: 'Montant minimum invalide' }),
  montant_max: optionalNumber({ message: 'Montant maximum invalide' }),
  statut: optionalTrimmedString(255),
  sort: optionalTrimmedString(50),
  order: sortOrderField(),
});

export const exportQuerySchema = z.object({
  banque: optionalTrimmedString(255),
  statut: optionalTrimmedString(255),
  relation: relationField(),
  type_valeur: z.preprocess(emptyToUndefined, z.enum(['CHQ', 'LCN']).optional().catch(undefined)),
  date_debut: optionalDateString(),
  date_fin: optionalDateString(),
});

export const erpSyncItemSchema = z.object({
  erp_voucher_id: z.number().int().positive(),
  date_saisie: z.string().max(32).nullable().optional(),
  date_facture: z.string().max(32).nullable().optional(),
  date_echeance: z.string().max(32).nullable().optional(),
  montant: z.number().finite(),
  type_valeur: z.string().max(10),
  numero_valeur: z.string().max(255),
  nom_tire: z.string().max(255),
  porteur: z.string().max(255).nullable().optional(),
  relation: z.string().max(10).nullable().optional(),
  banque: z.string().max(255).nullable().optional(),
  erp_partner_id: z.number().int().nullable().optional(),
  erp_commercial_nom: z.string().max(255).nullable().optional(),
});

export const auditLogQuerySchema = z.object({
  page: pageParam,
  limit: limitParam(200, 50),
  utilisateur_id: optionalUuid(),
  dossier_id: optionalUuid(),
  action_type: optionalTrimmedString(50),
  date_debut: optionalDateString(),
  date_fin: optionalDateString(),
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

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ error: 'Paramètres de requête invalides', details: errors });
    }
    req.validatedQuery = result.data;
    next();
  };
}
