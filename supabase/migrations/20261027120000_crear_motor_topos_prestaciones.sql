-- Motor de topes por práctica y grupo
-- Configuración de límites (por práctica y por grupo), excepciones autorizadas
-- y registro de cada validación ejecutada.

-- Fecha con la que se imputa una prestación al período correspondiente.
-- Se usa también en el índice, por eso debe ser IMMUTABLE.
CREATE OR REPLACE FUNCTION public.fecha_efectiva(p_fecha date, p_created_at timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    p_fecha,
    (p_created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
  );
$$;

CREATE TABLE IF NOT EXISTS public.cobertura_grupos (
  id                          serial PRIMARY KEY,
  codigo                      text NOT NULL UNIQUE,
  nombre                      text NOT NULL,
  -- Tope por defecto para cada práctica del grupo. Cada práctica puede
  -- sobrescribirlo en cobertura_practicas.
  limite_practica_default     integer,
  periodo_practica_default    integer,
  limite_grupo                integer,
  periodo_grupo_dias          integer,
  ambito                      text NOT NULL DEFAULT 'general'
                              CHECK (ambito IN ('general', 'solo_mendoza')),
  activo                      boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cobertura_grupos_limite_positivo
    CHECK (limite_grupo IS NULL OR limite_grupo > 0),
  CONSTRAINT cobertura_grupos_periodo_positivo
    CHECK (periodo_grupo_dias IS NULL OR periodo_grupo_dias > 0),
  CONSTRAINT cobertura_grupos_limite_practica_positivo
    CHECK (limite_practica_default IS NULL OR limite_practica_default > 0),
  CONSTRAINT cobertura_grupos_periodo_practica_positivo
    CHECK (periodo_practica_default IS NULL OR periodo_practica_default > 0)
);

CREATE TABLE IF NOT EXISTS public.cobertura_practicas (
  id                    serial PRIMARY KEY,
  codigo_practica       text NOT NULL,
  grupo_id              integer NOT NULL REFERENCES public.cobertura_grupos(id) ON DELETE CASCADE,
  limite_practica       integer,
  periodo_practica_dias integer,
  activo                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codigo_practica, grupo_id),
  CONSTRAINT cobertura_practicas_limite_positivo
    CHECK (limite_practica IS NULL OR limite_practica > 0),
  CONSTRAINT cobertura_practicas_periodo_positivo
    CHECK (periodo_practica_dias IS NULL OR periodo_practica_dias > 0)
);

CREATE INDEX IF NOT EXISTS idx_cobertura_practicas_codigo
  ON public.cobertura_practicas (codigo_practica);
CREATE INDEX IF NOT EXISTS idx_cobertura_practicas_grupo
  ON public.cobertura_practicas (grupo_id);

CREATE TABLE IF NOT EXISTS public.cobertura_excepciones (
  id                 serial PRIMARY KEY,
  paciente_id        integer NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  grupo_id           integer REFERENCES public.cobertura_grupos(id) ON DELETE CASCADE,
  codigo_practica    text,
  cantidad_extra     integer NOT NULL DEFAULT 1,
  vigente_desde      date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta      date,
  justificacion      text NOT NULL,
  responsable_id     uuid NOT NULL DEFAULT auth.uid(),
  responsable_nombre text,
  numero_expediente  text,
  activo             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cobertura_excepciones_cantidad_positiva
    CHECK (cantidad_extra > 0),
  CONSTRAINT cobertura_excepciones_vigencia
    CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE INDEX IF NOT EXISTS idx_cobertura_excepciones_paciente_practica
  ON public.cobertura_excepciones (paciente_id, codigo_practica);
CREATE INDEX IF NOT EXISTS idx_cobertura_excepciones_paciente_grupo
  ON public.cobertura_excepciones (paciente_id, grupo_id);

CREATE TABLE IF NOT EXISTS public.validaciones_prestacion_log (
  id               bigserial PRIMARY KEY,
  paciente_id      integer NOT NULL,
  codigo_practica  text NOT NULL,
  cantidad         integer NOT NULL,
  permitido        boolean NOT NULL,
  motivo           text,
  detalle          jsonb NOT NULL DEFAULT '{}'::jsonb,
  usuario_id       uuid DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validaciones_log_paciente
  ON public.validaciones_prestacion_log (paciente_id, created_at DESC);

-- Índices para el cómputo de consumos por paciente y período.
-- Hoy no existía ninguno sobre estas columnas.
CREATE INDEX IF NOT EXISTS idx_autorizaciones_paciente_periodo
  ON public.autorizaciones (
    paciente_id,
    public.fecha_efectiva(fecha_solicitud, created_at)
  );
CREATE INDEX IF NOT EXISTS idx_autorizacion_prestaciones_codigo
  ON public.autorizacion_prestaciones (prestacion_codigo);
CREATE INDEX IF NOT EXISTS idx_autorizacion_prestaciones_autorizacion
  ON public.autorizacion_prestaciones (autorizacion_id);

DROP TRIGGER IF EXISTS update_cobertura_grupos_updated_at ON public.cobertura_grupos;
CREATE TRIGGER update_cobertura_grupos_updated_at
  BEFORE UPDATE ON public.cobertura_grupos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cobertura_practicas_updated_at ON public.cobertura_practicas;
CREATE TRIGGER update_cobertura_practicas_updated_at
  BEFORE UPDATE ON public.cobertura_practicas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cobertura_excepciones_updated_at ON public.cobertura_excepciones;
CREATE TRIGGER update_cobertura_excepciones_updated_at
  BEFORE UPDATE ON public.cobertura_excepciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cobertura_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobertura_practicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobertura_excepciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validaciones_prestacion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de grupos de cobertura" ON public.cobertura_grupos;
CREATE POLICY "Lectura de grupos de cobertura"
  ON public.cobertura_grupos FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Solo admin modifica grupos de cobertura" ON public.cobertura_grupos;
CREATE POLICY "Solo admin modifica grupos de cobertura"
  ON public.cobertura_grupos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Lectura de practicas de cobertura" ON public.cobertura_practicas;
CREATE POLICY "Lectura de practicas de cobertura"
  ON public.cobertura_practicas FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Solo admin modifica practicas de cobertura" ON public.cobertura_practicas;
CREATE POLICY "Solo admin modifica practicas de cobertura"
  ON public.cobertura_practicas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Lectura de excepciones de cobertura" ON public.cobertura_excepciones;
CREATE POLICY "Lectura de excepciones de cobertura"
  ON public.cobertura_excepciones FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Solo admin modifica excepciones de cobertura" ON public.cobertura_excepciones;
CREATE POLICY "Solo admin modifica excepciones de cobertura"
  ON public.cobertura_excepciones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Solo admin lee validaciones" ON public.validaciones_prestacion_log;
CREATE POLICY "Solo admin lee validaciones"
  ON public.validaciones_prestacion_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.cobertura_grupos TO authenticated;
GRANT SELECT ON public.cobertura_practicas TO authenticated;
GRANT SELECT ON public.cobertura_excepciones TO authenticated;
GRANT SELECT ON public.validaciones_prestacion_log TO authenticated;
GRANT ALL ON public.cobertura_grupos TO service_role;
GRANT ALL ON public.cobertura_practicas TO service_role;
GRANT ALL ON public.cobertura_excepciones TO service_role;
GRANT ALL ON public.validaciones_prestacion_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cobertura_grupos_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cobertura_practicas_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cobertura_excepciones_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.validaciones_prestacion_log_id_seq TO authenticated, service_role;
