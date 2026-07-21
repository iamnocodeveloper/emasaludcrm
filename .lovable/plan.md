## Problema

En `src/components/AutorizacionManagement.tsx`, al hacer clic en un paciente de las sugerencias:

1. Se guarda `selectedPatientId` y se reemplaza el texto del input por `"Apellido, Nombre - DNI: xxx"`.
2. Ese nuevo texto dispara una nueva búsqueda en `usePatientSearch`, que devuelve resultados distintos (o vacíos) porque busca por el string compuesto.
3. `selectedPatient = patients.find(p => p.id === selectedPatientId)` queda **undefined**, porque el paciente elegido ya no está en `patients` (los resultados actuales).
4. Al ser `undefined`, el panel de información y el botón **"Nueva Autorización"** no se renderizan (línea 216: `{selectedPatient && (...)}`).

Queda visible únicamente el buscador, el filtro de autorizaciones y la tabla filtrada por `selectedPatientId`.

## Solución

Desacoplar el paciente seleccionado de los resultados de búsqueda: guardar el objeto paciente completo en estado en el momento del clic, en vez de derivarlo del array `patients` que sigue cambiando con cada tipeo.

### Cambios en `src/components/AutorizacionManagement.tsx`

1. Reemplazar `selectedPatientId: number | null` por un estado `selectedPatient: Patient | null` (o mantener ambos, guardando el objeto completo al seleccionar).
2. En el `onClick` del botón de sugerencia (línea ~192): guardar el objeto `p` completo en el nuevo estado, además del id.
3. Eliminar la línea `const selectedPatient = patients?.find(...)` — usar directamente el estado.
4. En "Limpiar selección" y cuando el input queda vacío: limpiar también el objeto guardado.
5. Ocultar el dropdown de sugerencias cuando ya hay un paciente seleccionado (ya se hace con `!selectedPatientId`, se mantiene).
6. Opcional: evitar re-disparar `usePatientSearch` mientras haya paciente seleccionado (pasar `""` como término al hook en ese caso) para no hacer requests innecesarios.

No se toca la lógica de negocio (topes, BDA/FDP, creación de autorización) ni otros componentes.

## Verificación

- Buscar un paciente → click en la sugerencia → confirmar que aparecen: panel de info del paciente, alertas (si aplican) y botón "Nueva Autorización".
- Click en "Limpiar selección" → vuelve al estado inicial.
- Click en "Nueva Autorización" → abre el diálogo del formulario correctamente.