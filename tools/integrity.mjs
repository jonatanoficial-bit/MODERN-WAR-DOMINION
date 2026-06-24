import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const ignored = new Set(['node_modules', '.git']);
const manifest = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else {
      const relative = path.relative(root, absolute).replaceAll('\\', '/');
      const buffer = fs.readFileSync(absolute);
      manifest.push({ file: relative, bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') });
    }
  }
}

walk(root);
manifest.sort((a, b) => a.file.localeCompare(b.file));
const out = path.join(root, 'docs', 'INTEGRITY_MANIFEST.json');
fs.writeFileSync(out, `${JSON.stringify({ generatedAt: new Date().toISOString(), files: manifest }, null, 2)}\n`);
console.log(`INTEGRITY OK — ${manifest.length} arquivos registrados em docs/INTEGRITY_MANIFEST.json`);
