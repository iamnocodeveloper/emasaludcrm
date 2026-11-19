REVOKE ALL ON FUNCTION public.bloquear_cupo_mensual_total() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.comprobar_cupo_mensual_final() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fijar_cupo_mensual_paciente() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bloquear_cupo_mensual_total() TO service_role;
GRANT EXECUTE ON FUNCTION public.comprobar_cupo_mensual_final() TO service_role;
GRANT EXECUTE ON FUNCTION public.fijar_cupo_mensual_paciente() TO service_role;