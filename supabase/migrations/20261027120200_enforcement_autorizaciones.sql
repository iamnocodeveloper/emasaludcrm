-- Enforcement atómico de los topes.
-- Capa 1: trigger sobre autorizacion_prestaciones (cubre cualquier vía de escritura).
-- Capa 2: RPC crear_autorizacion (una sola transacción para cabecera + prestaciones).
-- Capa 3: trigger sobre autorizaciones para que el contador legacy de consultas
--         refleje datos reales (hoy nunca se actualizaba).

-- ---------------------------------------------------------------------------
-- Helper: estado que consume cupo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.autorizacion_consume_cupo(
  p_estado text,
  p_activa boolean
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_activa, true)
     AND COALESCE(p_estado, 'pendiente') IN ('pendiente', 'aprobada');
$$;

-- ---------------------------------------------------------------------------
-- Capa 1: validación por fila de prestación
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_prestacion_fila()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id integer;
  v_estado      text;
  v_activa      boolean;
  v_resultado   jsonb;
  v_excluir     integer;
BEGIN
  SELECT a.paciente_id, a.estado, a.activa
    INTO v_paciente_id, v_estado, v_activa
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

  v_resultado := public.validar_prestacion(
    v_paciente_id,
    NEW.prestacion_codigo,
    COALESCE(NEW.cantidad, 1),
    CURRENT_DATE,
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

DROP TRIGGER IF EXISTS validar_tope_prestacion ON public.autorizacion_prestaciones;
CREATE TRIGGER validar_tope_prestacion
  BEFORE INSERT OR UPDATE OF prestacion_codigo, cantidad, autorizacion_id
  ON public.autorizacion_prestaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_prestacion_fila();

-- ---------------------------------------------------------------------------
-- Capa 2: alta transaccional de autorización + prestaciones
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_autorizacion(p_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id      integer := NULLIF(p_payload ->> 'paciente_id', '')::integer;
  v_autorizacion_id  integer;
  v_prestacion       jsonb;
  v_estado           text := COALESCE(NULLIF(p_payload ->> 'estado', ''), 'pendiente');
  v_cantidad         integer;
BEGIN
  IF NOT public.es_usuario_interno() THEN
    RAISE EXCEPTION 'No tiene permisos para autorizar prestaciones.'
      USING ERRCODE = '42501';
  END IF;

  IF v_paciente_id IS NULL THEN
    RAISE EXCEPTION 'Debe indicar el paciente de la autorización.'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('tope_prestacion:' || v_paciente_id::text, 0));

  INSERT INTO public.autorizaciones (
    paciente_id,
    medico_id,
    obra_social_id,
    tipo_autorizacion,
    descripcion,
    fecha_solicitud,
    fecha_vencimiento,
    estado,
    numero_autorizacion,
    observaciones,
    documento_url,
    numero_credencial,
    parentesco_beneficiario,
    profesional_solicitante,
    prestador,
    copago,
    created_by_user_id
  ) VALUES (
    v_paciente_id,
    NULLIF(p_payload ->> 'medico_id', '')::integer,
    NULLIF(p_payload ->> 'obra_social_id', '')::integer,
    COALESCE(NULLIF(p_payload ->> 'tipo_autorizacion', ''), 'consulta'),
    NULLIF(p_payload ->> 'descripcion', ''),
    COALESCE(NULLIF(p_payload ->> 'fecha_solicitud', '')::date, CURRENT_DATE),
    NULLIF(p_payload ->> 'fecha_vencimiento', '')::date,
    v_estado,
    NULLIF(p_payload ->> 'numero_autorizacion', ''),
    NULLIF(p_payload ->> 'observaciones', ''),
    NULLIF(p_payload ->> 'documento_url', ''),
    NULLIF(p_payload ->> 'numero_credencial', ''),
    NULLIF(p_payload ->> 'parentesco_beneficiario', ''),
    NULLIF(p_payload ->> 'profesional_solicitante', ''),
    NULLIF(p_payload ->> 'prestador', ''),
    NULLIF(p_payload ->> 'copago', '')::numeric,
    COALESCE(auth.uid(), NULLIF(p_payload ->> 'created_by_user_id', '')::uuid)
  )
  RETURNING id INTO v_autorizacion_id;

  FOR v_prestacion IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payload -> 'prestaciones', '[]'::jsonb))
  LOOP
    IF COALESCE(v_prestacion ->> 'prestacion_codigo', '') = '' THEN
      CONTINUE;
    END IF;

    v_cantidad := GREATEST(COALESCE(NULLIF(v_prestacion ->> 'cantidad', '')::integer, 1), 1);

    INSERT INTO public.autorizacion_prestaciones (
      autorizacion_id,
      prestacion_codigo,
      prestacion_descripcion,
      cantidad,
      observaciones
    ) VALUES (
      v_autorizacion_id,
      v_prestacion ->> 'prestacion_codigo',
      COALESCE(NULLIF(v_prestacion ->> 'prestacion_descripcion', ''), ''),
      v_cantidad,
      NULLIF(v_prestacion ->> 'observaciones', '')
    );
  END LOOP;

  RETURN v_autorizacion_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Actualización transaccional: si el nuevo lote supera un tope, se revierte
