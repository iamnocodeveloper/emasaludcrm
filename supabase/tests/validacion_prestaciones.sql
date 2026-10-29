-- Pruebas del motor de validación de prestaciones.
-- Se ejecuta contra la base real (o una copia) y NO deja datos:
-- todo el script vive dentro de una transacción que termina en ROLLBACK.
--
-- Con Supabase CLI:
--   supabase db execute --file supabase/tests/validacion_prestaciones.sql
-- Con psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/validacion_prestaciones.sql
--
-- Si un assert falla, la transacción se aborta y no se comitea nada.

BEGIN;

CREATE TEMP TABLE test_ctx (clave text PRIMARY KEY, valor text) ON COMMIT DROP;

-- ---------------------------------------------------------------------------
-- Preparación: paciente, grupo Ecografía (2/30 + 4/365) y cuatro prácticas.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_paciente integer;
  v_grupo    integer;
BEGIN
  INSERT INTO public.pacientes (dni, nombre, apellido, activo, estado_padron, provincia)
  VALUES ('99000001', 'TEST', 'TOPES', true, 'Activo', 'Mendoza')
  RETURNING id INTO v_paciente;

  INSERT INTO test_ctx VALUES ('paciente', v_paciente::text);

  SELECT id INTO v_grupo FROM public.cobertura_grupos WHERE codigo = 'ECOGRAFIA';

  INSERT INTO public.cobertura_practicas (codigo_practica, grupo_id)
  VALUES ('T9901', v_grupo), ('T9902', v_grupo), ('T9903', v_grupo), ('T9904', v_grupo);

  SELECT id INTO v_grupo FROM public.cobertura_grupos WHERE codigo = 'RX_1';
  INSERT INTO public.cobertura_practicas (codigo_practica, grupo_id) VALUES ('T9905', v_grupo);
END $$;

-- ---------------------------------------------------------------------------
-- Caso 1: dos ecografías en el mes están permitidas; la tercera se bloquea.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac integer := (SELECT valor::integer FROM test_ctx WHERE clave = 'paciente');
  v_id  integer;
  v_res jsonb;
