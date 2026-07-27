import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMontant(montant: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
  }).format(montant);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR');
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function joursDepuis(dateStr: string | null): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export type SemanticTone = 'danger' | 'warning' | 'success' | 'info' | 'neutral';

/**
 * Maps a dossier's statut label to a semantic tone. Keys must match the
 * accented labels seeded in backend/migrations/002_seed_data.sql exactly —
 * a prior unaccented version of this map silently never matched and every
 * page reimplemented this logic inline instead.
 */
export function getStatutColor(statut: string): SemanticTone {
  const map: Record<string, SemanticTone> = {
    'Contentieux': 'danger',
    'Pré-contentieux': 'warning',
    'A rendre au client': 'warning',
    'A voir avec le commercial': 'neutral',
    'Attente retour du client': 'neutral',
    'Valeur à représenter': 'info',
    'Règlement à recevoir': 'success',
    'Règlement à récupérer': 'success',
    'Règlement partiel': 'info',
    'Régularisé - OK': 'success',
    'Représenté': 'info',
    'Sans suite': 'neutral',
    'Valeur à remplacer': 'warning',
    "Valeur envoyée à l'encaissement": 'info',
  };
  return map[statut] || 'neutral';
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  responsable_recouvrement: 'Directeur',
  commercial: 'Commercial',
  lecture_seule: 'Lecture seule',
};
