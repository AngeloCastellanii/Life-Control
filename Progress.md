# Progress — Life Control

Registro de avance del proyecto web **Life Control**, desarrollado con **Slice.js**, **pnpm**, **Tailwind CSS v4** e **IndexedDB**. Organizador personal de tareas, planificación, finanzas y compras.

**Demo en producción:** https://lifecontrol-a5i4.onrender.com  
**Repositorio:** GitHub — `AngeloCastellanii/Life-Control`

---

## Resumen

Life Control centraliza la gestión diaria en una SPA componentizada: dashboard resumen, planificador con bloques de tiempo, finanzas, listas de compras, dominios (etiquetas) y perfil de usuario. Los datos persisten en el navegador (IndexedDB). El tipo de cambio USD se obtiene de una API externa.

---

## Cumplimiento de requerimientos técnicos (R01–R10)

| ID | Requerimiento | Implementación en Life Control | Estado |
|----|---------------|--------------------------------|--------|
| R01 | Framework basado en componentes | Slice.js 3.3.x — Web Components, `slice.build`, registry en `components.js` | ✅ |
| R02 | Contexto / state global | Contexto `lifeControl` (`tasks`, `domains`, `timeBlocks`, `finances`, `shopping`, `profile`, `exchangeRate`) | ✅ |
| R03 | Gestor de eventos | `slice.events` — p. ej. `ui:modal:open`, `ui:modal:close`, `router:change`, `task:changed` | ✅ |
| R04 | Tema claro y oscuro | `ThemeManager` — temas **Light** y **Dark**; preferencia en `localStorage` | ✅ |
| R05 | Tema visual propio | Temas custom **Slice** y **Obsidian** + sistema `.lc-*` documentado en README | ✅ |
| R06 | ≥3 entidades persistidas | Dominios, tareas, bloques de tiempo, finanzas, compras (IndexedDB `life-control`) | ✅ |
| R07 | Modal interactivo | `ModalShell` + formularios (`TaskForm`, `DomainForm`, `FinanceForm`, etc.) vía eventos | ✅ |
| R08 | ≥3 vistas con router | 6 rutas: `/`, `/planner`, `/finances`, `/shopping`, `/domains`, `/settings` | ✅ |
| R09 | API externa | `ExchangeRateService` → Open Exchange Rates (`open.er-api.com`); estados loading/success/error | ✅ |
| R10 | Arquitectura componentizada | Carpetas `sections`, `forms`, `atoms`, `shell`, `Service`, utilidades (`plannerDates.js`, etc.) | ✅ |

---

## Funcionalidades implementadas

### Núcleo
- Bootstrap en `App/index.js`: servicios singleton, arranque del router tras inicialización correcta.
- Persistencia con `StorageService` (IndexedDB, stores: `domains`, `tasks`, `timeBlocks`, `finances`, `shopping`, `meta`).
- Sincronización servicios → contexto `lifeControl` → vistas reactivas (`slice.context.watch`).

### Vistas
- **Dashboard:** saludo personalizado, capacidad del día, tipo de cambio, finanzas pendientes, compras próximas, liquidez neta, resumen por dominio.
- **Planificador:** vistas Día / Semana / Mes; bloques de tiempo (Mañana, Tarde, Noche); inbox; flujo de caja del día; tareas con **fecha desde** y **fecha tope**; historial al revisar días pasados.
- **Finanzas:** pagos y cobros, billetera ajustable, marcar liquidado.
- **Compras:** columnas por frecuencia (diaria, semanal, mensual, anual) con fechas `lastDoneAt` / `nextDueAt`.
- **Dominios:** CRUD con nombre y color.
- **Perfil:** nombre de usuario, selector de tema, guía de uso, botón **Limpiar caché y recargar** (PWA/navegador).

### UI / UX
- Sidebar responsive (escritorio / tabs inferiores en móvil).
- FAB contextual por ruta (+ abre el formulario correspondiente).
- Estilos compartidos `.lc-view-*`, `.lc-card`, `.lc-input` en `lifeControl.components.css`.
- Tipografía **Plus Jakarta Sans**.
- PWA: `manifest.json`, iconos SVG/PNG, meta theme-color, apple-touch-icon.

### Deploy
- **Render:** build `pnpm run build`, start `node api/index.js`, `NODE_ENV=production`.


---

## Stack y versiones

| Herramienta | Versión |
|-------------|---------|
| Node.js | ≥ 20 |
| pnpm | 11.2.x |
| slicejs-web-framework | 3.3.6 |
| slicejs-cli | 3.6.3 |
| Tailwind CSS | 4.3.x |

---

## Arquitectura (partes más trabajadss)

```
src/
├── App/                 # index.html, index.js, bootstrap
├── routes.js            # Rutas de la SPA
├── Components/
│   ├── AppComponents/   # sections, forms, atoms, shell
│   └── Service/         # Lógica de datos y API
├── Themes/              # Light, Dark, Slice, Obsidian
├── Styles/              # Tailwind + lifeControl.components.css
└── images/              # Iconos PWA
api/
└── index.js             # Express: sirve src (dev) o dist (prod)
```

**Relaciones entre entidades:** tarea → `domainId` (dominio); tarea → `blockId` (bloque de tiempo); finanzas y compras independientes pero visibles en planificador/dashboard por fecha.

---

## Incidencias resueltas durante el desarrollo

| Problema | Solución |
|----------|----------|
| Loading infinito al iniciar | `slice.loading.stop()` en `finally` de `App/index.js` |
| MultiRoute no renderizaba al entrar | `render()` explícito al montar `AppShell` |
| Servicios no persistían | Estructura `Service/Nombre/Nombre.js` exigida por Slice |
| IDs duplicados al re-renderizar | Prefijos `planner-block-`, `task-card-*`; destrucción selectiva |
| Build en producción rompía modales | `pnpm run build --no-obfuscate --no-minify` |
| Tareas ancladas a bloques en fechas incorrectas | Rango `startDate`–`dueDate` + helpers en `plannerDates.js` |
| Pantalla en blanco tras deploy | Guards en `PlannerSection` y arranque del router solo si bootstrap OK |
| Caché PWA en móvil | Botón limpiar caché en Perfil (`clearAppCache.js`) |
| Tema Slice: calendario semanal poco visible | Contraste en `Themes/Slice.css` para `.planner-week__day` |

---

## Pendiente (alguna futuar implementacion)

- **Vision Board:** vista con canvas para imágenes/metas (propuesta documentada, no implementada).
- Limpieza de `HomeSection` / `AboutSection` (no usados en rutas activas).

---

## Comandos de desarrollo

```powershell
git clone https://github.com/AngeloCastellanii/Life-Control.git
cd Life-Control
pnpm install
pnpm dev
```

Slice.js se obtiene vía dependencias (`slicejs-cli`, `slicejs-web-framework`); no requiere instalación global.

Build de producción local:

```powershell
pnpm run build
pnpm start
```

Generar iconos PWA desde SVG:

```powershell
pnpm run icons:generate
```

---
