import { describe, expect, it } from 'vitest';
import { resolveCollectingBankName } from '../src/services/erpBank.js';

describe('banque d encaissement ERP', () => {
  it.each([
    [136, 'Banque CDM'],
    [150, 'Banque CAM'],
    [151, 'Banque BMCE'],
    [155, 'Banque BP'],
    [156, 'Banque SG'],
    [157, 'Banque BMCI'],
    [161, 'Banque (divers)'],
    [164, 'Banque ATTWB'],
    [173, 'Banque CIH'],
  ])('maps collecting_bank %i to %s', (id, name) => {
    expect(resolveCollectingBankName(id)).toBe(name);
  });

  it('keeps an explicit technical label for a new unknown bank', () => {
    expect(resolveCollectingBankName(999)).toBe('Banque #999');
  });

  it('marks a missing bank as not provided', () => {
    expect(resolveCollectingBankName(null)).toBe('Non renseignee');
  });
});
