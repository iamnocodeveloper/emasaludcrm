-- Diagnóstico del tope de autorizaciones para un DNI.
-- SOLO LECTURA: todo se ejecuta dentro de una transacción que termina en ROLLBACK.
-- Uso: ajustar el DNI en las consultas y ejecutar desde el SQL Editor, psql
-- o `supabase db query --linked --file supabase/diagnostics/dni-34920351.sql`.
BEGIN;

-- 1) Ficha del paciente y variantes del documento (con/sin ceros, CUIL).
SELECT id, dni, nro_doc, cuil_beneficiario, nombre, apellido, activo, estado_padron,
       obra_social_id, plan, provincia, localidad,
       consultas_maximas, consultas_mes_actual, created_at, updated_at
  FROM public.pacientes
 WHERE regexp_replace(COALESCE(dni, ''), '\D', '', 'g') IN ('34920351', '034920351')
    OR regexp_replace(COALESCE(nro_doc, ''), '\D', '', 'g') IN ('34920351', '034920351')
    OR COALESCE(cuil_beneficiario, '') LIKE '%34920351%'
 ORDER BY id;

-- 2) Cupo mensual: lo que cuenta el motor vs lo que muestra la ficha.
SELECT p.id AS paciente_id, p.dni,
       public.consumo_autorizaciones(
         p.id,
         public.periodo_desde(CURRENT_DATE, 30),
         public.periodo_hasta(CURRENT_DATE, 30)) AS consumidas_mes,
       p.consultas_maximas,
       p.consultas_mes_actual AS contador_legacy,
       public.excepcion_extra_global(p.id, CURRENT_DATE) AS excepcion_global,
       public.periodo_desde(CURRENT_DATE, 30) AS periodo_desde,
       public.periodo_hasta(CURRENT_DATE, 30) AS periodo_hasta
  FROM public.pacientes p
 WHERE regexp_replace(COALESCE(p.dni, ''), '\D', '', 'g') = '34920351';

-- 3) Historial del mes: qué filas se están contando exactamente.
SELECT a.id, a.estado, a.activa,
       a.fecha_solicitud, a.created_at,
       public.fecha_efectiva(a.fecha_solicitud, a.created_at) AS fecha_imputada,
       a.obra_social_id, a.numero_autorizacion, a.tipo_autorizacion,
       ap.prestacion_codigo, ap.prestacion_descripcion, ap.cantidad
  FROM public.autorizaciones a
  LEFT JOIN public.autorizacion_prestaciones ap ON ap.autorizacion_id = a.id
 WHERE a.paciente_id IN (
        SELECT id FROM public.pacientes
         WHERE regexp_replace(COALESCE(dni, ''), '\D', '', 'g') = '34920351')
   AND public.fecha_efectiva(a.fecha_solicitud, a.created_at)
       BETWEEN public.periodo_desde(CURRENT_DATE, 30) AND public.periodo_hasta(CURRENT_DATE, 30)
 ORDER BY fecha_imputada, a.id;

-- 4) Consumo por grupo (misma fuente que usa la ficha del paciente).
SELECT jsonb_pretty(public.resumen_consumos_paciente(
         (SELECT id FROM public.pacientes
           WHERE regexp_replace(COALESCE(dni, ''), '\D', '', 'g') = '34920351'
           ORDER BY id LIMIT 1)));

-- 5) Consumo por práctica de las prestaciones que ya tiene autorizadas.
SELECT cp.codigo_practica, cg.nombre AS grupo,
       COALESCE(cp.limite_practica, cg.limite_practica_default) AS limite_practica,
       COALESCE(cp.periodo_practica_dias, cg.periodo_practica_default) AS periodo_practica,
       public.consumo_prestaciones(
         (SELECT id FROM public.pacientes
           WHERE regexp_replace(COALESCE(dni, ''), '\D', '', 'g') = '34920351'
           ORDER BY id LIMIT 1),
         public.periodo_desde(CURRENT_DATE, COALESCE(cp.periodo_practica_dias, cg.periodo_practica_default)),
         public.periodo_hasta(CURRENT_DATE, COALESCE(cp.periodo_practica_dias, cg.periodo_practica_default)),
         cp.codigo_practica, NULL, NULL) AS consumido_practica
  FROM public.cobertura_practicas cp
  JOIN public.cobertura_grupos cg ON cg.id = cp.grupo_id
 WHERE cp.activo AND cg.activo
   AND cp.codigo_practica IN (
        SELECT DISTINCT ap.prestacion_codigo
          FROM public.autorizaciones a
          JOIN public.autorizacion_prestaciones ap ON ap.autorizacion_id = a.id
         WHERE a.paciente_id IN (
                SELECT id FROM public.pacientes
                 WHERE regexp_replace(COALESCE(dni, ''), '\D', '', 'g') = '34920351'))
 ORDER BY cp.codigo_practica;

-- 6) Evidencia del bloqueo: últimas validaciones registradas.
SELECT v.created_at, v.codigo_practica, v.cantidad, v.permitido, v.motivo,
       v.detalle ->> 'mensaje' AS mensaje
  FROM public.validaciones_prestacion_log v
 WHERE v.paciente_id IN (
        SELECT id FROM public.pacientes
         WHERE regexp_replace(COALESCE(dni, ''), '\D', '', 'g') = '34920351')
 ORDER BY v.created_at DESC
 LIMIT 30;

-- 7) Excepciones de cupo vigentes o históricas del paciente.
SELECT id, grupo_id, codigo_practica, cantidad_extra,
       vigente_desde, vigente_hasta, activo, justificacion,
       responsable_nombre, numero_expediente
  FROM public.cobertura_excepciones
 WHERE paciente_id IN (
        SELECT id FROM public.pacientes
         WHERE regexp_replace(COALESCE(dni, ''), '\D', '', 'g') = '34920351')
 ORDER BY vigente_desde DESC;

ROLLBACK;
