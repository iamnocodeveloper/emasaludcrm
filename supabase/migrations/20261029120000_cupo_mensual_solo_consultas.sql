-- El cupo mensual del paciente (pacientes.consultas_maximas, "Consultas Máximas
-- por Mes") debe contar CONSULTAS, no cualquier autorización.
--
-- Problema detectado (caso DNI 34920351, paciente 12492 / OSPE PMO):
--   consultas_maximas = 2, con una consulta y un laboratorio en el mes.
--   consumo_autorizaciones contaba ambas cabeceras => 2/2 y la siguiente
--   autorización (un estudio) quedaba bloqueada con "Cupo mensual alcanzado".
--   Un laboratorio consumía el cupo de consultas.
--
-- El control real del resto de las prestaciones son las reglas por práctica y
-- por grupo (cobertura_practicas / cobertura_grupos), que no se tocan acá.

CREATE OR REPLACE FUNCTION public.consumo_autorizaciones(
  p_paciente_id integer,
  p_desde date,
  p_hasta date
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
    FROM public.autorizaciones a
   WHERE a.paciente_id = ANY (public.paciente_ids_por_dni(p_paciente_id))
     AND COALESCE(a.activa, true)
     AND COALESCE(a.estado, 'pendiente') IN ('pendiente', 'aprobada')
     AND COALESCE(a.tipo_autorizacion, '') = 'consulta'
     AND public.fecha_efectiva(a.fecha_solicitud, a.created_at) BETWEEN p_desde AND p_hasta;
$$;

-- El contador legacy que muestra la UI se calcula con el mismo criterio.
CREATE OR REPLACE FUNCTION public.sync_consultas_mes_actual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desde date := public.periodo_desde(CURRENT_DATE, 30);
  v_hasta date := public.periodo_hasta(CURRENT_DATE, 30);
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.paciente_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.paciente_id IS DISTINCT FROM NEW.paciente_id) THEN
    UPDATE public.pacientes p
       SET consultas_mes_actual = (
         SELECT COUNT(*)::integer
           FROM public.autorizaciones a
          WHERE a.paciente_id = p.id
            AND public.autorizacion_consume_cupo(a.estado, a.activa)
            AND COALESCE(a.tipo_autorizacion, '') = 'consulta'
            AND public.fecha_efectiva(a.fecha_solicitud, a.created_at) BETWEEN v_desde AND v_hasta
       )
     WHERE p.id = OLD.paciente_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.paciente_id IS NOT NULL THEN
    UPDATE public.pacientes p
       SET consultas_mes_actual = (
         SELECT COUNT(*)::integer
           FROM public.autorizaciones a
          WHERE a.paciente_id = p.id
            AND public.autorizacion_consume_cupo(a.estado, a.activa)
            AND COALESCE(a.tipo_autorizacion, '') = 'consulta'
            AND public.fecha_efectiva(a.fecha_solicitud, a.created_at) BETWEEN v_desde AND v_hasta
       )
     WHERE p.id = NEW.paciente_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Recalcula el contador informativo con el criterio nuevo.
UPDATE public.pacientes p
   SET consultas_mes_actual = s.total
  FROM (
    SELECT p2.id,
           (
             SELECT COUNT(*)::integer
               FROM public.autorizaciones a
              WHERE a.paciente_id = p2.id
                AND public.autorizacion_consume_cupo(a.estado, a.activa)
                AND COALESCE(a.tipo_autorizacion, '') = 'consulta'
                AND public.fecha_efectiva(a.fecha_solicitud, a.created_at)
                    BETWEEN public.periodo_desde(CURRENT_DATE, 30)
                        AND public.periodo_hasta(CURRENT_DATE, 30)
           ) AS total
      FROM public.pacientes p2
  ) s
 WHERE p.id = s.id
   AND p.consultas_mes_actual IS DISTINCT FROM s.total;
