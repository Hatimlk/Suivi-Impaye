const DEFAULT_COMMERCIALS = Object.freeze({
  34: 'OUSSAMA',
  48: 'NABIL',
  49: 'OMAR',
  50: 'NAOUFAL',
  53: 'OUSSAMA',
  56: 'FAHD',
  57: 'FAYÇAL',
  61: 'GII',
  70: 'LAHCEN',
  75: 'RACHID',
});

const RETIRED_COMMERCIALS = new Set(['BADR', 'YASSIR']);

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
  const sellerId = row.erp_commercial_id;
  if (sellerId != null) {
    const mappedName = commercialMap[String(sellerId)];
    if (mappedName) return mappedName;
  }

  const providedName = String(row.erp_commercial_nom || '').trim();
  if (providedName && !RETIRED_COMMERCIALS.has(providedName.toUpperCase())) return providedName;
  return sellerId == null ? '' : `Commercial ERP #${sellerId}`;
}
