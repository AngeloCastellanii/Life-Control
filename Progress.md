# Progress — Life Control

Apuntes del proyecto con **Slice.js** y **pnpm**. Todo armado por composición: servicios, contexto y componentes.

---

## Qué he hecho

| # | Qué | Listo |
|---|-----|-------|
| 1 | Proyecto base Slice | ✅ |
| 2 | Tema claro/oscuro | ✅ |
| 3 | Contexto + IndexedDB | ✅ |
| 4 | Dominios | ✅ |
| 5 | Tareas + TaskCard | ✅ |
| — | Sidebar (escritorio / tabs abajo en móvil) | ✅ |
| — | FAB + modal shell con blur | ✅ |
| — | Formularios en modal (DomainForm, TaskForm) | ✅ |
| — | 5 rutas + sections placeholder | ✅ |
| — | Dashboard + API tipo de cambio | ✅ |
| — | Planner: time blocks + drag & drop | ✅ |

---

## Lo que ya hay

- `slice init`, `pnpm dev`, scripts del CLI local.
- Temas **Light/Dark**, botón de tema, estilos `.lc-*`.
- **IndexedDB** (`life-control`) y contexto `lifeControl`.
- **Dominios**: crear, listar, borrar, con color.
- **Tareas**: `TaskCard` en Planificador (urgencia, minutos, checkbox).
- **Dashboard**: anillo de capacidad, contador pendientes, tipo de cambio USD→VES (API), listas prioridad/recientes.
- **Planificador**: bloques de tiempo, drag & drop inbox→bloque, `BlockForm` en modal.
- **Sidebar** con Inicio y Dominios; tema abajo del menú.
- **FAB** (+) abre modal con formulario según la ruta (`DomainForm` / `TaskForm`).
- Cierra con ×, fondo, Esc o `ui:modal:close` al guardar.
- Servicios en `Service/Nombre/Nombre.js` (ruta que pide Slice).

---

## Problemas y arreglos

**Puertos 3001/3002 ocupados** — viejos `pnpm dev` colgados. Cerrar terminales o `taskkill`.

**Pizza cargando forever** — loading no se apagaba. `finally` + `loading.stop()` en `App/index.js`.

**Actualizar Slice** — `pnpm slice update` falla (usa npm). Mejor `pnpm add` de framework y cli.

**/domains vacío** — `MultiRoute` no renderizaba. `render()` al iniciar + evento `router:change`.

**Dominios no guardaban** — servicios en carpeta plana; Slice pide subcarpeta `Service/X/X.js`.

**Al crear, dominios duplicados** — botón y form hacían doble submit. `requestSubmit()` + `_submitting`.

**Home sin tareas** — mismo doble submit; hace falta un dominio en el select.

**Al borrar, se vacía toda la lista** — `destroyByContainer` / barrido de `activeComponents` rompía cosas (servicios, secciones). En dominios: solo `innerHTML = ''`. En tareas: destruir solo `task-card-*`.

**Datos raros en IndexedDB** — pruebas viejas con duplicados. Borrar DB en DevTools → Application → `life-control` y volver a crear.

**sliceId duplicado (task-card, sections)** — re-build sin destruir instancias. MultiRoute usa `section-Nombre` fijo; Planner destruye `task-card-{sectionId}-*` antes de re-render.

**Bloques no se guardaban** — `renderBlocks` destruía `time-block-service` porque su id empezaba con `time-block-`. Los bloques visuales ahora usan `planner-block-{id}`.

---

## Probar

```powershell
cd "Life Control"
pnpm dev
```

Dominios primero, luego Home. Si algo falla: `Ctrl+Shift+R`.

---

## Siguiente

Finanzas: transacciones pagar/cobrar.
