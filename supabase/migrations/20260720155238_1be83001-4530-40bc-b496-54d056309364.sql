CREATE INDEX IF NOT EXISTS idx_pacientes_apellido_prefix ON public.pacientes (apellido text_pattern_ops) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre_prefix ON public.pacientes (nombre text_pattern_ops) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_pacientes_dni_prefix ON public.pacientes (dni text_pattern_ops) WHERE activo = true;