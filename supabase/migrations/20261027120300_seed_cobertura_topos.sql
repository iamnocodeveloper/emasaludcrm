-- Seed de las 29 categorías de la cobertura con sus topes.
-- Los topes por práctica son el valor por defecto de la categoría; cada
-- práctica mapeada puede sobrescribirlo en cobertura_practicas.
-- Los grupos "sólo Mendoza" se evalúan únicamente cuando el paciente
-- pertenece a Mendoza (provincia o localidad).

INSERT INTO public.cobertura_grupos (
  codigo, nombre,
  limite_practica_default, periodo_practica_default,
  limite_grupo, periodo_grupo_dias,
  ambito
) VALUES
  ('CAMA_ACOMPANANTE_MAGNUM',            'Cama acompañante (Magnum)',              5,  365,  5, 365, 'general'),
  ('CARDIOLOGIA_ESPECIALES',             'Cardiología especiales',                1,  365,  2, 365, 'general'),
  ('DENSITOMETRIA_OSEA',                 'Densitometría ósea',                    1,  730,  1, 730, 'general'),
  ('ECODOPPLER_ECOGRAFIAS_ESPECIALES',   'Ecodoppler y ecografías especiales',    1,  365,  3, 365, 'general'),
  ('ECOGRAFIA',                          'Ecografía',                             2,   30,  4, 365, 'general'),
  ('ECOGRAFIA_OBSTETRICA_PMI',           'Ecografía obstétrica - PMI',            1,   90,  3, 365, 'general'),
  ('ECOGRAFIA_OBSTETRICA_PMI_MZA',       'Ecografía obstétrica - PMI sólo Mendoza', 1, 90,  3, 365, 'solo_mendoza'),
  ('ELECTROENCEFALOGRAMAS',              'Electroencefalogramas',                 1,  365,  2, 365, 'general'),
  ('ELECTROMIOGRAMAS',                   'Electromiogramas y monitoreos',         1,  365,  1, 365, 'general'),
  ('ESPIROMETRIAS',                      'Espirometrías',                         1,  180,  2, 365, 'general'),
  ('FISIOTERAPIA_KINESIOTERAPIA',        'Fisioterapia y kinesioterapia',        25,  365, 50, 365, 'general'),
  ('GASTROENTEROLOGIA',                  'Gastroenterología',                     1,  365,  3, 365, 'general'),
  ('MAMOGRAFIA',                         'Mamografía',                            2,  365,  4, 365, 'general'),
  ('NUTRICION',                          'Nutrición',                             2,   30, 10, 365, 'general'),
  ('NUTRICION_MZA',                      'Nutrición sólo Mendoza',                2,   30, 10, 365, 'solo_mendoza'),
  ('OFTALMOLOGIA',                       'Oftalmología',                          1,  365,  2, 365, 'general'),
  ('POLISOMNOGRAFIAS',                   'Polisomnografías',                      1,  365,  2, 365, 'general'),
  ('POTENCIALES_EVOCADOS',               'Potenciales evocados',                  4,  365,  4, 365, 'general'),
  ('POTENCIALES_EVOCADOS_MZA',           'Potenciales evocados sólo Mendoza',     1,  365,  4, 365, 'solo_mendoza'),
  ('REHABILITACION_CARDIOVASCULAR',      'Rehabilitación cardiovascular',         1,   30,  6, 365, 'general'),
  ('RMN',                                'RMN',                                   1,   90,  2, 365, 'general'),
  ('RX_1',                               'RX_1',                                  4,    1, 10, 365, 'general'),
  ('RX_2',                               'RX_2',                                  1,  180,  2, 365, 'general'),
  ('RX_3',                               'RX_3 Espino y escano gramas',           2,  365,  2, 365, 'general'),
  ('SALUD_MENTAL',                       'Salud mental',                          4,   30, 25, 365, 'general'),
  ('SALUD_MENTAL_2',                     'Salud mental 2',                        2,  365,  2, 365, 'general'),
  ('SALUD_MENTAL_3',                     'Salud mental 3',                        1,   30,  1, 365, 'general'),
  ('TAC',                                'TAC',                                   2,  365,  3, 365, 'general'),
  ('TAC_ESPECIALES',                     'TAC especiales',                        1,  365,  1, 365, 'general')
ON CONFLICT (codigo) DO UPDATE SET
  nombre                   = EXCLUDED.nombre,
  limite_practica_default  = EXCLUDED.limite_practica_default,
  periodo_practica_default = EXCLUDED.periodo_practica_default,
  limite_grupo             = EXCLUDED.limite_grupo,
  periodo_grupo_dias       = EXCLUDED.periodo_grupo_dias,
  ambito                   = EXCLUDED.ambito,
  updated_at               = now();
