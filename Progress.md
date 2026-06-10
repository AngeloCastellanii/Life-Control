# Progress — Life Control

Apuntes del proyecto con **Slice.js** y **pnpm**. Todo armado por composición: servicios, contexto y componentes.

---

## Qué he hecho

| # | Qué | Listo |
|---|-----|-------|
| 1 | Proyecto base Slice | ✅ |
| 2 | Temas Light / Dark / Slice / Obsidian | ✅ |
| 3 | Contexto + IndexedDB | ✅ |
| 4 | Dominios (crear, editar, borrar) | ✅ |
| 5 | Tareas + TaskCard | ✅ |
| — | Sidebar (escritorio / tabs abajo en móvil) | ✅ |
| — | FAB + modal shell con blur | ✅ |
| — | Formularios en modal por ruta | ✅ |
| — | 5 rutas + secciones completas | ✅ |
| — | Dashboard + API tipo de cambio | ✅ |
| — | Planificador: bloques de tiempo + inbox | ✅ |
| — | Finanzas: pagar / cobrar | ✅ |
| — | Compras: listas por frecuencia | ✅ |
| — | UI con Tailwind + clases `.lc-*` | ✅ |
| — | Tipografía Plus Jakarta Sans | ✅ |

---

## Lo que ya hay

- `pnpm dev`, scripts del CLI local (`pnpm slice:*`).
- **Temas**: Light, Dark, **Slice** (Amethyst Geode) y **Obsidian** (Obsidian Chrome). Selector en sidebar. Tras editar un tema custom, borrar `sliceTheme-*` en Local Storage si no se reflejan los cambios.
- **IndexedDB** (`life-control`) y contexto `lifeControl`.
- **Dominios**: crear, **editar** (nombre y color), listar, borrar.
- **Tareas**: `TaskCard` con urgencia, minutos, checkbox, editar y borrar.
- **Dashboard**: capacidad (completadas/pendientes), bloques, tipo de cambio, finanzas, compras próximas, prioridad, en bloques, **liquidez neta pendiente** (solo ingresos por cobrar).
- **Finanzas**: billetera **Dinero actual** (ajustable); al marcar pagado descuenta, al cobrar suma.
- **Planificador**: vistas **Día / Semana / Mes**, navegación de fechas, flujo de caja del día, bandeja de entrada, bloques de tiempo. Tareas con `scheduledDate` opcional.
- **Finanzas**: columnas por pagar / por cobrar, totales pendientes, marcar pagado/cobrado, crear y borrar (`FinanceForm`).
- **Compras**: 4 columnas por frecuencia con **fechas** (`nextDueAt`, `lastDoneAt`). Formulario permite fijar **última vez** y **próxima fecha** (útil si ya pagaste antes de usar la app). Al marcar hecho calcula la próxima. Botones ✎ y × arriba de cada columna; clic en el nombre → detalle.
- **Sidebar**: Dashboard, Planificador, Finanzas, Compras, Dominios. Tema abajo del menú.
- **FAB** (+) abre modal según la ruta (`DomainForm`, `TaskForm`, `BlockForm`, `FinanceForm`, `ShoppingForm`).
- Modal: cierra con ×, fondo, Esc o `ui:modal:close` al guardar.
- Servicios en `Service/Nombre/Nombre.js` (ruta que pide Slice).
- **Slice** CLI v3.6.3 · framework v3.3.4.

---

## Problemas y arreglos

**Puertos 3001/3002 ocupados** — viejos `pnpm dev` colgados. Cerrar terminales o `taskkill`.

**Pizza cargando forever** — loading no se apagaba. `finally` + `loading.stop()` en `App/index.js`.

**Actualizar Slice** — `pnpm slice:update` o `pnpm add` de `slicejs-cli` y `slicejs-web-framework`.

**/domains vacío** — `MultiRoute` no renderizaba. `render()` al iniciar + evento `router:change`.

**Dominios no guardaban** — servicios en carpeta plana; Slice pide subcarpeta `Service/X/X.js`.

**Al crear, dominios duplicados** — botón y form hacían doble submit. `requestSubmit()` + `_submitting`.

**Al borrar, se vacía toda la lista** — barrido de `activeComponents` rompía cosas. En dominios: solo `innerHTML = ''`. En tareas: destruir solo `task-card-*`.

**Datos raros en IndexedDB** — pruebas viejas con duplicados. Borrar DB en DevTools → Application → `life-control` y volver a crear.

**sliceId duplicado (task-card, sections)** — re-build sin destruir instancias. MultiRoute usa `section-Nombre` fijo; Planner destruye cards antes de re-render.

**Bloques no se guardaban** — `renderBlocks` destruía `time-block-service` porque su id empezaba con `time-block-`. Los bloques visuales usan `planner-block-{id}`.

**Tema Slice no actualiza** — caché en `localStorage` (`sliceTheme-Slice`). Borrar y recargar.

**Deploy en Vercel** — Igual que el repo del profe: `vercel.json` con rewrite a `/api/`, script **`build`** en `package.json`, carpeta `api/index.js`. **Output Directory vacío** en el panel. `includeFiles: dist/**` en functions. Alternativa: **Render** con `pnpm start`.

---

## Probar

```powershell
cd "Life Control"
pnpm dev
```

Dominios primero, luego tareas. Si algo falla: `Ctrl+Shift+R`.

---

## Deploy (Render)

| Campo | Valor |
|--------|--------|
| Root Directory | vacío |
| Build Command | `pnpm install && pnpm css:build && pnpm exec slice build` |
| Start Command | `NODE_ENV=production pnpm start` |

---

## Planeado (sin desarrollar aún)

> Cuando pidas implementarlo, lo hacemos. Por ahora solo queda documentado.

### Vision Board
- Nueva ruta / vista con **canvas** para agregar **fotos**.
- Tablero visual personal para motivarse y ver metas a largo plazo.
- Persistencia en IndexedDB (imágenes o referencias).

### Compras — mejoras futuras
- Notificaciones push / recordatorios fuera de la app.

### Dashboard — mejoras futuras
- Acceso o preview al **Vision Board**.

---

## Siguiente

- Desplegar en Render y verificar en producción.
- Probar finanzas y compras de punta a punta.
- Limpiar `HomeSection` (no se usa; la app usa `DashboardSection`).
- Luego: Vision Board (ver sección Planeado).
