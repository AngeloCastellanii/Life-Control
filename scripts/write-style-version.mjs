import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = String(Date.now());
const out = join(root, 'src', 'App', 'styleVersion.js');

writeFileSync(out, `export const STYLE_VERSION = '${version}';\n`, 'utf8');
console.log(`styleVersion.js → ${version}`);
