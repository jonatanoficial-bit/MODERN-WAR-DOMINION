import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'index.html',
  'css/styles.css',
  'js/app.js',
  'data/countries.json',
  'assets/img/ukraine-map-free.svg',
  'manifest.json',
  'service-worker.js',
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'BUILD_INFO.json',
  'docs/RELEASE_NOTES_F1.md',
  'docs/ROLLBACK_F1.md',
  'docs/QA_CHECKLIST_F1.md',
  'docs/KNOWN_ISSUES_F1.md',
  'docs/ASSET_LICENSES.md'
];

const failures = [];
function assert(condition, message) {
  if (!condition) failures.push(message);
}

for (const file of requiredFiles) {
  const absolute = path.join(root, file);
  assert(fs.existsSync(absolute), `Arquivo obrigatório ausente: ${file}`);
  if (fs.existsSync(absolute)) {
    const stat = fs.statSync(absolute);
    assert(stat.size > 0, `Arquivo vazio: ${file}`);
  }
}

for (const jsonFile of ['manifest.json', 'package.json', 'BUILD_INFO.json', 'data/countries.json']) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, jsonFile), 'utf8'));
  } catch (error) {
    failures.push(`JSON inválido em ${jsonFile}: ${error.message}`);
  }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const build = JSON.parse(fs.readFileSync(path.join(root, 'BUILD_INFO.json'), 'utf8'));
const countries = JSON.parse(fs.readFileSync(path.join(root, 'data/countries.json'), 'utf8'));

assert(html.includes('css/styles.css'), 'index.html não referencia css/styles.css');
assert(html.includes('js/app.js'), 'index.html não referencia js/app.js');
assert(html.includes('manifest.json'), 'index.html não referencia manifest.json');
assert(html.includes('assets/img/ukraine-map-free.svg'), 'index.html não referencia o mapa da Ucrânia');
assert(css.includes('@media'), 'CSS não possui regras responsivas');
assert(js.includes('localStorage'), 'JS não possui save local via localStorage');
assert(js.includes('serviceWorker'), 'JS não tenta registrar o service worker');
assert(sw.includes('CACHE_NAME'), 'service-worker.js sem CACHE_NAME');
assert(sw.includes('ukraine-map-free.svg'), 'service-worker.js não cacheia o mapa da Ucrânia');
assert(build.phase === 1, 'BUILD_INFO não está na fase 1');
assert(Array.isArray(countries) && countries.length >= 15, 'data/countries.json deve conter pelo menos 15 países');
assert(countries.some((country) => country.id === 'ukraine'), 'Ucrânia precisa estar entre os países jogáveis');

if (failures.length) {
  console.error('AUDIT FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('AUDIT OK — arquivos obrigatórios, JSON, PWA, mapa Ucrânia e estrutura base validados.');
