export type UserRole = 'admin' | 'responsable_recouvrement' | 'commercial' | 'lecture_seule';

export interface User {
  id: string;
  nom: string;
  email: string;
  role: UserRole;
  actif: boolean;
  date_creation: string;
  date_modification?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type TypeValeur = 'CHQ' | 'LCN';
export type Relation = 'CD' | 'CDC';

export interface Dossier {
  id: string;
  date_saisie: string;
  banque: string;
  montant: number;
  type_valeur: TypeValeur;
  numero_valeur: string;
  nom_tire: string;
  relation: Relation;
  observations: string;
  commercial_id: string | null;
  commercial_nom: string | null;
  statut: string;
  date_derniere_action: string | null;
  date_cloture: string | null;
  date_creation: string;
  date_derniere_modification: string;
  actions?: Action[];
}

export interface Action {
  id: string;
  dossier_id: string;
  date_action: string;
  auteur_id: string | null;
  auteur_nom: string | null;
  contenu: string;
  type_action: string;
  date_creation: string;
}

export interface PaginatedResponse<T> {
  dossiers: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardStats {
  total: { count: number; montant: number };
  parStatut: { statut: string; count: number; total_montant: number }[];
  parBanque: { banque: string; count: number; total_montant: number }[];
  parCommercial: { commercial_nom: string; count: number; total_montant: number }[];
  parType: { type_valeur: string; count: number; total_montant: number }[];
  evolutionMensuelle: { mois: string; count: number; total_montant: number }[];
  dossiersDormants: number;
}

export interface Alerts {
  dormants: (Dossier & { jours_sans_action: number })[];
  contentieux: Dossier[];
}

export interface BanqueRef {
  id: number;
  nom: string;
  actif: boolean;
}

export interface StatutRef {
  id: number;
  libelle: string;
  ordre: number;
  couleur: string;
  actif: boolean;
}

export interface RelationRef {
  id: number;
  code: string;
  libelle: string;
  actif: boolean;
}

export interface AuditLog {
  id: string;
  utilisateur_id: string | null;
  utilisateur_nom: string | null;
  dossier_id: string | null;
  action_type: string;
  details_json: Record<string, unknown>;
  date_action: string;
}
