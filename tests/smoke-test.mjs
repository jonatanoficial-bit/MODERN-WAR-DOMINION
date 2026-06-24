import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const required = [
  "index.html",
  "css/styles.css",
  "js/app.js",
  "data/countries.json",
  "data/buildings.json",
  "data/units_catalog.json",
  "manifest.json",
  "service-worker.js",
  "assets/img/icon.svg",
  "assets/img/fallback-world.svg",
  "assets/asset_manifest.json",
  "assets/backgrounds/command_center_blue.png",
  "assets/buildings/army_base.png",
  "assets/units/naval/frigate.png"
];

for (const file of required) {
  if (!existsSync(file)) throw new Error(`Arquivo obrigatório ausente: ${file}`);
}

const html = readFileSync("index.html", "utf8");
const css = readFileSync("css/styles.css", "utf8");
const js = readFileSync("js/app.js", "utf8");
const countries = JSON.parse(readFileSync("data/countries.json", "utf8"));
const buildings = JSON.parse(readFileSync("data/buildings.json", "utf8"));
const units = JSON.parse(readFileSync("data/units_catalog.json", "utf8"));

if (!html.includes("leaflet@1.9.4")) throw new Error("Leaflet CDN não encontrado no HTML.");
if (!js.includes("https://tile.openstreetmap.org/{z}/{x}/{y}.png")) throw new Error("Tile real OpenStreetMap não configurado.");
if (!html.includes("forceLandscapeBtn") || !js.includes("screen.orientation")) throw new Error("Configuração mobile/landscape ausente.");
if (!css.includes("@media (orientation:portrait)")) throw new Error("Guard mobile portrait ausente.");
if (countries.length < 12) throw new Error("Poucos países no catálogo.");
if (buildings.length < 6) throw new Error("Poucas construções militares.");
if (units.length < 6) throw new Error("Poucas unidades iniciais.");
if (!buildings.some(b => b.id === "naval_port")) throw new Error("Porto militar ausente.");
if (!buildings.some(b => b.id === "air_base")) throw new Error("Base aérea ausente.");
if (!js.includes("makeRegions") || !js.includes("progressProduction")) throw new Error("Sistema regional/produção F6 ausente.");

const check = spawnSync("node", ["--check", "js/app.js"], { encoding: "utf8" });
if (check.status !== 0) throw new Error(check.stderr || check.stdout);

console.log("Smoke test OK — Fase 6 regiões, slots e produção funcionando estaticamente.");
