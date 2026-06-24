import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const files = [];
function walk(dir) {
  for (const item of readdirSync(dir)) {
    const path = join(dir, item);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(root);

const forbidden = ['eval(', 'document.write(', 'ukraine-map-free.svg'];
for (const file of files) {
  if (!/\.(html|js|css|json|md|svg)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const token of forbidden) {
    if (text.includes(token)) {
      throw new Error(`Token proibido encontrado em ${file}: ${token}`);
    }
  }
}

const index = readFileSync(join(root, 'index.html'), 'utf8');
if (!index.includes('Mapa mundial gratuito')) throw new Error('Index não destaca mapa mundial gratuito.');
if (!index.includes('Leaflet/OpenStreetMap')) throw new Error('Index não cita estilo Leaflet/OpenStreetMap.');

console.log(`Auditoria OK — ${files.length} arquivos verificados.`);