BEGIN
  FOR i IN 1..2 LOOP
    v_id := public.crear_autorizacion(jsonb_build_object(
      'paciente_id', v_pac,
      'tipo_autorizacion', 'estudio',
      'estado', 'pendiente',
      'prestaciones', jsonb_build_array(jsonb_build_object(
        'prestacion_codigo', 'T9901',
        'prestacion_descripcion', 'ECOGRAFIA TEST',
        'cantidad', 1))
    ));
  END LOOP;

  v_res := public.validar_prestacion(v_pac, 'T9901', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CASO 1 FALLO: la tercera ecografía debería bloquearse. %', v_res;
  END IF;
  IF v_res ->> 'motivo' <> 'practica' THEN
    RAISE EXCEPTION 'CASO 1 FALLO: motivo esperado "practica", obtenido "%".', v_res ->> 'motivo';
  END IF;

  -- El trigger debe rechazar el insert directo, no solo el validador.
  DECLARE
    v_bloqueado boolean := false;
  BEGIN
    BEGIN
      v_id := public.crear_autorizacion(jsonb_build_object(
        'paciente_id', v_pac,
        'tipo_autorizacion', 'estudio',
        'estado', 'pendiente',
        'prestaciones', jsonb_build_array(jsonb_build_object(
          'prestacion_codigo', 'T9901',
          'prestacion_descripcion', 'ECOGRAFIA TEST',
          'cantidad', 1))
      ));
    EXCEPTION
      WHEN SQLSTATE 'P0001' THEN
        v_bloqueado := true;
    END;

    IF NOT v_bloqueado THEN
      RAISE EXCEPTION 'CASO 1 FALLO: la tercera autorización no fue bloqueada por el trigger.';
    END IF;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 2: el tope de grupo (4 por año) se aplica con prácticas distintas.
-- Ya hay 2 de T9901; se agregan T9902 y T9903 y la quinta se bloquea.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac integer := (SELECT valor::integer FROM test_ctx WHERE clave = 'paciente');
  v_res jsonb;
  v_codigo text;
BEGIN
  FOREACH v_codigo IN ARRAY ARRAY['T9902', 'T9903'] LOOP
    PERFORM public.crear_autorizacion(jsonb_build_object(
      'paciente_id', v_pac,
      'tipo_autorizacion', 'estudio',
      'estado', 'pendiente',
      'prestaciones', jsonb_build_array(jsonb_build_object(
        'prestacion_codigo', v_codigo,
        'prestacion_descripcion', 'PRACTICA TEST',
        'cantidad', 1))
    ));
  END LOOP;

  v_res := public.validar_prestacion(v_pac, 'T9904', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CASO 2 FALLO: la quinta prestación del grupo debería bloquearse. %', v_res;
  END IF;
  IF v_res ->> 'motivo' <> 'grupo' THEN
    RAISE EXCEPTION 'CASO 2 FALLO: motivo esperado "grupo", obtenido "%".', v_res ->> 'motivo';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 3: una excepción vigente habilita el cupo extra; una vencida no.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac   integer := (SELECT valor::integer FROM test_ctx WHERE clave = 'paciente');
  v_grupo integer;
  v_res   jsonb;
BEGIN
  SELECT id INTO v_grupo FROM public.cobertura_grupos WHERE codigo = 'ECOGRAFIA';

  INSERT INTO public.cobertura_excepciones (
    paciente_id, grupo_id, cantidad_extra, vigente_desde, justificacion, responsable_id
  ) VALUES (v_pac, v_grupo, 1, CURRENT_DATE - 1, 'Excepción de prueba vigente',
            '00000000-0000-0000-0000-000000000000');

  v_res := public.validar_prestacion(v_pac, 'T9904', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'CASO 3 FALLO: la excepción vigente debería habilitar el cupo. %', v_res;
  END IF;

  -- Vencida: se anula la vigente y se deja solo una excepción pasada.
  UPDATE public.cobertura_excepciones SET activo = false WHERE paciente_id = v_pac;
  INSERT INTO public.cobertura_excepciones (
    paciente_id, grupo_id, cantidad_extra, vigente_desde, vigente_hasta, justificacion, responsable_id
  ) VALUES (v_pac, v_grupo, 1, CURRENT_DATE - 30, CURRENT_DATE - 10,
            'Excepción de prueba vencida', '00000000-0000-0000-0000-000000000000');

  v_res := public.validar_prestacion(v_pac, 'T9904', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CASO 3 FALLO: una excepción vencida no debe habilitar cupo. %', v_res;
  END IF;

  DELETE FROM public.cobertura_excepciones WHERE paciente_id = v_pac;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 4: un registro histórico con el mismo DNI no duplica ni fragmenta el cupo.
-- La base ya impide dos registros ACTIVOS con el mismo DNI
-- (índice parcial unique_active_patient_dni), así que se prueba con uno inactivo.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac    integer := (SELECT valor::integer FROM test_ctx WHERE clave = 'paciente');
  v_pac2   integer;
  v_ids    integer[];
  v_consumo integer;
  v_res    jsonb;
BEGIN
  INSERT INTO public.pacientes (dni, nombre, apellido, activo, estado_padron, provincia)
  VALUES ('99000001', 'TEST', 'TOPES HISTORICO', false, 'BAJA', 'Mendoza')
  RETURNING id INTO v_pac2;

  v_ids := public.paciente_ids_por_dni(v_pac);
  IF array_length(v_ids, 1) <> 2 THEN
    RAISE EXCEPTION 'CASO 4 FALLO: se esperaban 2 registros para el DNI, obtenidos %.', v_ids;
  END IF;

  v_consumo := public.consumo_prestaciones(
    v_pac2,
    public.periodo_desde(CURRENT_DATE, 30),
    public.periodo_hasta(CURRENT_DATE, 30),
    'T9901', NULL, NULL);

  IF v_consumo <> 2 THEN
    RAISE EXCEPTION 'CASO 4 FALLO: el consumo del registro histórico debería ser 2, fue %.', v_consumo;
  END IF;

  -- El registro inactivo no puede autorizar: lo frena el padrón.
  v_res := public.validar_prestacion(v_pac2, 'T9901', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CASO 4 FALLO: el registro histórico inactivo no debe autorizar. %', v_res;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 5: DNI que no coincide con el registro → bloqueo por identidad.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac integer := (SELECT valor::integer FROM test_ctx WHERE clave = 'paciente');
  v_res jsonb;
BEGIN
  v_res := public.validar_prestacion(v_pac, 'T9902', 1, CURRENT_DATE, '12345678', NULL, NULL, false);
  IF (v_res ->> 'motivo') <> 'identidad' THEN
    RAISE EXCEPTION 'CASO 5 FALLO: se esperaba motivo "identidad", obtenido "%".', v_res ->> 'motivo';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 6: paciente dado de baja en el padrón → bloqueo.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac integer;
  v_res jsonb;
BEGIN
  INSERT INTO public.pacientes (dni, nombre, apellido, activo, estado_padron, provincia)
  VALUES ('99000002', 'TEST', 'BAJA', true, 'BAJA', 'Mendoza')
  RETURNING id INTO v_pac;

  v_res := public.validar_prestacion(v_pac, 'T9901', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'motivo') <> 'padron' THEN
    RAISE EXCEPTION 'CASO 6 FALLO: se esperaba motivo "padron", obtenido "%".', v_res ->> 'motivo';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 7: práctica sin regla → se autoriza y queda registrada como sin_regla.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac integer := (SELECT valor::integer FROM test_ctx WHERE clave = 'paciente');
  v_res jsonb;
BEGIN
  v_res := public.validar_prestacion(v_pac, 'SIN_REGLA_999', 1, CURRENT_DATE, NULL, NULL, NULL, true);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'CASO 7 FALLO: una práctica sin regla no debe bloquearse. %', v_res;
  END IF;
  IF (v_res ->> 'motivo') <> 'sin_regla' THEN
    RAISE EXCEPTION 'CASO 7 FALLO: motivo esperado "sin_regla", obtenido "%".', v_res ->> 'motivo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.validaciones_prestacion_log
     WHERE paciente_id = v_pac AND codigo_practica = 'SIN_REGLA_999'
  ) THEN
    RAISE EXCEPTION 'CASO 7 FALLO: no se registró la validación en el log.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 8: RX_1 (4 por día calendario) se reinicia al día siguiente.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac integer := (SELECT valor::integer FROM test_ctx WHERE clave = 'paciente');
  v_res jsonb;
BEGIN
  v_res := public.validar_prestacion(v_pac, 'T9905', 4, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'CASO 8 FALLO: 4 RX en el día deberían permitirse. %', v_res;
  END IF;

  v_res := public.validar_prestacion(v_pac, 'T9905', 1, CURRENT_DATE + 1, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'CASO 8 FALLO: el día siguiente debe reiniciar el cupo. %', v_res;
  END IF;

  PERFORM public.crear_autorizacion(jsonb_build_object(
    'paciente_id', v_pac,
    'tipo_autorizacion', 'estudio',
    'estado', 'pendiente',
    'prestaciones', jsonb_build_array(jsonb_build_object(
      'prestacion_codigo', 'T9905',
      'prestacion_descripcion', 'RX TEST',
      'cantidad', 4))
  ));

  v_res := public.validar_prestacion(v_pac, 'T9905', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CASO 8 FALLO: la quinta RX del día debería bloquearse. %', v_res;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 9: rechazada/anulada no consume; aprobarla después sí se valida.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac integer;
  v_id  integer;
  v_res jsonb;
BEGIN
  INSERT INTO public.pacientes (dni, nombre, apellido, activo, estado_padron)
  VALUES ('99000003', 'TEST', 'RECHAZADA', true, 'Activo')
  RETURNING id INTO v_pac;

  v_id := public.crear_autorizacion(jsonb_build_object(
    'paciente_id', v_pac,
    'tipo_autorizacion', 'estudio',
    'estado', 'rechazada',
    'prestaciones', jsonb_build_array(jsonb_build_object(
      'prestacion_codigo', 'T9901',
      'prestacion_descripcion', 'ECOGRAFIA TEST',
      'cantidad', 2))
  ));

  v_res := public.validar_prestacion(v_pac, 'T9901', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'CASO 9 FALLO: una autorización rechazada no debe consumir cupo. %', v_res;
  END IF;

  UPDATE public.autorizaciones SET estado = 'aprobada' WHERE id = v_id;

  v_res := public.validar_prestacion(v_pac, 'T9901', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CASO 9 FALLO: al aprobarla debe consumir el cupo. %', v_res;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 10: cupo mensual asignado (pacientes.consultas_maximas).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac integer;
  v_res jsonb;
  v_bloqueado boolean := false;
BEGIN
  INSERT INTO public.pacientes (dni, nombre, apellido, activo, estado_padron, consultas_maximas)
  VALUES ('99000004', 'TEST', 'CUPO', true, 'Activo', 1)
  RETURNING id INTO v_pac;

  PERFORM public.crear_autorizacion(jsonb_build_object(
    'paciente_id', v_pac,
    'tipo_autorizacion', 'consulta',
    'estado', 'pendiente',
    'prestaciones', jsonb_build_array(jsonb_build_object(
      'prestacion_codigo', 'T9901',
      'prestacion_descripcion', 'ECOGRAFIA TEST',
      'cantidad', 1))
  ));

  BEGIN
    PERFORM public.crear_autorizacion(jsonb_build_object(
      'paciente_id', v_pac,
      'tipo_autorizacion', 'consulta',
      'estado', 'pendiente',
      'prestaciones', jsonb_build_array(jsonb_build_object(
        'prestacion_codigo', 'T9901',
        'prestacion_descripcion', 'ECOGRAFIA TEST',
        'cantidad', 1))
    ));
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_bloqueado := true;
  END;

  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'CASO 10 FALLO: el cupo mensual debería bloquear la segunda autorización.';
  END IF;

  -- La excepción global amplía el cupo mensual.
  INSERT INTO public.cobertura_excepciones (
    paciente_id, cantidad_extra, vigente_desde, justificacion, responsable_id
  ) VALUES (v_pac, 1, CURRENT_DATE, 'Excepción de cupo mensual',
            '00000000-0000-0000-0000-000000000000');

  v_res := public.validar_prestacion(v_pac, 'T9901', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'motivo') = 'cupo_mensual' THEN
    RAISE EXCEPTION 'CASO 10 FALLO: la excepción global no amplió el cupo mensual. %', v_res;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 11: la variante "sólo Mendoza" se aplica según la provincia.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_general integer;
  v_mza     integer;
  v_pac_mza integer;
  v_pac_cba integer;
  v_res     jsonb;
BEGIN
  SELECT id INTO v_general FROM public.cobertura_grupos WHERE codigo = 'POTENCIALES_EVOCADOS';
  SELECT id INTO v_mza FROM public.cobertura_grupos WHERE codigo = 'POTENCIALES_EVOCADOS_MZA';

  INSERT INTO public.cobertura_practicas (codigo_practica, grupo_id)
  VALUES ('T9910', v_general), ('T9910', v_mza);

  INSERT INTO public.pacientes (dni, nombre, apellido, activo, estado_padron, provincia)
  VALUES ('99000005', 'TEST', 'MENDOZA', true, 'Activo', 'Mendoza')
  RETURNING id INTO v_pac_mza;

  INSERT INTO public.pacientes (dni, nombre, apellido, activo, estado_padron, provincia)
  VALUES ('99000006', 'TEST', 'CORDOBA', true, 'Activo', 'Córdoba')
  RETURNING id INTO v_pac_cba;

  v_res := public.validar_prestacion(v_pac_mza, 'T9910', 2, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CASO 11 FALLO: en Mendoza el tope de 1 debería bloquear 2. %', v_res;
  END IF;

  v_res := public.validar_prestacion(v_pac_cba, 'T9910', 2, CURRENT_DATE, NULL, NULL, NULL, false);
  IF (v_res ->> 'permitido')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'CASO 11 FALLO: fuera de Mendoza aplica sólo el tope general de 4. %', v_res;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 12: el cupo mensual cuenta CONSULTAS, no laboratorios ni estudios.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac integer;
  v_res jsonb;
BEGIN
  INSERT INTO public.pacientes (dni, nombre, apellido, activo, estado_padron, consultas_maximas)
  VALUES ('99000007', 'TEST', 'CUPO CONSULTAS', true, 'Activo', 1)
  RETURNING id INTO v_pac;

  -- Un laboratorio no debe consumir el cupo de consultas.
  PERFORM public.crear_autorizacion(jsonb_build_object(
    'paciente_id', v_pac,
    'tipo_autorizacion', 'laboratorio',
    'estado', 'pendiente',
    'prestaciones', jsonb_build_array(jsonb_build_object(
      'prestacion_codigo', 'T9999',
      'prestacion_descripcion', 'LABORATORIO TEST',
      'cantidad', 1))
  ));

  v_res := public.validar_prestacion(v_pac, 'T9999', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF COALESCE((v_res -> 'cupo_mensual' ->> 'consumido')::integer, -1) <> 0 THEN
    RAISE EXCEPTION 'CASO 12 FALLO: el laboratorio no debe consumir cupo de consultas. %', v_res;
  END IF;

  -- La primera consulta consume el único lugar disponible.
  PERFORM public.crear_autorizacion(jsonb_build_object(
    'paciente_id', v_pac,
    'tipo_autorizacion', 'consulta',
    'estado', 'pendiente',
    'prestaciones', jsonb_build_array(jsonb_build_object(
      'prestacion_codigo', 'T9999',
      'prestacion_descripcion', 'CONSULTA TEST',
      'cantidad', 1))
  ));

  v_res := public.validar_prestacion(v_pac, 'T9999', 1, CURRENT_DATE, NULL, NULL, NULL, false);
  IF COALESCE((v_res -> 'cupo_mensual' ->> 'consumido')::integer, -1) <> 1 THEN
    RAISE EXCEPTION 'CASO 12 FALLO: la consulta debe consumir el cupo mensual. %', v_res;
  END IF;

  -- Una segunda consulta en el mismo mes se bloquea.
  BEGIN
    PERFORM public.crear_autorizacion(jsonb_build_object(
      'paciente_id', v_pac,
      'tipo_autorizacion', 'consulta',
      'estado', 'pendiente',
      'prestaciones', jsonb_build_array(jsonb_build_object(
        'prestacion_codigo', 'T9999',
        'prestacion_descripcion', 'CONSULTA TEST',
        'cantidad', 1))
    ));
    RAISE EXCEPTION 'CASO 12 FALLO: la segunda consulta debería bloquearse.';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- Caso 13: una autorización retroactiva se valida contra SU mes, no contra el
-- mes en curso.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pac integer;
BEGIN
  INSERT INTO public.pacientes (dni, nombre, apellido, activo, estado_padron, consultas_maximas)
  VALUES ('99000008', 'TEST', 'RETROACTIVA', true, 'Activo', 1)
  RETURNING id INTO v_pac;

  -- Ocupa el cupo del mes en curso.
  PERFORM public.crear_autorizacion(jsonb_build_object(
    'paciente_id', v_pac,
    'tipo_autorizacion', 'consulta',
    'estado', 'pendiente',
    'prestaciones', jsonb_build_array(jsonb_build_object(
      'prestacion_codigo', 'T9999',
      'prestacion_descripcion', 'CONSULTA TEST',
      'cantidad', 1))
  ));

  -- Una consulta de dos meses atrás no debe bloquearse por el mes en curso.
  PERFORM public.crear_autorizacion(jsonb_build_object(
    'paciente_id', v_pac,
    'tipo_autorizacion', 'consulta',
    'estado', 'pendiente',
    'fecha_solicitud', (CURRENT_DATE - interval '2 months')::date,
    'prestaciones', jsonb_build_array(jsonb_build_object(
      'prestacion_codigo', 'T9999',
      'prestacion_descripcion', 'CONSULTA TEST RETROACTIVA',
      'cantidad', 1))
  ));
END $$;

ROLLBACK;

-- Nota: la concurrencia (dos sesiones autorizando a la vez) se valida con
-- pg_advisory_xact_lock y requiere una prueba manual con dos conexiones.