-- todo y no se pierden las prestaciones anteriores.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.actualizar_autorizacion(
  p_id integer,
  p_payload jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id integer;
  v_prestacion  jsonb;
BEGIN
  IF NOT public.es_usuario_interno() THEN
    RAISE EXCEPTION 'No tiene permisos para modificar autorizaciones.'
      USING ERRCODE = '42501';
  END IF;

  SELECT paciente_id INTO v_paciente_id
    FROM public.autorizaciones
   WHERE id = p_id;

  IF v_paciente_id IS NULL THEN
    RAISE EXCEPTION 'La autorización % no existe.', p_id
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('tope_prestacion:' || v_paciente_id::text, 0));

  UPDATE public.autorizaciones SET
    medico_id = CASE WHEN jsonb_exists(p_payload, 'medico_id')
                     THEN NULLIF(p_payload ->> 'medico_id', '')::integer
                     ELSE medico_id END,
    obra_social_id = CASE WHEN jsonb_exists(p_payload, 'obra_social_id')
                          THEN NULLIF(p_payload ->> 'obra_social_id', '')::integer
                          ELSE obra_social_id END,
    tipo_autorizacion = CASE WHEN jsonb_exists(p_payload, 'tipo_autorizacion')
                             THEN COALESCE(NULLIF(p_payload ->> 'tipo_autorizacion', ''), tipo_autorizacion)
                             ELSE tipo_autorizacion END,
    descripcion = CASE WHEN jsonb_exists(p_payload, 'descripcion')
                       THEN NULLIF(p_payload ->> 'descripcion', '')
                       ELSE descripcion END,
    fecha_vencimiento = CASE WHEN jsonb_exists(p_payload, 'fecha_vencimiento')
                             THEN NULLIF(p_payload ->> 'fecha_vencimiento', '')::date
                             ELSE fecha_vencimiento END,
    estado = CASE WHEN jsonb_exists(p_payload, 'estado')
                  THEN COALESCE(NULLIF(p_payload ->> 'estado', ''), estado)
                  ELSE estado END,
    numero_autorizacion = CASE WHEN jsonb_exists(p_payload, 'numero_autorizacion')
                               THEN NULLIF(p_payload ->> 'numero_autorizacion', '')
                               ELSE numero_autorizacion END,
    observaciones = CASE WHEN jsonb_exists(p_payload, 'observaciones')
                         THEN NULLIF(p_payload ->> 'observaciones', '')
                         ELSE observaciones END,
    numero_credencial = CASE WHEN jsonb_exists(p_payload, 'numero_credencial')
                             THEN NULLIF(p_payload ->> 'numero_credencial', '')
                             ELSE numero_credencial END,
    parentesco_beneficiario = CASE WHEN jsonb_exists(p_payload, 'parentesco_beneficiario')
                                   THEN NULLIF(p_payload ->> 'parentesco_beneficiario', '')
                                   ELSE parentesco_beneficiario END,
    profesional_solicitante = CASE WHEN jsonb_exists(p_payload, 'profesional_solicitante')
                                   THEN NULLIF(p_payload ->> 'profesional_solicitante', '')
                                   ELSE profesional_solicitante END,
    prestador = CASE WHEN jsonb_exists(p_payload, 'prestador')
                     THEN NULLIF(p_payload ->> 'prestador', '')
                     ELSE prestador END,
    copago = CASE WHEN jsonb_exists(p_payload, 'copago')
                  THEN NULLIF(p_payload ->> 'copago', '')::numeric
                  ELSE copago END,
    documento_url = CASE WHEN jsonb_exists(p_payload, 'documento_url')
                         THEN COALESCE(NULLIF(p_payload ->> 'documento_url', ''), documento_url)
                         ELSE documento_url END,
    updated_at = now()
  WHERE id = p_id;

  IF jsonb_exists(p_payload, 'prestaciones') THEN
    DELETE FROM public.autorizacion_prestaciones WHERE autorizacion_id = p_id;

    FOR v_prestacion IN
      SELECT value FROM jsonb_array_elements(COALESCE(p_payload -> 'prestaciones', '[]'::jsonb))
    LOOP
      IF COALESCE(v_prestacion ->> 'prestacion_codigo', '') = '' THEN
        CONTINUE;
      END IF;

      INSERT INTO public.autorizacion_prestaciones (
        autorizacion_id,
        prestacion_codigo,
        prestacion_descripcion,
        cantidad,
        observaciones
      ) VALUES (
        p_id,
        v_prestacion ->> 'prestacion_codigo',
        COALESCE(NULLIF(v_prestacion ->> 'prestacion_descripcion', ''), ''),
        GREATEST(COALESCE(NULLIF(v_prestacion ->> 'cantidad', '')::integer, 1), 1),
        NULLIF(v_prestacion ->> 'observaciones', '')
      );
    END LOOP;
  END IF;

  RETURN p_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Aprobación posterior: revalida el lote al pasar de rechazada/vencida a un
