const COMMERCIAL_PREFIXES = Object.freeze([
  ['DIRECTION', 'DIRECTION'],
  ['OUSSAMA', 'OUSSAMA'],
  ['NAOUAFAL', 'NAOUFAL'],
  ['NAOUFAL', 'NAOUFAL'],
  ['LAHCEN', 'LAHCEN'],
  ['RACHID', 'RACHID'],
  ['FAYCAL', 'FAYCAL'],
  ['NABIL', 'NABIL'],
  ['OMAR', 'OMAR'],
  ['FAHD', 'FAHD'],
  ['GII', 'GII'],
]);

export function normalizeCommercialIdentity(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const match = COMMERCIAL_PREFIXES.find(([prefix]) => normalized.startsWith(prefix));
  return match?.[1] || normalized;
}

export function normalizedCommercialIdentitySql(expression) {
  const normalized = `REGEXP_REPLACE(TRANSLATE(UPPER(COALESCE(${expression}, '')), 'Ç', 'C'), '[^A-Z0-9]', '', 'g')`;
  return `(CASE
    WHEN ${normalized} LIKE 'DIRECTION%' THEN 'DIRECTION'
    WHEN ${normalized} LIKE 'OUSSAMA%' THEN 'OUSSAMA'
    WHEN ${normalized} LIKE 'NAOUAFAL%' OR ${normalized} LIKE 'NAOUFAL%' THEN 'NAOUFAL'
    WHEN ${normalized} LIKE 'LAHCEN%' THEN 'LAHCEN'
    WHEN ${normalized} LIKE 'RACHID%' THEN 'RACHID'
    WHEN ${normalized} LIKE 'FAYCAL%' THEN 'FAYCAL'
    WHEN ${normalized} LIKE 'NABIL%' THEN 'NABIL'
    WHEN ${normalized} LIKE 'OMAR%' THEN 'OMAR'
    WHEN ${normalized} LIKE 'FAHD%' THEN 'FAHD'
    WHEN ${normalized} LIKE 'GII%' THEN 'GII'
    ELSE ${normalized}
  END)`;
}
