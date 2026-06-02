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


---

## Lo que ya hay

- `slice init`, `pnpm dev`, scripts del CLI local.
- Temas **Light/Dark**, botón de tema, estilos `.lc-*`.
- **IndexedDB** (`life-control`) y contexto `lifeControl`.
- **Dominios**: crear, listar, borrar, con color.
- **Tareas**: `TaskCard` en Home (urgencia, minutos, checkbox).
- Servicios en `Service/Nombre/Nombre.js` (ruta que pide Slice).

---

## Problemas y arreglos

**Puertos 3001/3002 ocupados** — viejos `pnpm dev` colgados. Cerrar terminales o `taskkill`.

**Pizza cargando forever** — loading no se apagaba. `finally` + `loading.stop()` en `App/index.js`.

**Actualizar Slice** — `pnpm slice update` falla (usa npm). Mejor `pnpm add` de framework y cli.

**/domains vacío** — `MultiRoute` no renderizaba. `render()` al iniciar + al cambiar ruta.

**Dominios no guardaban** — archivos sueltos en `Service/`. Los moví a subcarpetas.

**Dominios duplicados** — doble submit (botón + form). Un solo `requestSubmit()` + candado `_submitting`.

**Home sin tareas** — mismo tema del form + hace falta dominio en el select.

---

## Probar

```powershell
cd "Life Control"
pnpm dev
```

Dominios primero, luego Home. Si algo falla: `Ctrl+Shift+R`.

---

## Siguiente

Modal con eventos.
