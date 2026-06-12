import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imagesDir = join(root, 'src', 'images');
const svgPath = join(imagesDir, 'icon.svg');

mkdirSync(imagesDir, { recursive: true });

const svg = readFileSync(svgPath, 'utf8');

function renderPng(size, outputName) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size }
  });
  const png = resvg.render().asPng();
  writeFileSync(join(imagesDir, outputName), png);
}

renderPng(512, 'icon-512.png');
renderPng(192, 'icon-192.png');
renderPng(180, 'apple-touch-icon.png');

console.log('Icons generated in src/images/');
