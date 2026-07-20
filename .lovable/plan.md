
## Objetivo
1. Mostrar solo 20 autorizaciones al abrir la sección y añadir botón "Cargar más" (lazy load) para las siguientes tandas de 20.
2. Reducir la latencia del campo "Buscar paciente" en autorizaciones.

## Cambios

### 1. Paginación de autorizaciones (`src/hooks/useAutorizaciones.tsx` + `AutorizacionManagement.tsx`)
- Reemplazar `useAutorizaciones()` por `useAutorizacionesInfinite()` usando `useInfiniteQuery` de React Query.
- Query paginada con `.range(from, to)` en Supabase (páginas de 20). Se mantiene el orden `created_at desc` y el filtro `activa = true`.
- Cada página trae sus 20 autorizaciones y, con un solo `IN(...)` sobre `autorizacion_prestaciones`, sus prestaciones (patrón actual conservado, aplicado por página).
- El componente aplana `data.pages` para renderizar. `hasNextPage` = última página trajo 20 filas.
- Botón "Cargar más (20)" bajo la tabla que llama `fetchNextPage()`; muestra "Cargando..." mientras trae y se oculta cuando no hay más.
- Filtro de búsqueda (`searchTerm`) y filtro por paciente seleccionado siguen aplicándose sobre lo cargado en memoria (mismo comportamiento actual). Cuando hay un paciente seleccionado, el filtro sigue siendo client-side.

### 2. Acelerar el buscador de pacientes en autorizaciones
- `AutorizacionManagement.tsx`: subir el debounce y evitar consultas cortas.
  - Pasar `debounceMs = 400` al hook y exigir `length >= 3` antes de consultar (evita disparar con 2 letras cuando el usuario recién arranca).
  - Mantener `limit = 5` (ya es bajo).
- `usePatientSearch.tsx`: 
  - Añadir `placeholderData: (prev) => prev` para que el dropdown no parpadee mientras llega la nueva respuesta.
  - Subir `staleTime` a `60_000` (menos refetch al re-enfocar).
  - Reordenar la rama numérica: si es DNI, usar `.ilike('dni', '${q}%')` directo (ya lo hace) — el índice de prefijo funciona bien.
  - Para texto: consultar por `apellido` con `ilike` prefijo (`apellido.ilike.${q}%`) en lugar de `%q%` — mucho más rápido y coincide con cómo el usuario suele buscar (por apellido). Fallback: si `q` no matchea nada de apellido en la primera respuesta el usuario puede seguir tipeando; si querés cubrir "nombre" mantenemos una segunda condición `nombre.ilike.${q}%` (también prefijo). Se elimina el `%q%` que fuerza scan completo.
- El campo de input queda igual visualmente; solo cambia la velocidad de respuesta.

### 3. Índices (migración) para acelerar el `ilike` prefijo
Añadir índices `text_pattern_ops` (soportan `LIKE 'x%'`) si no existen:
```sql
CREATE INDEX IF NOT EXISTS idx_pacientes_apellido_prefix
  ON public.pacientes (apellido text_pattern_ops) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre_prefix
  ON public.pacientes (nombre text_pattern_ops) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_pacientes_dni_prefix
  ON public.pacientes (dni text_pattern_ops) WHERE activo = true;
```

## Archivos afectados
- `src/hooks/useAutorizaciones.tsx` — nuevo `useAutorizacionesInfinite`, se mantiene el hook viejo si algo más lo usa.
- `src/components/AutorizacionManagement.tsx` — consumir infinite query, botón "Cargar más", subir debounce/min-length del buscador.
- `src/hooks/usePatientSearch.tsx` — `placeholderData`, `staleTime`, ilike por prefijo.
- Migración SQL con los 3 índices parciales.

## Notas
- El buscador de la tabla (`searchTerm`) sigue filtrando solo lo ya cargado; si querés que busque en toda la BD por número/OS, es otro alcance.
