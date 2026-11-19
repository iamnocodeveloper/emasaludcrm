-- All authorization types share the patient's monthly allowance.
CREATE OR REPLACE FUNCTION public.consumo_mensual_total(p_paciente_id integer, p_desde date, p_hasta date, p_excluir_prestacion_id integer DEFAULT NULL, p_autorizacion_vacia_id integer DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT COALESCE(SUM(CASE WHEN ap.id IS NOT NULL THEN CASE WHEN ap.id IS DISTINCT FROM p_excluir_prestacion_id THEN ap.cantidad ELSE 0 END ELSE CASE WHEN a.id IS DISTINCT FROM p_autorizacion_vacia_id THEN GREATEST(COALESCE(a.prestacion_cantidad, 1), 1) ELSE 0 END END),0)::integer
 FROM public.autorizaciones a LEFT JOIN public.autorizacion_prestaciones ap ON ap.autorizacion_id=a.id
 WHERE a.paciente_id = ANY(public.paciente_ids_por_dni(p_paciente_id))
 AND public.autorizacion_consume_cupo(a.estado,a.activa)
 AND public.fecha_efectiva(a.fecha_solicitud,a.created_at) BETWEEN p_desde AND p_hasta;
$$;
REVOKE ALL ON FUNCTION public.consumo_mensual_total(integer,date,date,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumo_mensual_total(integer,date,date,integer,integer) TO service_role;

-- Keep the existing identity, eligibility, group rules and audit logic.
DO $$
DECLARE v_def text; v_old text;
BEGIN
 SELECT pg_get_functiondef('public.validar_prestacion(integer,text,integer,date,text,integer,integer,boolean)'::regprocedure) INTO v_def;
 v_old := substring(v_def FROM '  -- Cupo mensual asignado[\s\S]*?  v_mendoza :=');
 IF v_old IS NULL THEN RAISE EXCEPTION 'No se encontró el bloque de cupo mensual'; END IF;
 v_def := replace(v_def,v_old,$replacement$  -- Shared monthly limit applies to every practice, including unmapped codes.
  v_max_mes := 2;
  v_cons_aut := public.consumo_mensual_total(
    p_paciente_id, public.periodo_desde(p_fecha,30), public.periodo_hasta(p_fecha,30),
    p_excluir_prestacion_id,p_autorizacion_id);
  v_extra_glob := public.excepcion_extra_global(p_paciente_id,p_fecha);
  IF v_cons_aut + v_cantidad > v_max_mes + v_extra_glob THEN
    v_permitido := false;
    v_motivo := 'cupo_mensual';
    v_mensaje := format('Cupo mensual alcanzado: consumidas %s, restantes %s, solicitadas %s. Límite %s prestaciones por paciente al mes%s.',
      v_cons_aut,GREATEST(v_max_mes+v_extra_glob-v_cons_aut,0),v_cantidad,v_max_mes,
      CASE WHEN v_extra_glob>0 THEN format(' (más %s por excepción)',v_extra_glob) ELSE '' END);
  END IF;

  v_mendoza :=$replacement$);
 v_old := substring(v_def FROM '  IF v_reglas = 0 THEN[\s\S]*?  v_res := jsonb_build_object');
 IF v_old IS NULL THEN RAISE EXCEPTION 'No se encontró el bloque sin regla'; END IF;
 v_def := replace(v_def,v_old,$replacement$  IF v_reglas = 0 AND v_permitido THEN
    v_motivo := 'ok';
    v_mensaje := format('Cupo mensual compartido: consumidas %s, restantes %s. Límite %s prestaciones por paciente al mes.',
      v_cons_aut,GREATEST(v_max_mes+v_extra_glob-v_cons_aut,0),v_max_mes);
  END IF;

  v_res := jsonb_build_object$replacement$);
 EXECUTE v_def;
END $$;

CREATE OR REPLACE FUNCTION public.cupo_mensual_paciente(p_paciente_id integer,p_fecha date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_consumo integer; v_extra integer;
BEGIN
 IF NOT public.es_usuario_interno() THEN RAISE EXCEPTION 'No tiene permisos para consultar consumos.' USING ERRCODE='42501'; END IF;
 v_consumo := public.consumo_mensual_total(p_paciente_id,public.periodo_desde(p_fecha,30),public.periodo_hasta(p_fecha,30));
 v_extra := public.excepcion_extra_global(p_paciente_id,p_fecha);
 RETURN jsonb_build_object('limite',2,'consumido',v_consumo,'restante',GREATEST(2+v_extra-v_consumo,0),'excepcion',v_extra,'sin_limite',false,'desde',public.periodo_desde(p_fecha,30),'hasta',public.periodo_hasta(p_fecha,30));
END $$;

-- Normalize present and future roster values without deleting history.
ALTER TABLE public.pacientes ALTER COLUMN consultas_maximas SET DEFAULT 2;
UPDATE public.pacientes SET consultas_maximas=2 WHERE consultas_maximas IS DISTINCT FROM 2;
CREATE OR REPLACE FUNCTION public.fijar_cupo_mensual_paciente()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.consultas_maximas:=2; RETURN NEW; END $$;
CREATE TRIGGER fijar_cupo_mensual_paciente BEFORE INSERT OR UPDATE OF consultas_maximas ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.fijar_cupo_mensual_paciente();

-- Lock before changes; all records for the same identity use the same lock.
CREATE OR REPLACE FUNCTION public.bloquear_cupo_mensual_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_pac integer; v_canon integer;
BEGIN
 IF TG_TABLE_NAME='autorizaciones' THEN v_pac:=NEW.paciente_id;
 ELSE SELECT paciente_id INTO v_pac FROM public.autorizaciones WHERE id=NEW.autorizacion_id; END IF;
 SELECT min(id) INTO v_canon FROM public.pacientes WHERE id=ANY(public.paciente_ids_por_dni(v_pac));
 PERFORM pg_advisory_xact_lock(hashtextextended('cupo_mensual_total:'||COALESCE(v_canon,v_pac)::text,0));
 RETURN NEW;
END $$;
CREATE TRIGGER bloquear_cupo_mensual_total BEFORE INSERT OR UPDATE ON public.autorizaciones FOR EACH ROW EXECUTE FUNCTION public.bloquear_cupo_mensual_total();
CREATE TRIGGER bloquear_cupo_mensual_total BEFORE INSERT OR UPDATE ON public.autorizacion_prestaciones FOR EACH ROW EXECUTE FUNCTION public.bloquear_cupo_mensual_total();

-- Validate the final transaction, including empty/legacy headers, changes of date,
-- patient, and transitions from rejected/inactive to approved/active.
CREATE OR REPLACE FUNCTION public.comprobar_cupo_mensual_final()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id integer; v_a public.autorizaciones%ROWTYPE; v_consumo integer; v_extra integer; v_fecha date;
BEGIN
 IF TG_TABLE_NAME='autorizaciones' THEN v_id:=NEW.id;
 ELSIF TG_OP='DELETE' THEN v_id:=OLD.autorizacion_id;
 ELSE v_id:=NEW.autorizacion_id; END IF;
 SELECT * INTO v_a FROM public.autorizaciones WHERE id=v_id;
 IF NOT FOUND OR NOT public.autorizacion_consume_cupo(v_a.estado,v_a.activa) THEN RETURN NULL; END IF;
 v_fecha:=public.fecha_efectiva(v_a.fecha_solicitud,v_a.created_at);
 v_consumo:=public.consumo_mensual_total(v_a.paciente_id,public.periodo_desde(v_fecha,30),public.periodo_hasta(v_fecha,30));
 v_extra:=public.excepcion_extra_global(v_a.paciente_id,v_fecha);
 IF v_consumo>2+v_extra THEN
   RAISE EXCEPTION 'Cupo mensual alcanzado: máximo % prestaciones por paciente, registradas %.',2+v_extra,v_consumo USING ERRCODE='P0001',HINT='cupo_mensual';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER comprobar_cupo_mensual_final AFTER INSERT OR UPDATE ON public.autorizaciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.comprobar_cupo_mensual_final();
CREATE CONSTRAINT TRIGGER comprobar_cupo_mensual_final AFTER INSERT OR UPDATE OR DELETE ON public.autorizacion_prestaciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.comprobar_cupo_mensual_final();