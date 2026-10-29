# Topes de prestaciones — documentación operativa

Documenta el motor de topes, el caso reportado del **DNI 34920351** y los cambios
aplicados el **2026-10-29**.

---

## 1. Resumen

El control de cupos vive en Postgres: las reglas se configuran en tablas y el
bloqueo real lo hacen triggers, de modo que no se puede evadir desde el front.

| Pieza | Archivo |
|---|---|
| Tablas de reglas y log | `supabase/migrations/20261027120000_crear_motor_topos_prestaciones.sql` |
| Funciones de cálculo y validador | `supabase/migrations/20261027120100_funciones_validacion_prestaciones.sql` |
| Triggers y RPC de alta/edición | `supabase/migrations/20261027120200_enforcement_autorizaciones.sql` |
| Mapeo nomenclador → grupo | `supabase/migrations/20261028130000_mapeo_practicas_cobertura.sql` |

**Unidades de consumo (no son intercambiables):**

- **Cupo mensual** (`pacientes.consultas_maximas`): cuenta **consultas**
  (`tipo_autorizacion = 'consulta'`) pendientes o aprobadas del mes calendario.
  `999` significa *sin límite*.
- **Reglas por práctica y por grupo**: suman **cantidades** de
  `autorizacion_prestaciones`, en la ventana del período definido por la regla
  (1 = día, 30 = mes calendario, 90 = trimestre, 365 = año, 730 = bienio, otro =
  ventana móvil de N días).

**Orden de evaluación de `validar_prestacion`:**

`permiso → identidad (DNI) → padrón → cupo mensual → tope por práctica → tope por grupo → sin_regla`

`sin_regla` autoriza sin control: son los códigos que todavía no están mapeados
en `cobertura_practicas`.

---

## 2. Caso reportado: DNI 34920351

### Síntoma

Al emitir una autorización el sistema respondía *"ya tiene el tope de
autorizaciones"* (cupo mensual alcanzado).

### Datos del paciente

| Campo | Valor |
|---|---|
| id | 12492 |
| DNI | 34920351 |
| Nombre | Virginia Cruz |
| Obra social | OSPE (id 14) |
| Plan | PMO |
| Padrón | Activo |
| `consultas_maximas` | 2 |
| `consultas_mes_actual` (previo) | 2 |

### Historial de octubre de 2026

| Autorización | Fecha | Tipo | Prestaciones |
|---|---|---|---|
| 2616 | 28/10 | consulta | consulta médica diurna (`420101`) |
| 2644 | 29/10 | laboratorio | 7 determinaciones (`660475`, `660711`, `660174`, `660876`, `661035`, `661040`, `660865`) |

### Causa raíz

`consumo_autorizaciones` contaba **todas las cabeceras de autorización** contra
`consultas_maximas`, sin mirar el tipo. El paciente tenía 1 consulta + 1
laboratorio = **2/2**, así que al emitir la siguiente autorización la cabecera se
insertaba primero (el trigger valida después del `INSERT` de la cabecera) y el
contador pasaba a **3 > 2** → bloqueo.

Es decir: **un laboratorio consumía el cupo de consultas**.

El valor `2` no proviene del padrón de OSPE (en la misma obra social hay 1631
pacientes con `999`, 447 con `2` y 289 con `5`, sin correlación con el plan):
es el valor por defecto del alta de pacientes (`PatientForm` / `PatientImport`).

### Evidencia

`validaciones_prestacion_log` no mostraba el bloqueo: la transacción que falla
revierte también su log, y el reintento del `onError` (fuera de la transacción)
respondía `ok`.

### Resolución

No se modificaron datos del paciente ni se cargaron excepciones: el cupo pasó a
contar solo consultas. Estado posterior:

- consultas del mes: **1 / 2**
- consumo por grupo: **0** en todos los grupos
- alta de prueba con el trigger activo (transacción revertida): **permitida**

---

## 3. Cambios aplicados

### 3.1 Cupo mensual cuenta solo consultas

`supabase/migrations/20261029120000_cupo_mensual_solo_consultas.sql`

- `consumo_autorizaciones(...)` agrega `COALESCE(a.tipo_autorizacion,'') = 'consulta'`.
- `sync_consultas_mes_actual()` usa el mismo criterio, para que el contador
  informativo coincida con el cupo real.
- Recalcula `pacientes.consultas_mes_actual` de toda la base con el criterio nuevo.

### 3.2 Validación con la fecha de la autorización

`supabase/migrations/20261029120500_validacion_fecha_autorizacion_y_cupo_rpc.sql`

- `validar_prestacion_fila()` y `validar_autorizacion_estado()` usan
  `COALESCE(autorizaciones.fecha_solicitud, CURRENT_DATE)` en lugar de
  `CURRENT_DATE`. Cargar una autorización retroactiva ya no se evalúa contra el
  cupo del mes en curso.
