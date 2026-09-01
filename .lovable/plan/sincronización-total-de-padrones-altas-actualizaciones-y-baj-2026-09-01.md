# Sincronización total de padrones (altas, actualizaciones y bajas)

Un solo flujo en la sección **Padrones**: subís uno o varios archivos del mes, el sistema los analiza, muestra un resumen previo y, al confirmar, deja el padrón de cada obra social exactamente igual al archivo.

## Cómo va a funcionar

1. **Subida múltiple**: arrastrás varios padrones a la vez y elegís el período (mes/año). Para cada archivo se detecta o se asigna manualmente la obra social (OSPSIP, OSCEARA, OSCE, OSPIV, OSPE).
2. **Análisis previo (sin tocar nada)**: por cada obra social se muestra:
   - Altas: personas del archivo que no existen en el sistema.
   - Reactivaciones: personas que estaban dadas de baja y vuelven a figurar.
   - Actualizaciones: ya existentes, se refrescan sus datos con los del archivo.
   - Bajas: activos de esa obra social que ya no figuran en el archivo, listados con DNI, apellido y nombre, con casilla para excluir alguno puntual.
3. **Confirmación**: un solo botón "Aplicar sincronización" ejecuta todo. Las bajas son lógicas: el paciente queda inactivo con estado BAJA, bloqueado para nuevas autorizaciones, conservando su historial. Las reactivaciones vuelven a activo con los datos nuevos del archivo.
4. **Registro auditable**: cada obra social procesada genera una fila en el historial con período, archivo, procesados, creados, actualizados, reactivados, dados de baja, errores y usuario. El semáforo pasa a verde para ese mes.

Aviso de seguridad: si un archivo tiene muchos menos registros de lo esperado (por ejemplo, menos de la mitad de los activos actuales), se muestra una advertencia antes de permitir confirmar, para evitar bajas masivas por un archivo incompleto.

## Detalles técnicos

- **Edge function `padron-sync`**: se amplía con la acción `sync`.
  - `plan`: recibe filas normalizadas + `obra_social_id`; devuelve `altas`, `reactivaciones`, `actualizaciones`, `bajas` (ids + datos), y totales. No escribe nada.
  - `apply`: recibe el plan confirmado (con ids excluidos de baja); hace upsert por lotes de 200 sobre `pacientes` (match por DNI/nro_doc/CUIL normalizado + `obra_social_id`), setea `activo=true`, `estado_padron='Activo'` en altas/reactivaciones, y `activo=false`, `estado_padron='BAJA'` en las bajas confirmadas. Inserta el log en `padron_cargas`.
  - Los errores por `unique_active_patient_dni` (DNI activo en otra obra social) se capturan por registro y se devuelven en `errores`, sin abortar el lote.
- **Normalización en el cliente** (reutiliza la lógica existente de `PadronConverter.tsx`): DNI/CUIL sin puntos ni guiones y sin ceros a la izquierda, CUIL de 11 dígitos → DNI central, fechas Excel serial → `YYYY-MM-DD`, sexo, parentesco y plan.
- **`src/components/PadronSync.tsx`**: pasa de "solo bajas" a multi-archivo con acordeón por obra social, tabs de Altas / Actualizaciones / Bajas, checkboxes para excluir bajas y botón único de aplicar.
- **`padron_cargas`**: se agregan columnas `reactivados` (int, default 0) y `archivos` no es necesario — se sigue usando `archivo_nombre` por obra social. Requiere una migración chica para `reactivados`.
- **`usePadronCargas.tsx` / `PadronStatus.tsx`**: se muestra la nueva columna de reactivados en el historial.
- Al terminar se invalidan las queries `patients`, `padron-cargas` y `autorizaciones`.

## Resultado

Subís los padrones del mes, revisás el resumen, confirmás una vez, y el sistema queda espejado con el padrón vigente: entran los nuevos, se actualizan los existentes, vuelven los que reingresaron y quedan bloqueados los que salieron.
