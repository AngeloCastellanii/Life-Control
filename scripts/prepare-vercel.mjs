import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const distDir = join(root, 'dist');
const sliceSrcDir = join(root, 'node_modules', 'slicejs-web-framework', 'Slice');
const sliceDestDir = join(distDir, 'Slice');
const outputDir = join(root, '.vercel', 'output');
const staticDir = join(outputDir, 'static');
const functionsDir = join(outputDir, 'functions');

if (!existsSync(join(distDir, 'App', 'index.html'))) {
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

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
cpSync(distDir, staticDir, { recursive: true });
console.log('✅ Estáticos copiados a .vercel/output/static');

function writeNodeFunction(routeName, handlerSource) {
  const funcDir = join(functionsDir, `${routeName}.func`);
  mkdirSync(funcDir, { recursive: true });
  writeFileSync(join(funcDir, 'index.js'), handlerSource, 'utf8');
  writeFileSync(
    join(funcDir, '.vc-config.json'),
    JSON.stringify(
      {
        runtime: 'nodejs22.x',
        handler: 'index.js',
        launcherType: 'Nodejs',
        shouldAddHelpers: true
      },
      null,
      2
    ),
    'utf8'
  );
}

writeNodeFunction(
  'api/slice-env',
  `export default function handler(req, res) {
  const env = {};
  for (const [key, value] of Object.entries(process.env || {})) {
    if (key.startsWith('SLICE_PUBLIC_')) {
      env[key] = String(value ?? '');
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json(env);
}
`
);

writeNodeFunction(
  'api/status',
  `export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({
    status: 'ok',
    mode: 'production',
    platform: 'vercel',
    folder: 'dist',
    timestamp: new Date().toISOString(),
    framework: 'Slice.js',
    version: '2.0.0'
  });
}
`
);
console.log('✅ Funciones serverless preparadas (slice-env, status)');

const noCache = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0'
};

writeFileSync(
  join(outputDir, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/slice-env.json', dest: '/api/slice-env' },
        {
          src: '/(.*)\\.(js|css|html|json)$',
          headers: noCache,
          continue: true
        },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/App/index.html' }
      ]
    },
    null,
    2
  ),
  'utf8'
);
console.log('✅ .vercel/output listo (Build Output API).');