- Nuevo RPC `cupo_mensual_paciente(p_paciente_id, p_fecha)` →
  `{ limite, consumido, excepcion, sin_limite, desde, hasta }`, para que la UI no
  dependa del contador denormalizado.

### 3.3 Alertas visuales de consumo

| Archivo | Cambio |
|---|---|
| `src/components/ConsumoPacientePanel.tsx` (nuevo) | Panel con cupo mensual y barras por grupo: verde `<70%`, ámbar `70–99%`, rojo agotado. Muestra período, restantes y excepciones. Expone `BarraConsumo` reutilizable. |
| `src/components/AutorizacionManagement.tsx` | Reemplaza el bloque "Consumo por grupo" (top 4, solo texto) por el panel; quita el contador legacy "Consultas del mes". |
| `src/components/PatientManagement.tsx` | Reemplaza la barra legacy (dividía por cero con cupo nulo) por el panel. |
| `src/components/MultiplePrestacionesSelector.tsx` | Barras en vivo de cupo mensual, práctica y grupo antes de guardar. |
| `src/hooks/useValidacionPrestacion.tsx` | Agrega `useCupoMensualPaciente` y el tipo `CupoMensualPaciente`. |
| `src/hooks/useAutorizaciones.tsx` | Invalida `['cupo-mensual']` al crear, editar o eliminar. |
| `src/integrations/supabase/types.ts` | Firma del RPC `cupo_mensual_paciente`. |

### 3.4 Pruebas

`supabase/tests/validacion_prestaciones.sql` suma:

- **Caso 12:** un laboratorio no consume el cupo de consultas; la segunda consulta
  del mes sí se bloquea.
- **Caso 13:** una autorización retroactiva se valida contra su propio mes.

---

## 4. Diagnóstico de un caso puntual

Script de solo lectura (todo dentro de `BEGIN … ROLLBACK`):
`supabase/diagnostics/dni-34920351.sql`. Devuelve ficha, cupo mensual, historial
del mes, consumo por grupo y por práctica, últimas validaciones y excepciones.

```bash
npx supabase db query --linked --file supabase/diagnostics/dni-34920351.sql
# o pegar el contenido en el SQL Editor del dashboard
```

La Management API devuelve solo el último result set: para ver cada bloque,
ejecutar las consultas por separado.

### Consultas rápidas

```sql
-- cupo mensual de un paciente
SELECT public.cupo_mensual_paciente(<id>);

-- ¿por qué se bloqueó? (fuera de transacción)
SELECT public.validar_prestacion(<id>, '<codigo>', 1, CURRENT_DATE, '<dni>', NULL, NULL, false);

-- consumo por grupo
SELECT jsonb_pretty(public.resumen_consumos_paciente(<id>));
```

---

## 5. Aplicación de migraciones

`supabase db push` **no funciona en este repo** por un desfase previo: la base
tiene decenas de versiones sin archivo local (migraciones aplicadas desde
Lovable/dashboard). Mientras no se repare el historial:

```bash
npx supabase db query --linked --file supabase/migrations/<archivo>.sql
npx supabase db query --linked "INSERT INTO supabase_migrations.schema_migrations (version, name, created_by) VALUES ('<version>', '<name>', 'db-query') ON CONFLICT (version) DO NOTHING"
```

Las migraciones de este cambio ya están aplicadas y registradas:

- `20261029120000` — cupo mensual solo consultas
- `20261029120500` — validación por fecha + RPC de cupo

---

## 6. Verificación realizada

- `npx tsc --noEmit -p tsconfig.app.json` sin errores.
- `npm run build` OK.
- ESLint sobre los archivos tocados: sin errores nuevos.
- `supabase/tests/validacion_prestaciones.sql` completo contra la base real
  (rollback): pasa, incluidos los casos 12 y 13.
- Alta real del paciente 12492 con el trigger activo (transacción revertida):
  permitida.

---

## 7. Limitaciones conocidas

1. **El log del bloqueo se pierde:** la excepción revierte la transacción,
   incluido `validaciones_prestacion_log`. El reintento del `onError` registra
   `ok` porque evalúa sin la cabecera nueva. Para auditar bloqueos hace falta
   registrar el motivo fuera de la transacción.
2. **Previsualización vs. guardado:** `validar_prestacion` no recibe el tipo de
   autorización, así que la vista previa del formulario no puede anticipar el
   cupo de consultas con exactitud; el bloqueo definitivo ocurre al guardar.
3. **Umbral del cupo mensual:** la comparación es `consumido > límite`, por lo que
   se permiten exactamente N consultas y se bloquea la N+1 (comportamiento
   intencional del diseño).
4. **Códigos sin mapeo** se autorizan sin control (`sin_regla`); el panel de
   administración avisa cuántos grupos están vacíos.
5. **`db push` desincronizado** (ver sección 5).
