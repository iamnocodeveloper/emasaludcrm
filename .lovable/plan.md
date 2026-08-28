# Agregar la sección "Padrones" al menú del sidebar

La funcionalidad de padrones (semáforo por obra social, historial de cargas y sincronización de bajas) ya está construida en `Index.tsx` (caso `import-padron`), `PadronStatus.tsx`, `PadronSync.tsx` y la tabla `padron_cargas`, pero el sidebar no incluye el botón para llegar a ella, por lo que hoy es inaccesible desde la interfaz.

## Cambio

- Editar `src/components/Sidebar.tsx`: agregar el ítem `{ id: 'import-padron', label: 'Padrones', icon: ClipboardList }` al final de los menús de `admin` y `usuario_normal` (no para `prestador`, que solo ve autorizaciones). Usar un ícono adecuado (`ClipboardList` ya importado, o `Database`/`FileCheck` de lucide-react).

No se tocan otros archivos: la lógica de render, el semáforo y la sincronización ya funcionan.

## Resultado

Al hacer clic en "Padrones" del sidebar se abre la sección con:
1. Semáforo por obra social (verde/amarillo/rojo según si el padrón del mes está cargado).
2. Historial auditable de cargas.
3. Sincronización del padrón del mes (subir archivo → comparar → confirmar bajas).
