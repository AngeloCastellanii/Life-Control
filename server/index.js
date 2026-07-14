// server/index.js — Servidor Express local (desarrollo y producción con pnpm start)
import express from 'slicejs-web-framework/api/framework/express.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  securityMiddleware,
  sliceFrameworkProtection,
  suspiciousRequestLogger
} from '../api/middleware/securityMiddleware.js';
import { createPublicEnvProvider } from '../api/utils/publicEnvResolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import sliceConfig from '../src/sliceConfig.json' with { type: 'json' };

let server;
const app = express();

const runMode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const folderDeployed = runMode === 'production' ? 'dist' : 'src';

function resolveDeployRoot() {
   if (runMode === 'development') {
      return path.join(__dirname, '../src');
   }

   const candidates = [
      path.join(__dirname, '../dist'),
      path.join(process.cwd(), 'dist')
   ];

   for (const root of candidates) {
      if (fs.existsSync(path.join(root, 'App', 'index.html'))) {
         return root;
      }
   }

   return path.join(__dirname, '../dist');
}

const deployRoot = resolveDeployRoot();
const publicEnvProvider = createPublicEnvProvider({
  mode: runMode,
  envFilePath: path.join(__dirname, '..', '.env')
});

function applyNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function noCacheStaticOptions() {
  return {
    setHeaders(res, filePath) {
      if (/\.(css|js|html|json)$/i.test(filePath)) {
        applyNoCacheHeaders(res);
      }
    }
  };
}

const PORT = process.env.PORT || sliceConfig.server?.port || 3001;

app.use(suspiciousRequestLogger());
app.use(sliceFrameworkProtection());
app.use(securityMiddleware({
  allowedExtensions: [
    '.js', '.css', '.html', '.json',
    '.svg', '.png', '.jpg', '.jpeg', '.gif',
    '.woff', '.woff2', '.ttf', '.ico'
  ],
  blockedPaths: [
    '/node_modules',
    '/package.json',
    '/package-lock.json',
    '/.env',
    '/.git',
    '/api/middleware'
  ],
  allowPublicAssets: true
}));

app.use((req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.get('/slice-env.json', (req, res) => {
  const payload = publicEnvProvider.getPayload();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json(payload);
});

if (runMode === 'production') {
  // Sin bundles: servimos TODO el framework Slice desde node_modules (igual que en
  // dev), para que la carga de clases estructurales por módulos individuales
  // (/Slice/Components/Structural/...) funcione. Antes solo se servía Slice.js y el
  // resto de /Slice devolvía 404, lo que rompía la app cuando no hay bundles.
  app.use(
    '/Slice',
    express.static(path.join(__dirname, '..', 'node_modules', 'slicejs-web-framework', 'Slice'), noCacheStaticOptions())
  );
  app.use('/Components', express.static(path.join(deployRoot, 'Components'), noCacheStaticOptions()));
}

app.use('/bundles/', (req, res, next) => {
  if (req.path.endsWith('.js')) {
    const filePath = path.join(deployRoot, 'bundles', req.path);

    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.send(fileContent);
      } catch (error) {
        return res.status(500).send('Error reading bundle file');
      }
    }
    return res.status(404).send('Bundle file not found');
  }
  next();
});

app.use('/bundles/', express.static(path.join(deployRoot, 'bundles')));

if (runMode === 'development') {
  app.use('/Slice/', express.static(path.join(__dirname, '..', 'node_modules', 'slicejs-web-framework', 'Slice')));
}

const publicFolders = Array.isArray(sliceConfig.publicFolders) ? sliceConfig.publicFolders : [];
const normalizedPublicFolders = publicFolders
  .filter((entry) => typeof entry === 'string')
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0)
  .map((entry) => (entry.startsWith('/') ? entry : `/${entry}`));

if (runMode === 'development') {
  app.use(express.static(deployRoot));
} else {
  app.use('/App', express.static(path.join(deployRoot, 'App'), noCacheStaticOptions()));
  app.get('/manifest.json', (req, res) => {
    const manifestPath = path.join(deployRoot, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(fs.readFileSync(manifestPath, 'utf8'));
    }
    return res.status(404).send('manifest.json not found');
  });
  app.get('/service-worker.js', (req, res) => {
    const workerPath = path.join(deployRoot, 'service-worker.js');
    if (fs.existsSync(workerPath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(fs.readFileSync(workerPath, 'utf8'));
    }
    return res.status(404).send('service-worker.js not found');
  });
  app.get('/routes.js', (req, res) => {
    const routesPath = path.join(deployRoot, 'routes.js');
    if (fs.existsSync(routesPath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(fs.readFileSync(routesPath, 'utf8'));
    }
    return res.status(404).send('routes.js not found');
  });
  app.get('/sliceConfig.json', (req, res) => {
    const configPath = path.join(deployRoot, 'sliceConfig.json');
    if (fs.existsSync(configPath)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(fs.readFileSync(configPath, 'utf8'));
    }
    return res.status(404).send('sliceConfig.json not found');
  });
  for (const folder of normalizedPublicFolders) {
    app.use(folder, express.static(path.join(deployRoot, folder.replace(/^\//, '')), noCacheStaticOptions()));
  }
  app.use('/bundles/', express.static(path.join(deployRoot, 'bundles')));
  app.use('/dist/', express.static(deployRoot));
}

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    mode: runMode,
    folder: folderDeployed,
    timestamp: new Date().toISOString(),
    framework: 'Slice.js',
    version: '2.0.0',
    security: {
      enabled: true,
      mode: 'automatic',
      description: 'Zero-config security - works with any domain'
    }
  });
});

app.get('*', (req, res) => {
  const indexPath = path.join(deployRoot, 'App', 'index.html');
  applyNoCacheHeaders(res);
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send(`
        <h1>404 - Page Not Found</h1>
        <p>The requested file could not be found in /${folderDeployed}</p>
        <p>Make sure you've run the appropriate build command:</p>
        <ul>
          <li>For development: Files should be in /src</li>
          <li>For production: Run "pnpm run build" first</li>
        </ul>
      `);
    }
  });
});

function startServer() {
  const host = '0.0.0.0';
  server = app.listen(PORT, host, () => {
    console.log(`🔒 Security middleware: active (zero-config, automatic)`);
    console.log(`🚀 Slice.js server running on http://${host}:${PORT}`);
    console.log(`📁 Serving from: ${deployRoot}`);
  });
}

process.on('SIGINT', () => {
  console.log('\n🛑 Slice server stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Server terminated');
  process.exit(0);
});

startServer();

export default app;
