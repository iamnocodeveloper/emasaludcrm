-- 1) La validación de topes debe usar la fecha de la autorización, no CURRENT_DATE.
--    Con CURRENT_DATE, cargar una autorización retroactiva (por ejemplo de un mes
--    anterior) se evaluaba contra el período del mes en curso y se bloqueaba con
--    un cupo que esa autorización no consume.
--
-- 2) RPC para que la UI muestre el cupo mensual real del paciente sin depender del
--    contador denormalizado pacientes.consultas_mes_actual.

CREATE OR REPLACE FUNCTION public.validar_prestacion_fila()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id     integer;
  v_estado          text;
  v_activa          boolean;
  v_fecha_solicitud date;
  v_fecha           date;
  v_resultado       jsonb;
  v_excluir         integer;
BEGIN
  SELECT a.paciente_id, a.estado, a.activa, a.fecha_solicitud
    INTO v_paciente_id, v_estado, v_activa, v_fecha_solicitud
    FROM public.autorizaciones a
   WHERE a.id = NEW.autorizacion_id;

  IF v_paciente_id IS NULL THEN
    RAISE EXCEPTION 'La autorización % no existe.', NEW.autorizacion_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Una autorización rechazada, vencida o anulada no consume ni reserva cupo.
  IF NOT public.autorizacion_consume_cupo(v_estado, v_activa) THEN
    RETURN NEW;
  END IF;

  -- Serializa las autorizaciones concurrentes del mismo paciente.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('tope_prestacion:' || v_paciente_id::text, 0));

  IF TG_OP = 'UPDATE' AND OLD.prestacion_codigo = NEW.prestacion_codigo THEN
    v_excluir := OLD.id;
  END IF;

  v_fecha := COALESCE(v_fecha_solicitud, CURRENT_DATE);

  v_resultado := public.validar_prestacion(
    v_paciente_id,
    NEW.prestacion_codigo,
    COALESCE(NEW.cantidad, 1),
    v_fecha,
    NULL,
    v_excluir,
    NEW.autorizacion_id,
    true
  );

  IF NOT COALESCE((v_resultado ->> 'permitido')::boolean, true) THEN
    RAISE EXCEPTION '%', (v_resultado ->> 'mensaje')
      USING ERRCODE = 'P0001',
            HINT = COALESCE(v_resultado ->> 'motivo', 'tope');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_autorizacion_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prestacion record;
  v_resultado  jsonb;
  v_fecha      date;
BEGIN
  IF NOT public.autorizacion_consume_cupo(NEW.estado, NEW.activa) THEN
    RETURN NEW;
  END IF;

  IF public.autorizacion_consume_cupo(OLD.estado, OLD.activa) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('tope_prestacion:' || NEW.paciente_id::text, 0));

  v_fecha := COALESCE(NEW.fecha_solicitud, CURRENT_DATE);

  FOR v_prestacion IN
    SELECT id, prestacion_codigo, cantidad
      FROM public.autorizacion_prestaciones
     WHERE autorizacion_id = NEW.id
     ORDER BY id
  LOOP
    v_resultado := public.validar_prestacion(
      NEW.paciente_id,
      v_prestacion.prestacion_codigo,
      COALESCE(v_prestacion.cantidad, 1),
      v_fecha,
      NULL,
      v_prestacion.id,
      NEW.id,
      true
    );

    IF NOT COALESCE((v_resultado ->> 'permitido')::boolean, true) THEN
      RAISE EXCEPTION '%', (v_resultado ->> 'mensaje')
        USING ERRCODE = 'P0001',
              HINT = COALESCE(v_resultado ->> 'motivo', 'tope');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Cupo mensual de consultas para la UI (misma fuente que el validador).
CREATE OR REPLACE FUNCTION public.cupo_mensual_paciente(
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
  v_limite integer;
  v_consumo integer;
  v_extra  integer;
BEGIN
  IF NOT public.es_usuario_interno() THEN
    RAISE EXCEPTION 'No tiene permisos para consultar consumos.'
      USING ERRCODE = '42501';
  END IF;

  SELECT consultas_maximas INTO v_limite
    FROM public.pacientes
   WHERE id = p_paciente_id;

  v_consumo := public.consumo_autorizaciones(
    p_paciente_id,
    public.periodo_desde(p_fecha, 30),
    public.periodo_hasta(p_fecha, 30));
  v_extra := public.excepcion_extra_global(p_paciente_id, p_fecha);

  RETURN jsonb_build_object(
    'limite', v_limite,
    'consumido', v_consumo,
    'excepcion', v_extra,
    'sin_limite', v_limite IS NULL OR v_limite >= 999,
    'desde', public.periodo_desde(p_fecha, 30),
    'hasta', public.periodo_hasta(p_fecha, 30)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cupo_mensual_paciente(integer, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cupo_mensual_paciente(integer, date) TO authenticated, service_role;
