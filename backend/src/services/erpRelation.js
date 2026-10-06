const GENERIC_WORDS = new Set([
  'STE', 'SOCIETE', 'SARL', 'SA', 'SAS', 'ETS', 'ETABLISSEMENT', 'ETABLISSEMENTS',
  'ENT', 'ENTREPRISE', 'ENTREPRISES', 'GROUPE', 'MAROC', 'NV', 'NOUVELLE',
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function significantWords(value) {
  return normalizeText(value)
    .split(/[^A-Z0-9]+/)
    .filter((word) => word.length >= 3 && !GENERIC_WORDS.has(word));
}

export function resolveRelation(partnerName, bearerName) {
  const partner = significantWords(partnerName);
  const bearer = significantWords(bearerName);

  if (!partner.length || !bearer.length) return 'CD';
  const bearerWords = new Set(bearer);
  return partner.some((word) => bearerWords.has(word)) ? 'CD' : 'CDC';
}
