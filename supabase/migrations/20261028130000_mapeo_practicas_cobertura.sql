-- Mapeo inicial de prácticas del nomenclador a los grupos de cobertura.
--
-- Criterio (nomenclador PMO):
--   · 18xxxx  → ecografía / ecodoppler. Se excluyen punciones, drenajes,
--               biopsias e infiltraciones guiadas (son procedimientos).
--   · 34xxxx  → diagnóstico por imágenes:
--       - 3412                     → Densitometría ósea
--       - 3410, 3413               → TAC (angiotomografía y TAC)
--       - 3420                     → RMN
--       - MAMOGRAFIA (texto)       → Mamografía
--       - ESPINOGRAF/ESPINOGRAMA   → RX_3
--       - 3401, 3404-3406, 3408,
--         3409, 3471, 3474-3476,
--         3478, 3479               → RX_2 (estudios con contraste/seriados)
--       - 3402, 3403, 3472, 3473   → RX_1 (radiografías simples)
--       - 3411 (angiografía), 3414 y 3421 (anestesia/adicionales),
--         3461 (marcación)         → sin tope (no son estudios del listado)
--   · 29xxxx  → EEG, EMG, potenciales, polisomnografía, espirometría.
--
-- Los códigos que no cumplen ninguna regla quedan sin mapear (sin_regla):
-- el motor los autoriza sin bloqueo y se pueden asignar desde la pantalla
-- "Topes de Prestaciones".
--
-- Es idempotente: se puede volver a ejecutar sin duplicar.

WITH clasificacion AS (
  SELECT
    n.codigo_practica,
    CASE
      -- Procedimientos guiados por ecografía: no son estudios del grupo.
      WHEN n.codigo_practica LIKE '18%'
           AND (n.descripcion_practica ILIKE '%DRENAJE%'
             OR n.descripcion_practica ILIKE '%PUNCION%'
             OR n.descripcion_practica ILIKE '%BIOPSIA%'
             OR n.descripcion_practica ILIKE '%INFILTRACION%')
        THEN NULL

      -- Ecografía y ecodoppler.
      WHEN n.codigo_practica LIKE '18%'
           AND (n.descripcion_practica ILIKE '%ECODOPPLER%'
             OR n.descripcion_practica ILIKE '%DOPPLER%')
        THEN 'ECODOPPLER_ECOGRAFIAS_ESPECIALES'
      WHEN n.codigo_practica LIKE '18%'
           AND (n.descripcion_practica ILIKE '%OBSTETRIC%'
             OR n.descripcion_practica ILIKE '%FETAL%')
        THEN 'ECOGRAFIA_OBSTETRICA_PMI'
      WHEN n.codigo_practica LIKE '18%'
        THEN 'ECOGRAFIA'

      -- Diagnóstico por imágenes (34xxxx).
      WHEN n.descripcion_practica ILIKE '%MAMOGRAF%'
        THEN 'MAMOGRAFIA'
      WHEN n.descripcion_practica ILIKE '%DENSITOMETR%'
        THEN 'DENSITOMETRIA_OSEA'
      WHEN n.descripcion_practica ILIKE '%ESPINOGRAF%'
        OR n.descripcion_practica ILIKE '%ESPINOGRAMA%'
        THEN 'RX_3'
      WHEN LEFT(n.codigo_practica, 4) IN ('3410', '3413')
        THEN 'TAC'
      WHEN LEFT(n.codigo_practica, 4) = '3420'
        THEN 'RMN'
      WHEN LEFT(n.codigo_practica, 4) IN
           ('3401', '3404', '3405', '3406', '3408', '3409',
            '3471', '3474', '3475', '3476', '3478', '3479')
        THEN 'RX_2'
      WHEN LEFT(n.codigo_practica, 4) IN ('3402', '3403', '3472', '3473')
        THEN 'RX_1'

      -- Estudios diagnósticos.
      WHEN n.descripcion_practica ILIKE '%ELECTROENCEFALOGRAM%'
        THEN 'ELECTROENCEFALOGRAMAS'
      WHEN n.descripcion_practica ILIKE '%ELECTROMIOGRAF%'
        THEN 'ELECTROMIOGRAMAS'
      WHEN n.descripcion_practica ILIKE '%ESPIROMETR%'
        THEN 'ESPIROMETRIAS'
      WHEN n.descripcion_practica ILIKE '%POTENCIALES EVOCADOS%'
        THEN 'POTENCIALES_EVOCADOS'
      WHEN n.descripcion_practica ILIKE '%POLISOMNOGRAF%'
        THEN 'POLISOMNOGRAFIAS'

      ELSE NULL
    END AS grupo_codigo
  FROM public.nomeclador n
)
INSERT INTO public.cobertura_practicas (codigo_practica, grupo_id)
SELECT c.codigo_practica, g.id
  FROM clasificacion c
  JOIN public.cobertura_grupos g ON g.codigo = c.grupo_codigo
 WHERE c.grupo_codigo IS NOT NULL
ON CONFLICT (codigo_practica, grupo_id) DO NOTHING;

-- Variantes "sólo Mendoza": el mismo código se evalúa también contra el grupo
-- provincial, que tiene topes más restrictivos. Fuera de Mendoza no aplica.
INSERT INTO public.cobertura_practicas (codigo_practica, grupo_id)
SELECT cp.codigo_practica, destino.id
  FROM public.cobertura_practicas cp
  JOIN public.cobertura_grupos origen ON origen.id = cp.grupo_id
  CROSS JOIN public.cobertura_grupos destino
 WHERE origen.codigo = 'ECOGRAFIA_OBSTETRICA_PMI'
   AND destino.codigo = 'ECOGRAFIA_OBSTETRICA_PMI_MZA'
ON CONFLICT (codigo_practica, grupo_id) DO NOTHING;

INSERT INTO public.cobertura_practicas (codigo_practica, grupo_id)
SELECT cp.codigo_practica, destino.id
  FROM public.cobertura_practicas cp
  JOIN public.cobertura_grupos origen ON origen.id = cp.grupo_id
  CROSS JOIN public.cobertura_grupos destino
 WHERE origen.codigo = 'POTENCIALES_EVOCADOS'
   AND destino.codigo = 'POTENCIALES_EVOCADOS_MZA'
ON CONFLICT (codigo_practica, grupo_id) DO NOTHING;
