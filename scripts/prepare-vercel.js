import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distSrc = path.join(root, 'dist');
const distDest = path.join(root, 'api', '_dist');
const indexCheck = path.join(distSrc, 'App', 'index.html');

if (!fs.existsSync(indexCheck)) {
   console.error('❌ Build incompleto: falta dist/App/index.html');
   process.exit(1);
}

function copyDir(src, dest) {
   fs.mkdirSync(dest, { recursive: true });
   for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const from = path.join(src, entry.name);
      const to = path.join(dest, entry.name);
      if (entry.isDirectory()) {
         copyDir(from, to);
      } else {
         fs.copyFileSync(from, to);
      }
   }
}

if (fs.existsSync(distDest)) {
   fs.rmSync(distDest, { recursive: true, force: true });
}

copyDir(distSrc, distDest);
console.log('✅ dist copiado a api/_dist para Vercel');
