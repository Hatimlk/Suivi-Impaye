const DEFAULT_COMMERCIALS = Object.freeze({
  48: 'NABIL',
  50: 'YASSIR',
  70: 'LAHCEN',
  75: 'RACHID',
});

export function parseCommercialMap(value = '') {
  if (!value.trim()) return {};

  return Object.fromEntries(value.split(',').map((entry) => {
    const separator = entry.indexOf(':');
    if (separator < 1) throw new Error(`Mapping commercial ERP invalide: ${entry}`);

    const id = entry.slice(0, separator).trim();
    const name = entry.slice(separator + 1).trim();
    if (!/^\d+$/.test(id) || !name) throw new Error(`Mapping commercial ERP invalide: ${entry}`);
    return [id, name];
  }));
}

export function buildCommercialMap(value = '') {
  return { ...DEFAULT_COMMERCIALS, ...parseCommercialMap(value) };
}

export function resolveCommercialName(row, commercialMap) {
  const providedName = String(row.erp_commercial_nom || '').trim();
  if (providedName) return providedName;

  const sellerId = row.erp_commercial_id;
  if (sellerId == null) return '';
  return commercialMap[String(sellerId)] || `Commercial ERP #${sellerId}`;
}