-- estado que consume cupo, para que no exista una vía de escape.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_autorizacion_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prestacion record;
  v_resultado  jsonb;
BEGIN
  IF NOT public.autorizacion_consume_cupo(NEW.estado, NEW.activa) THEN
    RETURN NEW;
  END IF;

  IF public.autorizacion_consume_cupo(OLD.estado, OLD.activa) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('tope_prestacion:' || NEW.paciente_id::text, 0));

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
      CURRENT_DATE,
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

DROP TRIGGER IF EXISTS validar_estado_autorizacion ON public.autorizaciones;
CREATE TRIGGER validar_estado_autorizacion
  AFTER UPDATE OF estado, activa
  ON public.autorizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_autorizacion_estado();

-- ---------------------------------------------------------------------------
-- Contador legacy de consultas del mes (solo para visualización).
-- La fuente de verdad de los cupos son las reglas de cobertura.
-- ---------------------------------------------------------------------------
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
            AND public.fecha_efectiva(a.fecha_solicitud, a.created_at) BETWEEN v_desde AND v_hasta
       )
     WHERE p.id = NEW.paciente_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_consultas_mes_actual_trigger ON public.autorizaciones;
CREATE TRIGGER sync_consultas_mes_actual_trigger
  AFTER INSERT OR UPDATE OF estado, activa, fecha_solicitud, paciente_id OR DELETE
  ON public.autorizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_consultas_mes_actual();

REVOKE ALL ON FUNCTION public.autorizacion_consume_cupo(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_prestacion_fila() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_autorizacion_estado() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_consultas_mes_actual() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_autorizacion(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_autorizacion(integer, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.autorizacion_consume_cupo(text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crear_autorizacion(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.actualizar_autorizacion(integer, jsonb) TO authenticated, service_role;
