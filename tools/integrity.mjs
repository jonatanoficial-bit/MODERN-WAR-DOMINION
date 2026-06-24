import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const skip = new Set(["docs/INTEGRITY_MANIFEST.json"]);
function walk(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (skip.has(rel)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, rel));
    else out.push(rel);
  }
  return out.sort();
}

const files = walk(".");
const manifest = {
  project: "Modern War Dominion",
  version: "0.4.0",
  generated_utc: new Date().toISOString(),
  files: files.map(file => ({
    file,
    sha256: createHash("sha256").update(readFileSync(file)).digest("hex")
  }))
};
writeFileSync("docs/INTEGRITY_MANIFEST.json", JSON.stringify(manifest, null, 2));
console.log(`Integrity OK — ${files.length} arquivos registrados.`);
