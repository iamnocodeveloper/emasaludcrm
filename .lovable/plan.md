# Convertir EMA Salud en SaaS multitenant con Super Admin

## Estado actual (verificado)

El sistema **no** es multitenant. Ninguna tabla del esquema (`pacientes`, `autorizaciones`, `medicos`, `obras_sociales`, `turnos`, `credenciales`, `recetarios_emitidos`, `nomeclador`, `users`, `user_roles`, `system_config`) tiene columna de clínica u organización. Las políticas RLS filtran solo por rol (`has_role`) y, en autorizaciones, por `created_by_user_id`. Hoy todos los usuarios comparten los mismos datos.

Decisiones tomadas por defecto (podés cambiarlas):
- Todos los datos actuales se migran a una clínica inicial: **EMA Salud**.
- Planes y suscripciones se gestionan **internamente** desde el Super Admin (sin pasarela de pago todavía; se puede agregar Stripe/Paddle después).
- El switch de IA por clínica habilita/deshabilita las funciones de IA y define un cupo mensual de uso.

## Fase 1 — Aislamiento de datos (multitenancy)

1. Nueva tabla `clinicas` (nombre, slug, logo, dirección, estado, plan, fecha de alta, `ia_habilitada`, `ia_cupo_mensual`).
2. Agregar `clinica_id` a todas las tablas de negocio: pacientes, médicos, especialidades, obras sociales, turnos, consultas, diagnósticos, autorizaciones, autorizacion_prestaciones, credenciales, recetarios (emitidos y config), lotes de facturación, comprobantes particulares, nomenclador, patient_tags, audit_logs, users.
3. Backfill: todos los registros existentes quedan en la clínica EMA Salud; luego la columna pasa a NOT NULL.
4. Función `get_user_clinica_id()` (SECURITY DEFINER) que devuelve la clínica del usuario logueado.
5. Reescribir **todas** las políticas RLS para exigir `clinica_id = get_user_clinica_id()`, manteniendo las reglas de rol actuales encima (admin/usuario_normal ven todo lo de su clínica, prestador solo lo propio).
6. Ajustar índices únicos que hoy son globales para que sean por clínica — en particular la restricción de DNI activo (`unique_active_patient_dni`) pasa a `(clinica_id, dni)`.
7. En el frontend: los hooks de escritura (`usePatients`, `useAutorizaciones`, `useMedicos`, etc.) setean `clinica_id` automáticamente al insertar; las lecturas quedan protegidas por RLS.

## Fase 2 — Super Admin

1. Nuevo rol `super_admin` en el enum `app_role`, fuera del alcance de clínica (ve todo el sistema).
2. Nueva ruta protegida `/super-admin` con su propio layout y sidebar, accesible solo con ese rol.
3. Módulos:
   - **Clínicas**: alta, edición, suspensión, ver métricas por clínica (pacientes, autorizaciones, usuarios activos).
   - **Usuarios globales**: listado de todos los usuarios con su clínica, alta de usuario administrador al crear una clínica, activar/desactivar.
   - **Planes**: tabla `planes` (nombre, precio, límite de usuarios, límite de pacientes, IA incluida sí/no, cupo de IA).
   - **Suscripciones**: tabla `suscripciones` (clínica, plan, estado, período, monto, fecha de vencimiento) con historial de pagos manuales (`pagos`).
   - **Ingresos**: panel con ingreso mensual recurrente, ingresos acumulados, distribución por plan y clínicas por vencer.
   - **IA**: switch por clínica con cupo mensual y contador de uso.
4. Aplicación de límites: al crear usuarios o pacientes se valida contra el plan de la clínica; suscripción vencida o suspendida bloquea el acceso con un aviso.

## Fase 3 — Activación de IA

1. Tabla `ia_uso` para registrar cada llamada (clínica, usuario, función, tokens, fecha).
2. Edge function que valida antes de cada llamada: clínica activa, IA habilitada y cupo disponible; si no, devuelve error claro.
3. Función inicial de IA: **asistente clínico** (resumen de historia del paciente y sugerencia de diagnóstico a partir de las consultas registradas), usando Lovable AI. Se pueden sumar más después.
4. Las secciones de IA se ocultan en clínicas sin la función habilitada.

## Notas técnicas

- Todo el cambio de esquema va en migraciones con `GRANT` explícito para cada tabla nueva, RLS habilitada y políticas basadas en funciones SECURITY DEFINER para evitar recursión.
- El rol `super_admin` se resuelve con `has_role(auth.uid(), 'super_admin')` en las políticas, permitiendo bypass del filtro de clínica.
- `system_config` pasa a ser por clínica (logo, nombre, subtítulo), con fallback a la configuración global.
- Fase 1 es la más delicada: toca todas las políticas RLS y todos los hooks. Conviene aprobar y ejecutar Fase 1 completa antes de empezar Fase 2.
- La integración de cobro real (Stripe o Paddle) queda fuera de este plan; el modelo de datos ya la contempla para sumarla después.
