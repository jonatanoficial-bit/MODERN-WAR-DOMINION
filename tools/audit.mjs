import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const js = readFileSync("js/app.js", "utf8");
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const countries = JSON.parse(readFileSync("data/countries.json", "utf8"));

const assertions = [
  [html.includes("Leaflet/OpenStreetMap"), "HTML deve explicar mapa real Leaflet/OpenStreetMap."],
  [html.includes("realMap"), "Container realMap deve existir."],
  [js.includes("L.map"), "JS deve inicializar Leaflet."],
  [js.includes("OpenStreetMap"), "JS deve manter atribuição OSM."],
  [js.includes("makeRegions") && js.includes("progressProduction"), "JS deve conter regiões e produção militar."],
  [manifest.orientation === "landscape", "Manifest deve solicitar orientação landscape."],
  [manifest.display === "fullscreen", "Manifest deve usar display fullscreen."],
  [countries.every(c => Array.isArray(c.coords) && c.coords.length === 2), "Todos os países precisam de coordenadas reais aproximadas."],
  [countries.every(c => c.flag && c.name && c.capital && c.military !== undefined), "Todos os países precisam de bandeira e dados militares."]
];

const failed = assertions.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, message] of failed) console.error("Falha:", message);
  process.exit(1);
}

console.log("Audit OK — Fase 6 com mapa real, landscape, regiões e assets validados.");
