# Padrones al día, historial completo y autorización más rápida

Tres mejoras: control mensual de padrones con bajas confirmadas, historial completo de autorizaciones por paciente, y autocompletado del paciente al crear la autorización.

## 1. Padrones desactualizados (urgente)

**Comparación contra el padrón vigente**
Al importar un padrón, además de crear/actualizar, el sistema compara los DNI del archivo contra los pacientes activos de esa obra social y arma la lista de "ausentes" (estaban antes, no están en el archivo nuevo).

Antes de tocar nada, se muestra una pantalla de previsualización:
- Cantidad y detalle de ausentes (DNI, apellido y nombre, última fecha de padrón).
- Botón "Confirmar bajas" (marca inactivos, estado de padrón = BAJA) o "Solo importar sin bajas".
- Posibilidad de desmarcar pacientes puntuales para que no se den de baja.

Los dados de baja quedan bloqueados para nuevas autorizaciones, igual que hoy ocurre con BDA/FDP: el panel del paciente muestra la alerta roja y no deja emitir.

**Semáforo por obra social**
En la sección de padrones, un tablero con una fila por obra social oficial (OSPSIP, OSCE, OSCEARA, OSPIV, OSPE):
- Verde: padrón del mes en curso cargado.
- Amarillo: último padrón es del mes anterior (vence pronto).
- Rojo: sin carga del mes en curso ni del anterior (pendiente / desactualizado).
Cada fila muestra la fecha de la última carga, el período, y cantidad de activos.

**Log de auditoría de cargas**
Cada importación registra: obra social, período (mes/año), archivo, totales (procesados, creados, actualizados, dados de baja, errores), usuario y fecha. Se ve como historial en la misma sección, con detalle de errores por registro.

## 2. Historial completo de autorizaciones del paciente

Hoy el listado carga de a 20 en general y, al filtrar por paciente, solo se muestran las que ya estaban cargadas en pantalla (por eso "aparecen dos"). Se cambia a: al seleccionar un paciente, se consultan **todas** sus autorizaciones directamente en la base, ordenadas de la más nueva a la más vieja, sin paginado.

Además, botón **"Repetir"** en cada fila del historial: abre el formulario precargado con todos los datos de esa autorización (prestaciones, médico, prestador, diagnóstico), con fecha nueva, para emitirla en un clic.

## 3. Autocompletar el paciente en la autorización

Al presionar "Nueva Autorización" con un paciente ya seleccionado, el formulario deja de pedir buscarlo otra vez: muestra una tarjeta fija con apellido, nombre, DNI y obra social, y precarga automáticamente obra social, número de credencial (nº de afiliado) y parentesco. Un botón "Cambiar paciente" permite volver al buscador si hace falta.

## Detalles técnicos

- Nueva tabla `padron_cargas`: `obra_social_id`, `periodo` (date, primer día del mes), `archivo_nombre`, `total_procesados`, `creados`, `actualizados`, `dados_de_baja`, `errores` (jsonb), `usuario_id`, `created_at`. GRANTs para `authenticated`/`service_role` + RLS (lectura para usuarios autenticados, escritura para admin/servicio).
- `import-padron-bulk`: nuevos modos `dry_run_diff` (devuelve ausentes sin escribir), `apply_bajas` (recibe lista de IDs confirmados) y registro en `padron_cargas`.
- `PadronConverter.tsx`: selector de período, paso de previsualización de bajas, y llamada al log.
- Nuevo `PadronStatus.tsx` + hook `usePadronCargas.tsx` para el semáforo e historial.
- `AutorizacionManagement.tsx`: nuevo hook `useAutorizacionesPaciente(pacienteId)` (query server-side sin paginado) usado cuando hay paciente seleccionado; el infinito sigue para la vista general. Se agrega `estado_padron === 'BAJA'` a las validaciones de bloqueo.
- `AutorizacionForm.tsx`: acepta `preselectedPatient` (objeto completo) y una autorización base para "Repetir"; oculta `PatientSelector` cuando viene preseleccionado.
