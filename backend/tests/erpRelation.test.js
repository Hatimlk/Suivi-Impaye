import { describe, expect, it } from 'vitest';
import { resolveRelation } from '../src/services/erpRelation.js';

describe('relation ERP CD/CDC', () => {
  it('returns CD when partner and bearer are the same', () => {
    expect(resolveRelation('BOUGDOUR WOOD', 'BOUGDOUR WOOD')).toBe('CD');
  });

  it('ignores accents, punctuation and spacing', () => {
    expect(resolveRelation('Société El Amane', 'SOCIETE-EL  AMANE')).toBe('CD');
  });

  it('keeps CD when the names share a distinctive word', () => {
    expect(resolveRelation('BOUGDOUR WOOD', 'BOUGDOUR TIMBRE')).toBe('CD');
    expect(resolveRelation('BOUGDOUR WOOD', 'BOUGDOUR WOOD SARL')).toBe('CD');
  });

  it('recognizes a company name split by spaces or followed by a location', () => {
    expect(resolveRelation('SOKETRADOZ', 'SO KE TRA DOZ')).toBe('CD');
    expect(resolveRelation('SOKETRADOZ', 'SO KE TRA DOZ - OUARZAZATE')).toBe('CD');
  });

  it('returns CDC when the names have no distinctive word in common', () => {
    expect(resolveRelation('BOUGDOUR WOOD', 'ANCIEN BOIS')).toBe('CDC');
    expect(resolveRelation('STE NAMIRA SARL', 'ENTREPRISE ATLAS')).toBe('CDC');
    expect(resolveRelation('MOHAMED AMINE', 'STE O K L')).toBe('CDC');
  });

  it('keeps CD when one party is missing', () => {
    expect(resolveRelation('CLIENT', '')).toBe('CD');
  });
});
