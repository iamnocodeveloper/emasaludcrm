-- Funciones del motor de validación de prestaciones.
-- Todo el cálculo se resuelve en la base para que no pueda evadirse desde el cliente.

-- ---------------------------------------------------------------------------
-- Períodos
-- Se computan por calendario según la cantidad de días de la regla:
--   1 = día, 30 = mes, 90 = trimestre, 180 = semestre, 365 = año, 730 = bienio.
-- Cualquier otro valor se interpreta como ventana móvil de N días.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.periodo_desde(p_fecha date, p_dias integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_dias
    WHEN 1   THEN p_fecha
    WHEN 30  THEN date_trunc('month', p_fecha)::date
    WHEN 90  THEN date_trunc('quarter', p_fecha)::date
    WHEN 180 THEN make_date(
                   EXTRACT(YEAR FROM p_fecha)::int,
                   CASE WHEN EXTRACT(MONTH FROM p_fecha) <= 6 THEN 1 ELSE 7 END,
                   1)
    WHEN 365 THEN make_date(EXTRACT(YEAR FROM p_fecha)::int, 1, 1)
    WHEN 730 THEN make_date((EXTRACT(YEAR FROM p_fecha)::int / 2) * 2, 1, 1)
    ELSE p_fecha - (p_dias - 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.periodo_hasta(p_fecha date, p_dias integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_dias
    WHEN 1   THEN p_fecha
    WHEN 30  THEN (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date
    WHEN 90  THEN (date_trunc('quarter', p_fecha) + interval '3 months - 1 day')::date
    WHEN 180 THEN CASE
                    WHEN EXTRACT(MONTH FROM p_fecha) <= 6
                      THEN make_date(EXTRACT(YEAR FROM p_fecha)::int, 6, 30)
                    ELSE make_date(EXTRACT(YEAR FROM p_fecha)::int, 12, 31)
                  END
    WHEN 365 THEN make_date(EXTRACT(YEAR FROM p_fecha)::int, 12, 31)
    WHEN 730 THEN make_date((EXTRACT(YEAR FROM p_fecha)::int / 2) * 2 + 1, 12, 31)
    ELSE p_fecha
  END;
$$;

-- ---------------------------------------------------------------------------
-- Identidad del paciente
-- Devuelve todos los registros que corresponden a la misma persona dentro de la
-- misma obra social (DNI normalizado + ID). Evita que un registro duplicado
-- fragmente el cupo o lo duplique.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.paciente_ids_por_dni(p_paciente_id integer)
RETURNS integer[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dni text;
  v_os  integer;
  v_ids integer[];
BEGIN
  SELECT NULLIF(regexp_replace(COALESCE(dni, ''), '\D', '', 'g'), ''), obra_social_id
    INTO v_dni, v_os
    FROM public.pacientes
   WHERE id = p_paciente_id;

  IF v_dni IS NULL THEN
    RETURN ARRAY[p_paciente_id];
  END IF;

  SELECT array_agg(id)
    INTO v_ids
    FROM public.pacientes
   WHERE regexp_replace(COALESCE(dni, ''), '\D', '', 'g') = v_dni
     AND obra_social_id IS NOT DISTINCT FROM v_os;

  RETURN COALESCE(v_ids, ARRAY[p_paciente_id]);
END;
$$;

-- ---------------------------------------------------------------------------
-- Consumo
-- Suma cantidades de prestaciones vigentes (pendientes o aprobadas) del paciente
-- en el rango indicado, por código de práctica y/o por grupo.
-- p_excluir_prestacion_id permite revalidar una fila sin contarse a sí misma.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consumo_prestaciones(
  p_paciente_id integer,
  p_desde date,
  p_hasta date,
  p_codigo_practica text DEFAULT NULL,
  p_grupo_id integer DEFAULT NULL,
  p_excluir_prestacion_id integer DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(ap.cantidad), 0)::integer
    FROM public.autorizacion_prestaciones ap
    JOIN public.autorizaciones a ON a.id = ap.autorizacion_id
   WHERE a.paciente_id = ANY (public.paciente_ids_por_dni(p_paciente_id))
     AND COALESCE(a.activa, true)
     AND COALESCE(a.estado, 'pendiente') IN ('pendiente', 'aprobada')
     AND public.fecha_efectiva(a.fecha_solicitud, a.created_at) BETWEEN p_desde AND p_hasta
     AND (p_excluir_prestacion_id IS NULL OR ap.id <> p_excluir_prestacion_id)
     AND (
       (p_codigo_practica IS NOT NULL AND ap.prestacion_codigo = p_codigo_practica)
       OR
       (p_codigo_practica IS NULL AND p_grupo_id IS NOT NULL AND ap.prestacion_codigo IN (
          SELECT cp.codigo_practica
            FROM public.cobertura_practicas cp
           WHERE cp.grupo_id = p_grupo_id
             AND cp.activo))
     );
$$;

-- Cupo adicional autorizado por excepciones vigentes a la fecha.
CREATE OR REPLACE FUNCTION public.excepcion_extra(
  p_paciente_id integer,
  p_codigo_practica text,
  p_grupo_id integer,
  p_fecha date
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cantidad_extra), 0)::integer
    FROM public.cobertura_excepciones
   WHERE paciente_id = p_paciente_id
     AND activo
     AND vigente_desde <= p_fecha
     AND (vigente_hasta IS NULL OR vigente_hasta >= p_fecha)
     AND (
       codigo_practica = p_codigo_practica
       OR (grupo_id IS NOT NULL AND grupo_id = p_grupo_id)
     );
$$;

-- Consumo de autorizaciones (no cantidades) en un rango: es la unidad del
-- cupo mensual asignado al paciente en pacientes.consultas_maximas.
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
     AND public.fecha_efectiva(a.fecha_solicitud, a.created_at) BETWEEN p_desde AND p_hasta;
$$;

-- Cupo adicional de una excepción global (sin grupo ni práctica): se aplica
-- al cupo mensual del paciente.
CREATE OR REPLACE FUNCTION public.excepcion_extra_global(
  p_paciente_id integer,
  p_fecha date
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cantidad_extra), 0)::integer
    FROM public.cobertura_excepciones
   WHERE paciente_id = p_paciente_id
     AND activo
     AND grupo_id IS NULL
     AND codigo_practica IS NULL
     AND vigente_desde <= p_fecha
     AND (vigente_hasta IS NULL OR vigente_hasta >= p_fecha);
$$;

-- ---------------------------------------------------------------------------
-- Autorización de llamador
-- Las funciones SECURITY DEFINER evaden RLS, por lo que el permiso se valida
-- explícitamente: sólo los roles internos pueden consultar o autorizar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.es_usuario_interno()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NULL  -- contextos de servicio (no tienen JWT de usuario)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'usuario_normal'::public.app_role)
      OR public.has_role(auth.uid(), 'prestador'::public.app_role);
$$;

-- ---------------------------------------------------------------------------
-- Validador central
-- Devuelve un JSON con el resultado, el consumo y los límites aplicados.
-- No lanza excepción: el llamador decide (el trigger sí bloquea).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_prestacion(
  p_paciente_id integer,
  p_codigo_practica text,
  p_cantidad integer DEFAULT 1,
  p_fecha date DEFAULT CURRENT_DATE,
  p_dni text DEFAULT NULL,
  p_excluir_prestacion_id integer DEFAULT NULL,
  p_autorizacion_id integer DEFAULT NULL,
  p_log boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pac        public.pacientes%ROWTYPE;
  v_cantidad   integer := GREATEST(COALESCE(p_cantidad, 1), 1);
  v_mendoza    boolean;
  v_regla      record;
  v_cons_aut   integer;
  v_extra_glob integer;
  v_max_mes    integer;
  v_cons_p     integer;
  v_cons_g     integer;
  v_extra_p    integer;
  v_extra_g    integer;
  v_desde_p    date;
  v_hasta_p    date;
  v_desde_g    date;
  v_hasta_g    date;
  v_lim_p      integer;
  v_lim_g      integer;
  v_permitido  boolean := true;
  v_motivo     text := 'ok';
  v_mensaje    text := 'Prestación autorizada.';
  v_grupos     jsonb := '[]'::jsonb;
  v_grupo      jsonb;
  v_reglas     integer := 0;
  v_res        jsonb;
BEGIN
  IF NOT public.es_usuario_interno() THEN
    RAISE EXCEPTION 'No tiene permisos para validar prestaciones.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pac FROM public.pacientes WHERE id = p_paciente_id;

  IF NOT FOUND THEN
    v_res := jsonb_build_object(
      'permitido', false,
      'motivo', 'identidad',
      'mensaje', 'El paciente indicado no existe.'
    );
    PERFORM public.registrar_validacion(p_paciente_id, p_codigo_practica, v_cantidad, v_res, p_log);
    RETURN v_res;
  END IF;

  -- Cruce DNI + ID: bloquea autorizaciones sobre el registro equivocado.
  IF p_dni IS NOT NULL AND v_pac.dni IS NOT NULL
     AND regexp_replace(p_dni, '\D', '', 'g') <> regexp_replace(v_pac.dni, '\D', '', 'g') THEN
    v_res := jsonb_build_object(
      'permitido', false,
      'motivo', 'identidad',
      'mensaje', format('El DNI %s no coincide con el paciente seleccionado (registro %s).', p_dni, p_paciente_id)
    );
    PERFORM public.registrar_validacion(p_paciente_id, p_codigo_practica, v_cantidad, v_res, p_log);
    RETURN v_res;
  END IF;

  -- Estado del padrón.
  IF COALESCE(v_pac.activo, true) = false
     OR UPPER(COALESCE(v_pac.estado_padron, 'Activo')) IN ('BAJA', 'BDA', 'FDP') THEN
    v_res := jsonb_build_object(
      'permitido', false,
      'motivo', 'padron',
      'mensaje', format('El paciente no está habilitado en el padrón (estado %s).',
                        COALESCE(v_pac.estado_padron, 'BAJA'))
    );
    PERFORM public.registrar_validacion(p_paciente_id, p_codigo_practica, v_cantidad, v_res, p_log);
    RETURN v_res;
  END IF;

  -- Cupo mensual asignado al paciente (pacientes.consultas_maximas).
  -- 999 es el valor que usan los padrones para "sin límite".
  IF v_pac.consultas_maximas IS NOT NULL AND v_pac.consultas_maximas < 999 THEN
    v_max_mes := v_pac.consultas_maximas;
    v_cons_aut := public.consumo_autorizaciones(
      p_paciente_id,
      public.periodo_desde(p_fecha, 30),
      public.periodo_hasta(p_fecha, 30));
    v_extra_glob := public.excepcion_extra_global(p_paciente_id, p_fecha);

    IF v_cons_aut > v_max_mes + v_extra_glob THEN
      v_permitido := false;
      v_motivo := 'cupo_mensual';
      v_mensaje := format(
        'Cupo mensual alcanzado: %s permitidas y %s registradas en el mes%s.',
        v_max_mes,
        v_cons_aut,
        CASE WHEN v_extra_glob > 0 THEN format(' (incluye %s por excepción)', v_extra_glob) ELSE '' END
      );
    END IF;
  END IF;

  v_mendoza := UPPER(COALESCE(v_pac.provincia, '')) LIKE '%MENDOZA%'
            OR UPPER(COALESCE(v_pac.localidad, '')) LIKE '%MENDOZA%';

  FOR v_regla IN
    SELECT cp.codigo_practica,
           COALESCE(cp.limite_practica, cg.limite_practica_default) AS limite_practica,
           COALESCE(cp.periodo_practica_dias, cg.periodo_practica_default) AS periodo_practica_dias,
           cg.id AS grupo_id,
           cg.codigo AS grupo_codigo,
           cg.nombre AS grupo_nombre,
           cg.limite_grupo,
           cg.periodo_grupo_dias,
           cg.ambito
      FROM public.cobertura_practicas cp
      JOIN public.cobertura_grupos cg ON cg.id = cp.grupo_id
     WHERE cp.codigo_practica = p_codigo_practica
       AND cp.activo
       AND cg.activo
       AND (cg.ambito = 'general'
            OR (cg.ambito = 'solo_mendoza' AND v_mendoza))
     ORDER BY CASE cg.ambito WHEN 'general' THEN 0 ELSE 1 END
  LOOP
    v_reglas := v_reglas + 1;
    v_lim_p  := v_regla.limite_practica;
    v_lim_g  := v_regla.limite_grupo;
    v_cons_p := NULL;
    v_cons_g := NULL;

    IF v_lim_p IS NOT NULL AND v_regla.periodo_practica_dias IS NOT NULL THEN
      v_desde_p := public.periodo_desde(p_fecha, v_regla.periodo_practica_dias);
      v_hasta_p := public.periodo_hasta(p_fecha, v_regla.periodo_practica_dias);
      v_cons_p  := public.consumo_prestaciones(
                     p_paciente_id, v_desde_p, v_hasta_p,
                     p_codigo_practica, NULL, p_excluir_prestacion_id);
      v_extra_p := public.excepcion_extra(
                     p_paciente_id, p_codigo_practica, v_regla.grupo_id, p_fecha);

      IF v_permitido AND v_cons_p + v_cantidad > v_lim_p + v_extra_p THEN
        v_permitido := false;
        v_motivo := 'practica';
        v_mensaje := format(
          'Tope por práctica alcanzado: %s permite %s cada %s días. Consumido %s, solicitado %s%s. Período %s al %s.',
          COALESCE(NULLIF(v_regla.grupo_nombre, ''), p_codigo_practica),
          v_lim_p,
          v_regla.periodo_practica_dias,
          v_cons_p,
          v_cantidad,
          CASE WHEN v_extra_p > 0 THEN format(' (incluye %s por excepción)', v_extra_p) ELSE '' END,
          to_char(v_desde_p, 'DD/MM/YYYY'),
          to_char(v_hasta_p, 'DD/MM/YYYY')
        );
      END IF;
    END IF;

    IF v_lim_g IS NOT NULL AND v_regla.periodo_grupo_dias IS NOT NULL THEN
      v_desde_g := public.periodo_desde(p_fecha, v_regla.periodo_grupo_dias);
      v_hasta_g := public.periodo_hasta(p_fecha, v_regla.periodo_grupo_dias);
      v_cons_g  := public.consumo_prestaciones(
                     p_paciente_id, v_desde_g, v_hasta_g,
                     NULL, v_regla.grupo_id, p_excluir_prestacion_id);
      v_extra_g := public.excepcion_extra(
                     p_paciente_id, p_codigo_practica, v_regla.grupo_id, p_fecha);

      IF v_permitido AND v_cons_g + v_cantidad > v_lim_g + v_extra_g THEN
        v_permitido := false;
        v_motivo := 'grupo';
        v_mensaje := format(
          'Tope por grupo alcanzado: %s permite %s cada %s días. Consumido %s, solicitado %s%s. Período %s al %s.',
          v_regla.grupo_nombre,
          v_lim_g,
          v_regla.periodo_grupo_dias,
          v_cons_g,
          v_cantidad,
          CASE WHEN v_extra_g > 0 THEN format(' (incluye %s por excepción)', v_extra_g) ELSE '' END,
          to_char(v_desde_g, 'DD/MM/YYYY'),
          to_char(v_hasta_g, 'DD/MM/YYYY')
        );
      END IF;
    END IF;

    v_grupo := jsonb_build_object(
      'grupo_id', v_regla.grupo_id,
      'grupo_codigo', v_regla.grupo_codigo,
      'grupo_nombre', v_regla.grupo_nombre,
      'ambito', v_regla.ambito,
      'limite_practica', v_lim_p,
      'periodo_practica_dias', v_regla.periodo_practica_dias,
      'consumido_practica', v_cons_p,
      'restante_practica', CASE WHEN v_lim_p IS NULL THEN NULL::integer
                                ELSE GREATEST(v_lim_p + COALESCE(v_extra_p, 0) - COALESCE(v_cons_p, 0), 0) END,
      'desde_practica', v_desde_p,
      'hasta_practica', v_hasta_p,
      'limite_grupo', v_lim_g,
      'periodo_grupo_dias', v_regla.periodo_grupo_dias,
      'consumido_grupo', v_cons_g,
      'restante_grupo', CASE WHEN v_lim_g IS NULL THEN NULL::integer
                             ELSE GREATEST(v_lim_g + COALESCE(v_extra_g, 0) - COALESCE(v_cons_g, 0), 0) END,
      'desde_grupo', v_desde_g,
      'hasta_grupo', v_hasta_g,
      'excepcion_practica', COALESCE(v_extra_p, 0),
      'excepcion_grupo', COALESCE(v_extra_g, 0)
    );
    v_grupos := v_grupos || jsonb_build_array(v_grupo);
  END LOOP;

  IF v_reglas = 0 THEN
    v_motivo := 'sin_regla';
    v_mensaje := format(
      'La práctica %s no tiene grupo ni tope configurado; se autoriza sin control de cupo.',
      p_codigo_practica
    );
  END IF;

  v_res := jsonb_build_object(
    'permitido', v_permitido,
    'motivo', v_motivo,
    'mensaje', v_mensaje,
    'paciente_id', p_paciente_id,
    'dni', v_pac.dni,
    'codigo_practica', p_codigo_practica,
    'cantidad', v_cantidad,
    'fecha', p_fecha,
    'cupo_mensual', jsonb_build_object(
      'limite', v_max_mes,
      'consumido', v_cons_aut,
      'excepcion', v_extra_glob
    ),
    'reglas', v_grupos
  );

  PERFORM public.registrar_validacion(
    p_paciente_id, p_codigo_practica, v_cantidad, v_res, p_log);

  RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_validacion(
  p_paciente_id integer,
  p_codigo_practica text,
  p_cantidad integer,
  p_resultado jsonb,
  p_log boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(p_log, false) THEN
    RETURN;
  END IF;

  INSERT INTO public.validaciones_prestacion_log (
    paciente_id, codigo_practica, cantidad, permitido, motivo, detalle, usuario_id
  ) VALUES (
    p_paciente_id,
    p_codigo_practica,
    p_cantidad,
    COALESCE((p_resultado ->> 'permitido')::boolean, false),
    p_resultado ->> 'motivo',
    p_resultado,
    auth.uid()
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Resumen para la UI: consumo y restante por grupo aplicable al paciente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resumen_consumos_paciente(
  p_paciente_id integer,
  p_fecha date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mendoza boolean;
  v_res     jsonb;
BEGIN
  IF NOT public.es_usuario_interno() THEN
    RAISE EXCEPTION 'No tiene permisos para consultar consumos.'
      USING ERRCODE = '42501';
  END IF;

  SELECT UPPER(COALESCE(provincia, '')) LIKE '%MENDOZA%'
      OR UPPER(COALESCE(localidad, '')) LIKE '%MENDOZA%'
    INTO v_mendoza
    FROM public.pacientes
   WHERE id = p_paciente_id;

  SELECT COALESCE(jsonb_agg(item ORDER BY item ->> 'grupo_nombre'), '[]'::jsonb)
    INTO v_res
    FROM (
      SELECT jsonb_build_object(
        'grupo_id', g.id,
        'grupo_codigo', g.codigo,
        'grupo_nombre', g.nombre,
        'ambito', g.ambito,
        'limite_grupo', g.limite_grupo,
        'periodo_grupo_dias', g.periodo_grupo_dias,
        'desde', public.periodo_desde(p_fecha, COALESCE(g.periodo_grupo_dias, 365)),
        'hasta', public.periodo_hasta(p_fecha, COALESCE(g.periodo_grupo_dias, 365)),
        'consumido_grupo', CASE
          WHEN g.limite_grupo IS NULL THEN NULL::integer
          ELSE public.consumo_prestaciones(
                 p_paciente_id,
                 public.periodo_desde(p_fecha, COALESCE(g.periodo_grupo_dias, 365)),
                 public.periodo_hasta(p_fecha, COALESCE(g.periodo_grupo_dias, 365)),
                 NULL, g.id, NULL)
        END,
        'restante_grupo', CASE
          WHEN g.limite_grupo IS NULL THEN NULL::integer
          ELSE GREATEST(
                 g.limite_grupo + public.excepcion_extra(p_paciente_id, NULL, g.id, p_fecha)
                 - public.consumo_prestaciones(
                     p_paciente_id,
                     public.periodo_desde(p_fecha, COALESCE(g.periodo_grupo_dias, 365)),
                     public.periodo_hasta(p_fecha, COALESCE(g.periodo_grupo_dias, 365)),
                     NULL, g.id, NULL),
                 0)
        END
      ) AS item
        FROM public.cobertura_grupos g
       WHERE g.activo
         AND (g.ambito = 'general' OR (g.ambito = 'solo_mendoza' AND COALESCE(v_mendoza, false)))
    ) s;

  RETURN COALESCE(v_res, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.fecha_efectiva(date, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.periodo_desde(date, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.periodo_hasta(date, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.paciente_ids_por_dni(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consumo_prestaciones(integer, date, date, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consumo_autorizaciones(integer, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excepcion_extra(integer, text, integer, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excepcion_extra_global(integer, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_usuario_interno() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_prestacion(integer, text, integer, date, text, integer, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_validacion(integer, text, integer, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resumen_consumos_paciente(integer, date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fecha_efectiva(date, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.periodo_desde(date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.periodo_hasta(date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.paciente_ids_por_dni(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consumo_prestaciones(integer, date, date, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consumo_autorizaciones(integer, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.excepcion_extra(integer, text, integer, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.excepcion_extra_global(integer, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.es_usuario_interno() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validar_prestacion(integer, text, integer, date, text, integer, integer, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resumen_consumos_paciente(integer, date) TO authenticated, service_role;
