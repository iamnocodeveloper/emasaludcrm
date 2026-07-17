-- Índices para que las búsquedas incrementales no recorran toda la tabla.
create extension if not exists pg_trgm;

create index if not exists pacientes_dni_prefix_idx
  on public.pacientes (dni text_pattern_ops)
  where activo = true;

create index if not exists pacientes_nombre_trgm_idx
  on public.pacientes using gin (nombre gin_trgm_ops)
  where activo = true;

create index if not exists pacientes_apellido_trgm_idx
  on public.pacientes using gin (apellido gin_trgm_ops)
  where activo = true;
