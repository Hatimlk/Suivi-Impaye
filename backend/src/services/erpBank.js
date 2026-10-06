const BANK_NAMES = Object.freeze({
  136: 'Banque CDM',
  150: 'Banque CAM',
  151: 'Banque BMCE',
  155: 'Banque BP',
  156: 'Banque SG',
  157: 'Banque BMCI',
  161: 'Banque (divers)',
  164: 'Banque ATTWB',
  173: 'Banque CIH',
});

export function resolveCollectingBankName(collectingBankId) {
  if (collectingBankId == null) return 'Non renseignee';
  return BANK_NAMES[String(collectingBankId)] || `Banque #${collectingBankId}`;
}
