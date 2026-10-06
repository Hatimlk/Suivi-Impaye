function normalizePartyName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function resolveRelation(partnerName, bearerName) {
  const partner = normalizePartyName(partnerName);
  const bearer = normalizePartyName(bearerName);

  if (!partner || !bearer) return 'CD';
  return partner === bearer ? 'CD' : 'CDC';
}
