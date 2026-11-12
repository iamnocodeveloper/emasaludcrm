import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { OBRAS_SOCIALES_OFICIALES } from '../components/PadronStatus';
import { detectarObraSocial } from './padronParse';

describe('Padrones OSTEP', () => {
  test('permite cargar OSTEP usando su registro existente', () => {
    assert.equal(OBRAS_SOCIALES_OFICIALES.find((os) => os.nombre === 'OSTEP')?.id, 12);
  });

  test('asigna el archivo OSTEP a su obra social', () => {
    assert.equal(detectarObraSocial('OSTEP_MES_11_1.xlsx', OBRAS_SOCIALES_OFICIALES), 12);
  });
});