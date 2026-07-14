import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const sliceSrc = join(root, 'node_modules', 'slicejs-web-framework', 'Slice', 'Slice.js');
const sliceDest = join(root, 'dist', 'Slice', 'Slice.js');

if (!existsSync(join(root, 'dist', 'App', 'index.html'))) {
  console.error('❌ dist/ no encontrado. Ejecuta "pnpm run build" primero.');
  process.exit(1);
}

if (!existsSync(sliceSrc)) {
  console.error('❌ Slice.js no encontrado en node_modules:', sliceSrc);
  process.exit(1);
}

mkdirSync(dirname(sliceDest), { recursive: true });
copyFileSync(sliceSrc, sliceDest);
console.log('✅ Slice.js copiado a dist/Slice/Slice.js');
