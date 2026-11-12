import { describe, expect, test } from 'bun:test';
import { OBRAS_SOCIALES_OFICIALES } from '../components/PadronStatus';
import { detectarObraSocial } from './padronParse';

describe('Padrones OSTEP', () => {
  test('permite cargar OSTEP usando su registro existente', () => {
    expect(OBRAS_SOCIALES_OFICIALES.find((os) => os.nombre === 'OSTEP')?.id).toBe(12);
  });

  test('asigna el archivo OSTEP a su obra social', () => {
    expect(detectarObraSocial('OSTEP_MES_11_1.xlsx', OBRAS_SOCIALES_OFICIALES)).toBe(12);
  });
});