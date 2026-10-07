import { describe, expect, it } from 'vitest';
import {
  buildCommercialMap,
  parseCommercialMap,
  resolveCommercialName,
} from '../src/services/erpCommercial.js';

describe('commercial ERP', () => {
  it('resolves the commercial IDs confirmed in OpenPROD', () => {
    const map = buildCommercialMap();
    expect(resolveCommercialName({ erp_commercial_id: 34 }, map)).toBe('OUSSAMA');
    expect(resolveCommercialName({ erp_commercial_id: 49 }, map)).toBe('OMAR');
    expect(resolveCommercialName({ erp_commercial_id: 53 }, map)).toBe('OUSSAMA');
    expect(resolveCommercialName({ erp_commercial_id: 56 }, map)).toBe('FAHD');
    expect(resolveCommercialName({ erp_commercial_id: 57 }, map)).toBe('FAYÇAL');
    expect(resolveCommercialName({ erp_commercial_id: 61 }, map)).toBe('GII');
    expect(resolveCommercialName({ erp_commercial_id: 75 }, map)).toBe('RACHID');
    expect(resolveCommercialName({ erp_commercial_id: 70 }, map)).toBe('LAHCEN');
    expect(resolveCommercialName({ erp_commercial_id: 48 }, map)).toBe('NABIL');
  });

  it('keeps a name supplied directly by the ERP', () => {
    expect(resolveCommercialName({ erp_commercial_id: 75, erp_commercial_nom: 'Nom ERP' }, buildCommercialMap())).toBe('Nom ERP');
  });

  it('removes retired names and uses a known replacement when available', () => {
    const map = buildCommercialMap();
    expect(resolveCommercialName({ erp_commercial_id: 53, erp_commercial_nom: 'BADR' }, map)).toBe('OUSSAMA');
    expect(resolveCommercialName({ erp_commercial_id: 50, erp_commercial_nom: 'YASSIR' }, map)).toBe('NAOUFAL');
    expect(resolveCommercialName({ erp_commercial_id: 50, erp_commercial_nom: 'BADR' }, map)).toBe('NAOUFAL');
    expect(resolveCommercialName({ erp_commercial_id: 50, erp_commercial_nom: '' }, map)).toBe('NAOUFAL');
  });

  it('allows extra or corrected mappings through the environment format', () => {
    const map = buildCommercialMap('75:Rachid El Amrani,81:ALI');
    expect(resolveCommercialName({ erp_commercial_id: 75 }, map)).toBe('Rachid El Amrani');
    expect(resolveCommercialName({ erp_commercial_id: 81 }, map)).toBe('ALI');
  });

  it('shows the ERP ID instead of silently leaving an unknown commercial empty', () => {
    expect(resolveCommercialName({ erp_commercial_id: 999 }, buildCommercialMap())).toBe('Commercial ERP #999');
  });

  it('rejects malformed custom mappings', () => {
    expect(() => parseCommercialMap('bad-value')).toThrow('Mapping commercial ERP invalide');
  });
});
