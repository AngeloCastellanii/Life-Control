import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Elimina los bundles de producción generados por slicejs-cli.
// El empaquetador (Bundling V2) genera un bundle "vendor-shared" defectuoso
// (deja un `export` suelto → "Unexpected token 'export'") que rompe la app en
// producción. Sin la carpeta /bundles, el framework carga los componentes como
// módulos ES normales (igual que en desarrollo), que funciona de forma fiable.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundlesDir = join(root, 'dist', 'bundles');

if (existsSync(bundlesDir)) {
   rmSync(bundlesDir, { recursive: true, force: true });
   console.log('🧹 dist/bundles eliminado (se usa carga por módulos ES).');
} else {
   console.log('ℹ️  No hay dist/bundles que eliminar.');
}
