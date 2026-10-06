import { describe, expect, it } from 'vitest';
import { resolveRelation } from '../src/services/erpRelation.js';

describe('relation ERP CD/CDC', () => {
  it('returns CD when partner and bearer are the same', () => {
    expect(resolveRelation('BOUGDOUR WOOD', 'BOUGDOUR WOOD')).toBe('CD');
  });

  it('ignores accents, punctuation and spacing', () => {
    expect(resolveRelation('Société El Amane', 'SOCIETE-EL  AMANE')).toBe('CD');
  });

  it('returns CDC when partner and bearer are different', () => {
    expect(resolveRelation('BOUGDOUR WOOD', 'BOUGDOUR TIMBRE')).toBe('CDC');
  });

  it('keeps CD when one party is missing', () => {
    expect(resolveRelation('CLIENT', '')).toBe('CD');
  });
});
