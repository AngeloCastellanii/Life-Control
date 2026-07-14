# Life Control

Organizador personal web: tareas, planificador por bloques, finanzas, compras y dominios. Construido con **Slice.js** como proyecto del Proyecto 1 (paradigma de componentes).

**Demo:** *(actualizar tras desplegar en Vercel)*

---

## Requisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`corepack enable` si hace falta)

**Slice.js no se instala aparte.** Al clonar el repo, `pnpm install` descarga:

- `slicejs-web-framework` — framework servido en `/Slice/Slice.js` por el servidor Express
- `slicejs-cli` — CLI usada por los scripts `dev` y `build`

---

## Clonar y ejecutar (desde cero)

```powershell
git clone https://github.com/AngeloCastellanii/Life-Control.git
cd Life-Control
pnpm install
pnpm dev
```

1. **`pnpm install`** — instala Slice, Express, Tailwind y el resto de dependencias en `node_modules/`.
2. **`pnpm dev`** — compila CSS y levanta el servidor de desarrollo de Slice (`slicejs-cli dev` + `server/index.js`). La consola muestra la URL (por defecto `http://localhost:3001`).

No hace falta `npm i -g slice` ni `slice init`: el proyecto ya está inicializado.

### Producción local

```powershell
pnpm run build
pnpm start
```

`pnpm run build` genera la carpeta `dist/` con Slice CLI. `pnpm start` ejecuta `server/index.js`, que sirve `dist/` cuando `NODE_ENV=production`.

---

## Despliegue (Vercel)

La app se despliega como **sitio estático** en Vercel (CDN global, sin cold start). El build genera `dist/` y copia `Slice.js` al bundle.

| Campo | Valor |
|--------|--------|
| Framework Preset | Other |
| Build Command | `pnpm run build:vercel` |
| Output Directory | `dist` |
| Install Command | `pnpm install` |

`vercel.json` ya incluye rewrites para rutas SPA (`/planner`, `/finances`, etc.) y el endpoint `/slice-env.json`.

### Despliegue local con servidor Node (opcional)

```powershell
pnpm run build
pnpm start
```

`pnpm start` ejecuta `server/index.js` (Express), útil para probar producción en local sin Vercel CLI.

### Migrar desde Render

1. Conecta el repositorio en [vercel.com](https://vercel.com) (importar desde GitHub).
2. Vercel detectará `vercel.json` automáticamente.
3. Despliega; la URL será algo como `life-control.vercel.app`.
4. Opcional: configura dominio personalizado en el panel de Vercel.
5. Puedes desactivar el servicio en Render cuando confirmes que Vercel funciona.

---

## Vistas y rutas

| Ruta | Vista |
|------|--------|
| `/` | Dashboard — resumen del día |
| `/planner` | Planificador — día, semana, mes |
| `/finances` | Finanzas — pagos y cobros |
| `/shopping` | Compras — listas por frecuencia |
| `/domains` | Dominios — etiquetas con color |
| `/settings` | Perfil — nombre, tema, caché |

---

## Entidades (IndexedDB: `life-control`)

| Entidad | Atributos principales | Relación |
|---------|----------------------|----------|
| **Dominio** | `id`, `name`, `color` | Referenciado por tareas (`domainId`) |
| **Tarea** | `title`, `urgency`, `minutes`, `startDate`, `dueDate`, `blockId`, `completed` | → dominio, → bloque de tiempo |
| **Bloque de tiempo** | `label`, `start`, `end`, `rule`, `taskIds` | Contiene tareas asignadas |
| **Finanza** | `description`, `amount`, `type`, `dueDate`, `settled` | — |
| **Compra** | `name`, `frequency`, `lastDoneAt`, `nextDueAt` | — |
| **Perfil** | `displayName` (store `meta`) | — |

---

## API externa (R09)

| Campo | Valor |
|--------|--------|
| Servicio | `ExchangeRateService` |
| URL | `https://open.er-api.com/v6/latest/USD` |
| Uso | Tasa USD → VES (o EUR) en el Dashboard |
| Estados | `loading`, `success`, `error` con feedback visual |

Documentación de la API: https://www.exchangerate-api.com/docs/free

---

## Sistema de diseño (R05)

### Tipografía

- **Plus Jakarta Sans** (Google Fonts) — legible en móvil y escritorio.

### Temas

| Tema | Descripción |
|------|-------------|
| **Light** | Modo claro por defecto del framework, adaptado |
| **Dark** | Modo oscuro — cumple R04 |
| **Slice** | Tema propio: fondo verde menta `#d4dfd8`, acento `#3f7359`, superficies grises `#f0f1ef` / `#e4e5e3`, texto oscuro `#171717` |
| **Obsidian** | Tema propio oscuro con acentos metálicos |

La preferencia se guarda en `localStorage` (`sliceTheme`). Selector en **Perfil**.

### Componentes visuales

- Clases utilitarias **`.lc-*`** (`lc-card`, `lc-input`, `lc-view-hero`, etc.) en `src/Styles/lifeControl.components.css`.
- **Tailwind CSS v4** para layout y utilidades.
- Bordes redondeados (`--lc-radius-lg`, `--lc-radius-xl`) y sombras suaves alineadas al acento verde.

---

## Arquitectura (R10)

```
src/Components/
├── AppComponents/
│   ├── sections/     # DashboardSection, PlannerSection, …
│   ├── forms/        # TaskForm, FinanceForm, …
│   ├── atoms/        # TaskCard, Fab, TimeBlock, …
│   └── shell/        # AppShell, Sidebar, ModalShell
├── Service/          # TaskService, FinanceService, ExchangeRateService, …
└── Visual/           # MultiRoute, Route, Button, …
```

- **Estado global:** contexto `lifeControl` (Slice ContextManager).
- **Eventos:** apertura/cierre de modales vía `ui:modal:open` / `ui:modal:close`.
- **Servicios:** lógica de persistencia y API separada de las vistas.

---

## PWA

La app puede instalarse en el móvil (manifest + iconos en `src/images/`). Si tras un deploy no se ven cambios:

1. Ir a **Perfil** → **Limpiar caché y recargar**, o  
2. Eliminar el acceso directo y volver a **Añadir a pantalla de inicio**.

Regenerar PNG desde el SVG del icono:

```powershell
pnpm run icons:generate
```

---

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Desarrollo (Tailwind + Slice dev server) |
| `pnpm run build` | Build de producción → `dist/` |
| `pnpm start` | Servidor Node en modo producción |
| `pnpm run icons:generate` | Genera iconos PWA desde `src/images/icon.svg` |

---

## Documentación del proyecto

- **Progress.md** — avance detallado, cumplimiento R01–R10 e incidencias resueltas.
- **PROPUESTA.md** — propuesta inicial del proyecto (si aplica en el repositorio del curso).

---

## Autor

Angelo Castellani — Proyecto 1, Life Control, programación basada en componentes (Slice.js).

