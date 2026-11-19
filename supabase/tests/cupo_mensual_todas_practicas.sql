-- Run through the migration tool. The inner exception block rolls back all
-- fixtures, including successful authorizations; failures are rethrown.
DO $$
DECLARE p integer; a integer; b integer; r jsonb; blocked boolean; next_month date;
BEGIN
 BEGIN
  INSERT INTO public.pacientes(nombre,apellido,activo,estado_padron,consultas_maximas)
  VALUES('TEST CUPO','ROLLBACK',true,'Activo',999) RETURNING id INTO p;
  IF (SELECT consultas_maximas FROM public.pacientes WHERE id=p)<>2 THEN
   RAISE EXCEPTION 'Future patients must have limit 2 even if imported as 999'; END IF;

  a:=public.crear_autorizacion(jsonb_build_object('paciente_id',p,'tipo_autorizacion','consulta','prestaciones',jsonb_build_array(jsonb_build_object('prestacion_codigo','TEST_NO_GROUP_A','prestacion_descripcion','TEST','cantidad',1))));
  r:=public.cupo_mensual_paciente(p);
  IF (r->>'consumido')::integer<>1 OR (r->>'restante')::integer<>1 OR (r->>'limite')::integer<>2 THEN
   RAISE EXCEPTION 'One consumed must leave one of two: %',r; END IF;

  b:=public.crear_autorizacion(jsonb_build_object('paciente_id',p,'tipo_autorizacion','laboratorio','prestaciones',jsonb_build_array(jsonb_build_object('prestacion_codigo','TEST_NO_GROUP_B','prestacion_descripcion','TEST','cantidad',1))));
  r:=public.validar_prestacion(p,'TEST_NO_GROUP_C',1,CURRENT_DATE,NULL,NULL,NULL,false);
  IF (r->>'permitido')::boolean OR r->>'motivo'<>'cupo_mensual' THEN
   RAISE EXCEPTION 'Unmapped practice must block at 2 shared units: %',r; END IF;
  blocked:=false;
  BEGIN
   PERFORM public.crear_autorizacion(jsonb_build_object('paciente_id',p,'tipo_autorizacion','estudio','prestaciones',jsonb_build_array(jsonb_build_object('prestacion_codigo','TEST_NO_GROUP_C','prestacion_descripcion','TEST','cantidad',1))));
  EXCEPTION WHEN SQLSTATE 'P0001' THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Third practice was saved'; END IF;

  -- Editing an existing line must not count that line twice.
  UPDATE public.autorizacion_prestaciones SET cantidad=1 WHERE autorizacion_id=b;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  next_month:=(date_trunc('month',CURRENT_DATE)+interval '1 month')::date;
  r:=public.validar_prestacion(p,'TEST_NO_GROUP_C',2,next_month,NULL,NULL,NULL,false);
  IF NOT (r->>'permitido')::boolean OR (r->'cupo_mensual'->>'consumido')::integer<>0 THEN
   RAISE EXCEPTION 'All practices reset on first of month: %',r; END IF;
  r:=public.validar_prestacion(p,'TEST_NO_GROUP_C',3,next_month,NULL,NULL,NULL,false);
  IF (r->>'permitido')::boolean THEN RAISE EXCEPTION 'Quantity 3 bypasses maximum 2'; END IF;

  blocked:=false;
  BEGIN
   INSERT INTO public.autorizaciones(paciente_id,tipo_autorizacion,estado,fecha_solicitud)
   VALUES(p,'tratamiento','aprobada',CURRENT_DATE);
   SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Empty authorization bypasses shared limit'; END IF;

  INSERT INTO public.cobertura_excepciones(paciente_id,cantidad_extra,vigente_desde,justificacion,responsable_id)
  VALUES(p,1,CURRENT_DATE,'TEST ROLLBACK','00000000-0000-0000-0000-000000000000');
  r:=public.validar_prestacion(p,'TEST_NO_GROUP_C',1,CURRENT_DATE,NULL,NULL,NULL,false);
  IF NOT (r->>'permitido')::boolean THEN RAISE EXCEPTION 'Recorded global exception did not extend limit: %',r; END IF;

  UPDATE public.autorizaciones SET estado='rechazada' WHERE id=b;
  r:=public.cupo_mensual_paciente(p);
  IF (r->>'consumido')::integer<>1 THEN RAISE EXCEPTION 'Rejected practice still consumes: %',r; END IF;
  SET CONSTRAINTS ALL IMMEDIATE;
  RAISE EXCEPTION 'ROLLBACK_TEST_SUCCESS' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN
  RAISE NOTICE 'PASS: shared limit 2, unmapped/mixed practices, quantities, edits, empty headers, monthly reset, exceptions, rejected states';
 END;
END $$;