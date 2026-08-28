CREATE TABLE public.padron_cargas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_social_id integer NOT NULL REFERENCES public.obras_sociales(id),
  periodo date NOT NULL,
  archivo_nombre text,
  total_procesados integer NOT NULL DEFAULT 0,
  creados integer NOT NULL DEFAULT 0,
  actualizados integer NOT NULL DEFAULT 0,
  dados_de_baja integer NOT NULL DEFAULT 0,
  errores jsonb NOT NULL DEFAULT '[]'::jsonb,
  usuario_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.padron_cargas TO authenticated;
GRANT ALL ON public.padron_cargas TO service_role;

ALTER TABLE public.padron_cargas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden ver cargas de padron"
ON public.padron_cargas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins pueden registrar cargas de padron"
ON public.padron_cargas FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins pueden actualizar cargas de padron"
ON public.padron_cargas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins pueden eliminar cargas de padron"
ON public.padron_cargas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_padron_cargas_os_periodo ON public.padron_cargas (obra_social_id, periodo DESC);

CREATE TRIGGER update_padron_cargas_updated_at
BEFORE UPDATE ON public.padron_cargas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();