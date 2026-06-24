import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignore = new Set(['docs/INTEGRITY_MANIFEST.json']);
const entries = [];
function walk(dir) {
  for (const item of readdirSync(dir)) {
    const path = join(dir, item);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else {
      const rel = relative(root, path).replaceAll('\\', '/');
      if (!ignore.has(rel)) {
        const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
        entries.push({ file: rel, bytes: stat.size, sha256: hash });
      }
    }
  }
}
walk(root);
entries.sort((a, b) => a.file.localeCompare(b.file));
writeFileSync(join(root, 'docs/INTEGRITY_MANIFEST.json'), JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2));
console.log(`Integridade OK — ${entries.length} itens no manifesto.`);
