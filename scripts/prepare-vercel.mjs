import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const sliceSrcDir = join(root, 'node_modules', 'slicejs-web-framework', 'Slice');
const sliceDestDir = join(root, 'dist', 'Slice');

if (!existsSync(join(root, 'dist', 'App', 'index.html'))) {
  console.error('❌ dist/ no encontrado. Ejecuta "pnpm run build" primero.');
  process.exit(1);
}

if (!existsSync(sliceSrcDir)) {
  console.error('❌ Carpeta Slice no encontrada en node_modules:', sliceSrcDir);
  process.exit(1);
}

// Copiamos TODA la carpeta Slice (no solo Slice.js): sin bundles, el framework
// carga sus clases estructurales como módulos individuales desde /Slice/Components/...
cpSync(sliceSrcDir, sliceDestDir, { recursive: true });
console.log('✅ Carpeta Slice copiada a dist/Slice (framework completo).');
