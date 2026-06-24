import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const required = [
  'index.html',
  'css/styles.css',
  'js/app.js',
  'data/countries.json',
  'data/world_regions.json',
  'assets/img/world-map-free.svg',
  'manifest.json',
  'service-worker.js',
  'BUILD_INFO.json',
  'README.md',
  'CHANGELOG.md'
];

for (const file of required) {
  if (!existsSync(join(root, file))) throw new Error(`Arquivo ausente: ${file}`);
}

const html = readFileSync(join(root, 'index.html'), 'utf8');
const js = readFileSync(join(root, 'js/app.js'), 'utf8');
const css = readFileSync(join(root, 'css/styles.css'), 'utf8');
const countries = JSON.parse(readFileSync(join(root, 'data/countries.json'), 'utf8'));
const regions = JSON.parse(readFileSync(join(root, 'data/world_regions.json'), 'utf8'));

const htmlChecks = ['screenHome', 'screenNation', 'screenGame', 'countryMapLayer', 'regionMapLayer', 'globalGrid', 'actionStack'];
for (const token of htmlChecks) {
  if (!html.includes(token)) throw new Error(`HTML não contém ${token}`);
}

const jsChecks = ['v0.2.0-F2-MAPA-MUNDIAL-PAISES', 'world_regions.json', 'renderWorldMap', 'region-marker', 'map-marker'];
for (const token of jsChecks) {
  if (!js.includes(token)) throw new Error(`JS não contém ${token}`);
}

const cssChecks = ['world-map-shell', 'map-attribution', 'nation-card', 'flag-pill'];
for (const token of cssChecks) {
  if (!css.includes(token)) throw new Error(`CSS não contém ${token}`);
}

if (countries.length < 12) throw new Error('Poucos países cadastrados na Fase 2');
if (regions.length < 8) throw new Error('Poucas regiões globais cadastradas na Fase 2');
for (const country of countries) {
  if (!country.flag || !country.profile || !country.map) throw new Error(`País incompleto: ${country.name}`);
}

console.log('Smoke test OK — Modern War Dominion F2 completo.');
