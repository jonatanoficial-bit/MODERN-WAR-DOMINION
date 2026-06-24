const VERSION = "0.7.0";
const PHASE = "Fase 7 — guerra, danos e reparo";
const SAVE_KEY = "MWD_SAVE_V7";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  countries: [],
  buildings: [],
  units: [],
  selectedCountry: null,
  game: null,
  map: null,
  layers: { countries: null, regions: null, bases: null, threats: null }
};

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

async function boot() {
  await loadData();
  bindUi();
  renderNationGrid();
  checkSave();
  registerServiceWorker();
}

async function loadData() {
  const [countries, buildings, units] = await Promise.all([
    fetch("data/countries.json").then(r => r.json()),
    fetch("data/buildings.json").then(r => r.json()),
    fetch("data/units_catalog.json").then(r => r.json())
  ]);
  state.countries = countries;
  state.buildings = buildings;
  state.units = units;
  state.selectedCountry = countries.find(c => c.id === "br") || countries[0];
}

function bindUi() {
  $("#newGameBtn").addEventListener("click", () => showScreen("screenNation"));
  $("#continueBtn").addEventListener("click", continueGame);
  $("#homeLogoBtn").addEventListener("click", () => showScreen("screenHome"));
  $("#fullscreenBtn").addEventListener("click", enterImmersiveMode);
  $("#forceLandscapeBtn").addEventListener("click", enterImmersiveMode);
  $("#nationSearch").addEventListener("input", renderNationGrid);
  $("#nextMonthBtn").addEventListener("click", advanceMonth);
  $("#regionSelect").addEventListener("change", event => {
    if (!state.game) return;
    state.game.selectedRegionId = event.target.value;
    saveGame();
    renderGame();
  });

  $$(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!btn.disabled) showScreen(btn.dataset.screen);
    });
  });

  $$(".side-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".side-tab").forEach(b => b.classList.remove("is-active"));
      $$(".side-panel").forEach(p => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      $("#" + btn.dataset.panel).classList.add("is-active");
    });
  });

  $$(".op-btn").forEach(btn => btn.addEventListener("click", () => launchOperation(btn.dataset.op)));
}

function showScreen(id) {
  $$(".screen").forEach(s => s.classList.remove("screen-active"));
  $("#" + id).classList.add("screen-active");
  $$(".tab-btn").forEach(t => t.classList.toggle("is-active", t.dataset.screen === id));
  if (id === "screenWar") setTimeout(() => state.map?.invalidateSize(), 160);
}

async function enterImmersiveMode() {
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch (err) { console.info("Fullscreen indisponível", err); }
  try {
    if (screen.orientation?.lock) await screen.orientation.lock("landscape");
  } catch (err) { console.info("Bloqueio de orientação indisponível", err); }
}

function checkSave() {
  $("#continueBtn").disabled = !localStorage.getItem(SAVE_KEY);
}

function renderNationGrid() {
  const term = ($("#nationSearch")?.value || "").toLowerCase().trim();
  const grid = $("#nationGrid");
  grid.innerHTML = "";
  const list = state.countries.filter(c => [c.name, c.capital, c.region, c.doctrine, c.bloc, c.iso].join(" ").toLowerCase().includes(term));
  list.forEach(country => {
    const card = document.createElement("article");
    card.className = "nation-card";
    card.innerHTML = `
      <div class="nation-top"><span class="flag">${country.flag}</span><div><h3>${country.name}</h3><small>${country.capital} · ${country.region}</small></div></div>
      <small>${country.doctrine}</small>
      <div class="stat-pills"><span>Militar ${country.military}</span><span>PIB ${country.gdpGame}</span><span>Defesa ${country.defenseBudget}</span><span>Navios ${country.warships}</span><span>Aeronaves ${country.airframes}</span><span>${country.nuclear ? "Nuclear" : "Convencional"}</span></div>
      <button class="select-country">Comandar ${country.flag}</button>`;
    card.querySelector("button").addEventListener("click", () => startGame(country.id));
    grid.appendChild(card);
  });
}

function makeInitialGame(countryId) {
  const country = state.countries.find(c => c.id === countryId) || state.countries[0];
  const regions = makeRegions(country);
  return {
    version: VERSION,
    phase: PHASE,
    countryId: country.id,
    month: 0,
    year: 2027,
    finance: Math.round(320 + country.economy * 3 + country.defenseBudget * 1.8),
    industry: Math.round(210 + country.industry * 3),
    energy: Math.round(160 + country.oil * 2),
    food: Math.round(120 + country.food * 2),
    soldiers: country.activeForces * 1000,
    readiness: 48 + Math.round(country.military / 3),
    landPower: Math.round(country.armor / 100 + country.military / 2),
    airPower: Math.round(country.airframes / 35 + country.military / 2),
    navalPower: Math.round(country.warships / 5 + country.military / 2),
    missilePower: Math.round(country.missiles / 18),
    defense: Math.round(40 + country.military / 2),
    logistics: Math.round(35 + country.ports * 4 + country.airports * 3),
    cyber: country.cyber,
    intel: country.intel,
    stability: country.stability,
    worldTension: 39,
    escalation: country.nuclear ? 8 : 0,
    selectedRegionId: regions[0].id,
    regions,
    bases: [],
    construction: [],
    production: [],
    units: [],
    relations: seedRelations(country),
    events: [eventText("sistema", `Campanha iniciada com ${country.name}. Agora sua prioridade é ocupar slots regionais com bases militares.`)],
    threats: generateThreats(country)
  };
}

function makeRegions(country) {
  const [lat, lng] = country.coords;
  const coast = country.ports > 2;
  return [
    { id: "capital", name: `Região da capital — ${country.capital}`, kind: "Capital", terrain: "comando nacional", coords: [lat, lng], slots: 4, defenseBonus: 10, logistics: 8, priority: 5 },
    { id: "industrial", name: "Cinturão industrial", kind: "Indústria", terrain: "fábricas e logística", coords: [lat + 1.1, lng + 1.9], slots: 3, defenseBonus: 4, logistics: 10, priority: 4 },
    { id: "coast", name: coast ? "Costa estratégica" : "Rota estratégica externa", kind: "Naval", terrain: coast ? "litoral e portos" : "corredor logístico", coords: [lat - 1.5, lng - 2.8], slots: 3, defenseBonus: 3, logistics: 7, priority: 4 },
    { id: "border", name: "Fronteira avançada", kind: "Fronteira", terrain: "defesa terrestre", coords: [lat + 2.3, lng - 1.6], slots: 3, defenseBonus: 8, logistics: 3, priority: 3 },
    { id: "aircorridor", name: "Corredor aéreo militar", kind: "Aérea", terrain: "aeroportos e radares", coords: [lat - 2.2, lng + 2.4], slots: 3, defenseBonus: 5, logistics: 6, priority: 3 },
    { id: "reserve", name: "Zona de reserva estratégica", kind: "Reserva", terrain: "profundidade defensiva", coords: [lat + 3.0, lng + 3.1], slots: 2, defenseBonus: 7, logistics: 2, priority: 2 }
  ];
}

function seedRelations(playerCountry) {
  return state.countries.filter(c => c.id !== playerCountry.id).map(c => {
    const distance = getDistance(playerCountry.coords, c.coords);
    const blocBonus = c.bloc === playerCountry.bloc ? 18 : 0;
    const regionBonus = c.region === playerCountry.region ? 8 : 0;
    const nuclearTension = c.nuclear || playerCountry.nuclear ? 6 : 0;
    return {
      id: c.id,
      relation: clamp(48 + blocBonus + regionBonus - nuclearTension - Math.round(distance / 2600), 8, 92),
      tension: clamp(25 + nuclearTension + Math.round(distance / 3600), 10, 88),
      trade: clamp(38 + regionBonus + Math.round(Math.random() * 28), 12, 88)
    };
  });
}

function generateThreats(playerCountry) {
  const rivals = state.countries
    .filter(c => c.id !== playerCountry.id)
    .sort((a, b) => (b.military + b.missiles + (b.nuclear ? 20 : 0)) - (a.military + a.missiles + (a.nuclear ? 20 : 0)))
    .slice(0, 4);
  return rivals.map((c, idx) => ({
    id: c.id,
    countryId: c.id,
    level: clamp(42 + idx * 7 + Math.round(Math.random() * 14), 25, 91),
    type: ["pressão naval", "alerta aéreo", "crise diplomática", "atividade cyber"][idx % 4],
    coords: jitter(c.coords, 2 + idx)
  }));
}

function startGame(countryId) {
  state.game = makeInitialGame(countryId);
  saveGame();
  $(".tab-btn[data-screen='screenWar']").disabled = false;
  renderGame();
  showScreen("screenWar");
  enterImmersiveMode();
}

function continueGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  state.game = JSON.parse(raw);
  $(".tab-btn[data-screen='screenWar']").disabled = false;
  renderGame();
  showScreen("screenWar");
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state.game));
  checkSave();
}

function renderGame() {
  renderSummary();
  renderRegionSelect();
  renderRegionBoard();
  renderBuildList();
  renderProduction();
  renderUnitList();
  renderTargetSelect();
  renderIntel();
  initMap();
  updateMapLayers();
}

function renderSummary() {
  const g = state.game;
  const c = getPlayerCountry();
  $("#monthLabel").textContent = `${monthNames[g.month % 12]}/${g.year}`;
  $("#countrySummary").innerHTML = `<h2><span class="big-flag">${c.flag}</span> ${c.name}</h2><small>${c.capital} · ${c.doctrine}</small><div class="metrics"><div class="metric"><small>Finanças</small><strong>${g.finance}</strong></div><div class="metric"><small>Indústria</small><strong>${g.industry}</strong></div><div class="metric"><small>Energia</small><strong>${g.energy}</strong></div><div class="metric"><small>Soldados</small><strong>${formatSoldiers(g.soldiers)}</strong></div><div class="metric"><small>Poder</small><strong>${powerIndex()}</strong></div><div class="metric"><small>Bases</small><strong>${g.bases.length}</strong></div></div>`;
}

function getSelectedRegion() {
  return state.game.regions.find(r => r.id === state.game.selectedRegionId) || state.game.regions[0];
}

function renderRegionSelect() {
  const select = $("#regionSelect");
  const current = state.game.selectedRegionId;
  select.innerHTML = "";
  state.game.regions.forEach(r => {
    const used = regionBases(r.id).length + state.game.construction.filter(j => j.regionId === r.id).length;
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = `${r.name} · slots ${used}/${r.slots}`;
    select.appendChild(opt);
  });
  select.value = current;
}

function renderRegionBoard() {
  const board = $("#regionBoard");
  board.innerHTML = "";
  state.game.regions.forEach(r => {
    const used = regionBases(r.id).length + state.game.construction.filter(j => j.regionId === r.id).length;
    const card = document.createElement("article");
    card.className = `region-card ${state.game.selectedRegionId === r.id ? "is-selected" : ""}`;
    card.innerHTML = `<div><h3>${r.kind}</h3><strong>${r.name}</strong><small>${r.terrain}</small></div><div class="region-stats"><span>Slots ${used}/${r.slots}</span><span>Defesa +${r.defenseBonus}</span><span>Log. +${r.logistics}</span></div>`;
    card.addEventListener("click", () => {
      state.game.selectedRegionId = r.id;
      saveGame();
      renderGame();
    });
    board.appendChild(card);
  });

  const r = getSelectedRegion();
  const bases = regionBases(r.id);
  const unitsInRegion = regionUnits(r.id).reduce((sum, stack) => sum + stack.qty, 0);
  const summary = $("#selectedRegionSummary");
  if (summary) summary.textContent = `Região ativa: ${r.name}. Bases prontas: ${bases.length}/${r.slots}. Unidades ativas: ${unitsInRegion}. Produção e reparo serão enviados para esta região.`;

  if (bases.length) {
    const h = document.createElement("h2");
    h.className = "section-subtitle";
    h.textContent = "Bases prontas na região";
    board.appendChild(h);
    const roster = document.createElement("div");
    roster.className = "base-roster";
    bases.forEach(base => {
      const b = getBuilding(base.type);
      const upCost = upgradeCost(base);
      const repCost = repairCost(base);
      const canUp = base.level < (b.maxLevel || 5) && state.game.finance >= upCost.finance && state.game.industry >= upCost.industry;
      const canRepair = base.condition < 100 && state.game.finance >= repCost.finance && state.game.industry >= repCost.industry && state.game.energy >= repCost.energy;
      const condClass = base.condition >= 70 ? 'good' : base.condition >= 40 ? 'warn' : 'danger';
      const row = document.createElement("article");
      row.className = "base-row";
      row.innerHTML = `<img src="${b.image}" alt="${b.name}"><div><strong>${b.name}</strong><small>${r.name} · nível ${base.level} · condição <span class="base-condition ${condClass}">${base.condition}%</span></small><small>Upgrade $${upCost.finance}/Ind.${upCost.industry} · Reparo $${repCost.finance}/Ind.${repCost.industry}/En.${repCost.energy}</small></div><div class="base-actions"><button class="upgrade-btn" ${canUp ? "" : "disabled"}>Subir nível</button><button class="repair-btn" ${canRepair ? "" : "disabled"}>Reparar</button></div>`;
      row.querySelector(".upgrade-btn").addEventListener("click", () => upgradeBase(base.id));
      row.querySelector(".repair-btn").addEventListener("click", () => repairBase(base.id));
      roster.appendChild(row);
    });
    board.appendChild(roster);
    const unitSummary = document.createElement('div');
    unitSummary.className = 'region-unit-summary';
    unitSummary.textContent = unitsInRegion ? `Guarnição regional: ${regionUnits(r.id).map(stack => `${getUnit(stack.id).name} x${stack.qty}`).join(', ')}` : 'Guarnição regional: nenhuma unidade ativa ainda.';
    board.appendChild(unitSummary);
  }
}

function renderBuildList() {
  const list = $("#buildList");
  const g = state.game;
  const r = getSelectedRegion();
  list.innerHTML = "";
  const used = regionBases(r.id).length + g.construction.filter(j => j.regionId === r.id).length;
  if (g.construction.length) {
    const pending = document.createElement("div");
    pending.className = "event warn";
    pending.textContent = `Em construção: ${g.construction.map(x => `${getBuilding(x.buildingId).name} em ${getRegion(x.regionId).kind} (${x.remaining}m)`).join(", ")}`;
    list.appendChild(pending);
  }
  state.buildings.forEach(b => {
    const can = canAfford(b.cost) && used < r.slots;
    const card = document.createElement("article");
    card.className = "build-card";
    card.innerHTML = `${b.image ? `<img class="card-thumb" src="${b.image}" alt="${b.name}">` : ""}<div><h3>${b.icon} ${b.name}</h3><p>${b.role}</p><div class="cost-line">${r.name} · Custo: $${b.cost.finance} · Ind. ${b.cost.industry} · Energia ${b.cost.energy} · ${b.buildMonths}m</div></div><button ${can ? "" : "disabled"}>Construir</button>`;
    card.querySelector("button").addEventListener("click", () => buildBase(b.id));
    list.appendChild(card);
  });
}

function renderProduction() {
  const q = $("#productionQueue");
  if (!q) return;
  q.innerHTML = "";
  if (!state.game.production.length) {
    q.innerHTML = '<div class="event queue-empty">Nenhuma unidade em produção no momento.</div>';
    return;
  }
  state.game.production.forEach(job => {
    const u = getUnit(job.unitId);
    const r = getRegion(job.regionId);
    const card = document.createElement("article");
    card.className = "queue-card";
    card.innerHTML = `<img src="${u.image}" alt="${u.name}"><div><strong>${u.name}</strong><small>${r.name} · pronto em ${job.remaining} mês(es)</small></div>`;
    q.appendChild(card);
  });
}

function renderUnitList() {
  const list = $("#unitList");
  const r = getSelectedRegion();
  list.innerHTML = "";
  state.units.forEach(u => {
    const hasBase = hasOperationalBase(u.requires, r.id);
    const canBuy = hasBase && state.game.finance >= u.cost;
    const card = document.createElement("article");
    card.className = "unit-card";
    card.innerHTML = `${u.image ? `<img class="card-thumb" src="${u.image}" alt="${u.name}">` : ""}<div><h3>${u.icon} ${u.name}</h3><p>${u.role}</p><div class="cost-line">${u.class} · $${u.cost} · ${u.buildMonths}m · requer ${getBuilding(u.requires)?.name || u.requires} na região ativa</div></div><button ${canBuy ? "" : "disabled"}>Produzir</button>`;
    card.querySelector("button").addEventListener("click", () => queueUnit(u.id));
    list.appendChild(card);
  });
}

function renderTargetSelect() {
  const select = $("#targetSelect");
  select.innerHTML = "";
  state.countries.filter(c => c.id !== state.game.countryId).forEach(c => {
    const rel = state.game.relations.find(r => r.id === c.id);
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.flag} ${c.name} · tensão ${rel?.tension ?? 50}`;
    select.appendChild(opt);
  });
}

function renderIntel() {
  const g = state.game;
  $("#threatFill").style.width = `${clamp(g.worldTension + g.escalation, 0, 100)}%`;
  $("#intelGrid").innerHTML = `<div class="metric"><small>Tensão mundial</small><strong>${g.worldTension}</strong></div><div class="metric"><small>Escalada</small><strong>${g.escalation}</strong></div><div class="metric"><small>Defesa</small><strong>${g.defense}</strong></div><div class="metric"><small>Prontidão</small><strong>${g.readiness}</strong></div><div class="metric"><small>Cyber</small><strong>${g.cyber}</strong></div><div class="metric"><small>Logística</small><strong>${g.logistics}</strong></div>`;
  const feed = $("#eventFeed");
  feed.innerHTML = "";
  g.events.slice(-8).reverse().forEach(e => {
    const div = document.createElement("div");
    div.className = `event ${e.kind || ""}`;
    div.textContent = e.text;
    feed.appendChild(div);
  });
}

function initMap() {
  if (state.map) return;
  if (!window.L) {
    $("#mapFallback").hidden = false;
    return;
  }
  const c = getPlayerCountry();
  state.map = L.map("realMap", { zoomControl: true, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 7 }).setView(c.coords, 3);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    detectRetina: true
  }).addTo(state.map);
  state.layers.countries = L.layerGroup().addTo(state.map);
  state.layers.regions = L.layerGroup().addTo(state.map);
  state.layers.bases = L.layerGroup().addTo(state.map);
  state.layers.threats = L.layerGroup().addTo(state.map);
  state.map.on("tileerror", () => {
    if (!document.querySelector(".leaflet-tile-loaded")) $("#mapFallback").hidden = false;
  });
}

function updateMapLayers() {
  if (!state.map || !window.L) return;
  const g = state.game;
  const player = getPlayerCountry();
  Object.values(state.layers).forEach(layer => layer?.clearLayers());

  state.countries.forEach(c => {
    const isPlayer = c.id === player.id;
    const icon = L.divIcon({ className: "", html: `<div class="${isPlayer ? "marker-own" : "marker-country"}">${isPlayer ? player.flag : c.flag}</div>`, iconSize: isPlayer ? [38, 38] : [32, 32], iconAnchor: [16, 16] });
    L.marker(c.coords, { icon }).addTo(state.layers.countries).bindPopup(`<strong>${c.flag} ${c.name}</strong><br>${c.capital}<br>Militar: ${c.military} · PIB jogo: ${c.gdpGame}`);
  });

  g.regions.forEach(r => {
    const selected = r.id === g.selectedRegionId;
    const circle = L.circleMarker(r.coords, { radius: selected ? 13 : 9, color: selected ? "#5ff3ff" : "#6affad", weight: selected ? 3 : 2, fillColor: selected ? "#5ff3ff" : "#6affad", fillOpacity: selected ? .34 : .22 }).addTo(state.layers.regions);
    circle.bindPopup(`<strong>${r.name}</strong><br>${r.kind}<br>Slots: ${regionBases(r.id).length}/${r.slots}`);
    circle.on("click", () => { g.selectedRegionId = r.id; saveGame(); renderGame(); });
  });

  g.bases.forEach(base => {
    const b = getBuilding(base.type);
    const icon = L.divIcon({ className: "", html: `<div class="marker-base">${b.icon}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
    L.marker(base.coords, { icon }).addTo(state.layers.bases).bindPopup(`<strong>${b.name}</strong><br>${getRegion(base.regionId).name}<br>Nível ${base.level} · condição ${base.condition}%`);
  });

  g.threats.forEach(t => {
    const c = state.countries.find(x => x.id === t.countryId);
    const icon = L.divIcon({ className: "", html: `<div class="marker-threat">!</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
    L.marker(t.coords, { icon }).addTo(state.layers.threats).bindPopup(`<strong>${c?.flag || ""} ${c?.name || "Ameaça"}</strong><br>${t.type}<br>Nível ${t.level}`);
  });
  state.map.setView(player.coords, Math.max(state.map.getZoom(), 3));
}

function buildBase(buildingId) {
  const b = getBuilding(buildingId);
  const r = getSelectedRegion();
  const g = state.game;
  const used = regionBases(r.id).length + g.construction.filter(j => j.regionId === r.id).length;
  if (!b || !canAfford(b.cost) || used >= r.slots) return;
  g.finance -= b.cost.finance;
  g.industry -= b.cost.industry;
  g.energy -= b.cost.energy;
  g.construction.push({ buildingId, regionId: r.id, remaining: b.buildMonths, id: cryptoId() });
  g.events.push(eventText("sistema", `${b.name} entrou em construção na região ${r.name}.`));
  saveGame();
  renderGame();
}

function upgradeBase(baseId) {
  const base = state.game.bases.find(b => b.id === baseId);
  if (!base) return;
  const b = getBuilding(base.type);
  const cost = upgradeCost(base);
  if (base.level >= (b.maxLevel || 5) || state.game.finance < cost.finance || state.game.industry < cost.industry) return;
  state.game.finance -= cost.finance;
  state.game.industry -= cost.industry;
  base.level += 1;
  base.condition = clamp(base.condition + 8, 0, 100);
  applyEffects(scaleEffects(b.effects, .45));
  state.game.events.push(eventText("sistema", `${b.name} subiu para nível ${base.level} em ${getRegion(base.regionId).name}.`));
  saveGame();
  renderGame();
}

function queueUnit(unitId) {
  const u = getUnit(unitId);
  const r = getSelectedRegion();
  const g = state.game;
  if (!u || !hasOperationalBase(u.requires, r.id) || g.finance < u.cost) return;
  g.finance -= u.cost;
  g.production.push({ id: cryptoId(), unitId, regionId: r.id, remaining: u.buildMonths });
  g.events.push(eventText("sistema", `${u.name} entrou na fila de produção em ${r.name}.`));
  saveGame();
  renderGame();
}

function launchOperation(kind) {
  const targetId = $("#targetSelect").value;
  const target = state.countries.find(c => c.id === targetId);
  if (!target) return;
  const g = state.game;
  const costs = {
    recon: { finance: 12, energy: 4, tension: 2, power: g.intel + g.cyber },
    airstrike: { finance: 35, energy: 16, tension: 8, power: g.airPower + g.missilePower / 2 },
    naval: { finance: 42, energy: 18, tension: 9, power: g.navalPower + g.logistics / 2 },
    combined: { finance: 85, energy: 30, tension: 17, power: g.landPower + g.airPower + g.navalPower + g.missilePower }
  };
  const op = costs[kind];
  if (g.finance < op.finance || g.energy < op.energy) {
    g.events.push(eventText("warn", "Recursos insuficientes para iniciar essa operação."));
    renderIntel();
    return;
  }
  g.finance -= op.finance;
  g.energy -= op.energy;
  g.worldTension = clamp(g.worldTension + op.tension, 0, 100);
  g.escalation = clamp(g.escalation + Math.round(op.tension / 2), 0, 100);
  const defense = target.military + target.intel / 2 + (target.nuclear ? 14 : 0) + Math.random() * 30;
  const attack = op.power + g.readiness / 2 + regionalForceBonus() + Math.random() * 35;
  const success = attack >= defense;
  const label = { recon: "Reconhecimento estratégico", airstrike: "Ataque aéreo limitado", naval: "Bloqueio naval", combined: "Operação combinada" }[kind];
  if (success) {
    g.readiness = clamp(g.readiness - Math.round(op.tension / 3), 0, 100);
    g.intel = clamp(g.intel + (kind === "recon" ? 3 : 1), 0, 120);
    g.events.push(eventText(kind === "combined" ? "danger" : "sistema", `${label} contra ${target.name} teve sucesso tático. A tensão mundial subiu.`));
  } else {
    g.readiness = clamp(g.readiness - Math.round(op.tension / 2), 0, 100);
    g.stability = clamp(g.stability - 2, 0, 100);
    g.events.push(eventText("danger", `${label} contra ${target.name} falhou. Perdas políticas e alerta inimigo aumentaram.`));
  }
  const rel = g.relations.find(r => r.id === target.id);
  if (rel) {
    rel.tension = clamp(rel.tension + op.tension * 2, 0, 100);
    rel.relation = clamp(rel.relation - op.tension * 2, 0, 100);
  }
  maybeCounterAttack(target, Math.round(op.tension * 1.5));
  saveGame();
  renderGame();
}

function advanceMonth() {
  const g = state.game;
  const c = getPlayerCountry();
  g.month += 1;
  if (g.month % 12 === 0) g.year += 1;
  const upkeep = g.units.reduce((sum, stack) => sum + (getUnit(stack.id)?.upkeep || 0) * stack.qty, 0);
  g.finance += Math.round(45 + c.economy * 1.2 + g.stability / 3 - upkeep);
  g.industry += Math.round(24 + c.industry * .65 - g.bases.length);
  g.energy += Math.round(22 + c.oil * .55 - g.bases.length * 2 - Math.max(0, upkeep / 3));
  g.food += Math.round(15 + c.food * .4);
  g.readiness = clamp(g.readiness + Math.round(g.logistics / 22) - Math.round(g.worldTension / 35), 0, 100);
  g.worldTension = clamp(g.worldTension + randomInt(-3, 5), 0, 100);
  progressConstruction();
  progressProduction();
  monthlyWorldEvent();
  decayRelations();
  if (g.worldTension > 58 || Math.random() < .22) aiRaid();
  saveGame();
  renderGame();
}

function progressConstruction() {
  const g = state.game;
  const finished = [];
  g.construction.forEach(job => {
    job.remaining -= 1;
    if (job.remaining <= 0) finished.push(job);
  });
  g.construction = g.construction.filter(job => job.remaining > 0);
  finished.forEach(job => {
    const b = getBuilding(job.buildingId);
    const r = getRegion(job.regionId);
    const idx = g.bases.length + 1;
    const coords = jitter(r.coords, .55);
    g.bases.push({ id: job.id, type: job.buildingId, regionId: r.id, name: `${b.name} ${idx}`, level: 1, condition: 100, coords });
    applyEffects(b.effects);
    g.events.push(eventText("sistema", `${b.name} concluída em ${r.name}.`));
  });
}

function progressProduction() {
  const g = state.game;
  const finished = [];
  g.production.forEach(job => {
    const speed = g.logistics > 90 ? 2 : 1;
    job.remaining -= speed;
    if (job.remaining <= 0) finished.push(job);
  });
  g.production = g.production.filter(job => job.remaining > 0);
  finished.forEach(job => {
    const u = getUnit(job.unitId);
    const existing = g.units.find(x => x.id === u.id && x.regionId === job.regionId);
    if (existing) existing.qty += 1;
    else g.units.push({ id: u.id, regionId: job.regionId, qty: 1, veteran: 0 });
    addUnitPower(u);
    g.events.push(eventText("sistema", `${u.name} ficou operacional em ${getRegion(job.regionId).name}.`));
  });
}

function monthlyWorldEvent() {
  const g = state.game;
  const roll = Math.random();
  if (roll < .22) {
    g.finance += 35;
    g.events.push(eventText("sistema", "Contrato de defesa nacional reforçou o orçamento militar."));
  } else if (roll < .44) {
    g.worldTension = clamp(g.worldTension + 6, 0, 100);
    g.events.push(eventText("warn", "Crise internacional elevou a tensão mundial."));
  } else if (roll < .63) {
    g.intel = clamp(g.intel + 2, 0, 120);
    g.events.push(eventText("sistema", "Inteligência detectou movimentação militar estrangeira."));
  } else if (roll < .78) {
    g.energy = Math.max(0, g.energy - 18);
    g.events.push(eventText("warn", "Oscilação energética reduziu reservas operacionais."));
  } else {
    g.stability = clamp(g.stability + 2, 0, 100);
    g.events.push(eventText("sistema", "Apoio interno cresceu após investimento regional em defesa."));
  }
}

function decayRelations() {
  state.game.relations.forEach(r => {
    r.tension = clamp(r.tension + Math.round((state.game.worldTension - 50) / 22), 0, 100);
    if (r.tension > 70) r.relation = clamp(r.relation - 1, 0, 100);
  });
}

function aiRaid() {
  const g = state.game;
  const threat = g.threats.sort((a, b) => b.level - a.level)[0];
  const enemy = state.countries.find(c => c.id === threat.countryId);
  if (!enemy) return;
  const region = g.regions.sort((a, b) => regionRisk(b) - regionRisk(a))[0];
  let attack = threat.level + enemy.military / 2 + Math.random() * 25;
  const interceptChance = clamp((regionalRadarCover(region.id) + regionalAirCover(region.id) + g.intel + g.readiness) / 240, 8, 82) / 100;
  const intercepted = Math.random() < interceptChance;
  if (intercepted) {
    attack -= 12 + regionalAirCover(region.id) / 5 + regionalRadarCover(region.id) / 6;
    g.events.push(eventText("warn", `Defesas regionais em ${region.name} interceptaram parte da ameaça de ${enemy.name}.`));
  }
  const defense = g.defense + region.defenseBonus + g.readiness / 2 + g.intel / 3 + regionalDefense(region.id) + Math.random() * 35;
  if (attack > defense) {
    const loss = randomInt(12, 30);
    g.finance = Math.max(0, g.finance - loss);
    g.readiness = clamp(g.readiness - 5, 0, 100);
    const base = regionBases(region.id).sort((a, b) => a.condition - b.condition)[0];
    if (base) {
      const damage = intercepted ? randomInt(6, 14) : randomInt(12, 28);
      base.condition = clamp(base.condition - damage, 0, 100);
      g.events.push(eventText("danger", `Alerta vermelho: ${enemy.name} atingiu ${getBuilding(base.type).name} em ${region.name}. Condição da base: ${base.condition}%.`));
      if (base.condition <= 12) destroyBase(base.id, `${enemy.name} destruiu uma instalação militar em ${region.name}.`);
    } else {
      g.events.push(eventText("danger", `Alerta vermelho: ${enemy.name} realizou incursão contra ${region.name}. Houve perdas regionais.`));
    }
  } else {
    g.readiness = clamp(g.readiness + 2, 0, 100);
    g.events.push(eventText("warn", `Ataque de ${enemy.name} contra ${region.name} foi contido pela defesa regional.`));
  }
  threat.level = clamp(threat.level + randomInt(-10, 8), 20, 98);
}

function maybeCounterAttack(target, pressure) {
  const g = state.game;
  const chance = clamp((target.military + pressure + g.worldTension - g.defense) / 150, .05, .68);
  if (Math.random() > chance) return;
  const enemyPower = target.military + target.airframes / 80 + target.missiles / 30 + Math.random() * 25;
  const defensePower = g.defense + g.readiness / 2 + g.intel / 4 + regionalForceBonus() + Math.random() * 30;
  if (enemyPower > defensePower) {
    const damage = Math.round(8 + Math.random() * 16);
    g.finance = Math.max(0, g.finance - damage);
    g.industry = Math.max(0, g.industry - Math.round(damage / 2));
    g.readiness = clamp(g.readiness - 4, 0, 100);
    const region = getSelectedRegion();
    const base = regionBases(region.id).sort((a, b) => a.condition - b.condition)[0];
    if (base) {
      base.condition = clamp(base.condition - randomInt(5, 16), 0, 100);
      g.events.push(eventText("danger", `${target.name} respondeu e danificou ${getBuilding(base.type).name} em ${region.name}. Condição atual: ${base.condition}%.`));
      if (base.condition <= 12) destroyBase(base.id, `${target.name} destruiu uma instalação militar em ${region.name}.`);
    } else {
      g.events.push(eventText("danger", `${target.name} respondeu com ataque limitado. Perda de finanças e indústria.`));
    }
  } else {
    g.readiness = clamp(g.readiness + 1, 0, 100);
    g.events.push(eventText("warn", `${target.name} tentou resposta limitada, mas a defesa interceptou a maior parte.`));
  }
}

function addUnitPower(u) {
  const g = state.game;
  if (u.class === "Terrestre") g.landPower += u.power;
  if (u.class === "Aéreo") g.airPower += u.power;
  if (u.class === "Naval") g.navalPower += u.power;
  if (u.class === "Estratégico") g.missilePower += u.power;
  g.readiness = clamp(g.readiness + 2, 0, 100);
}

function applyEffects(effects) {
  Object.entries(effects).forEach(([key, value]) => {
    if (key === "soldiers") state.game.soldiers += value;
    else state.game[key] = clamp((state.game[key] || 0) + value, 0, key === "soldiers" ? 999999999 : 9999);
  });
}

function scaleEffects(effects, factor) {
  const out = {};
  Object.entries(effects).forEach(([key, value]) => out[key] = Math.round(value * factor));
  return out;
}

function canAfford(cost) {
  const g = state.game;
  return g.finance >= cost.finance && g.industry >= cost.industry && g.energy >= cost.energy;
}
function regionBases(regionId) { return state.game.bases.filter(b => b.regionId === regionId); }
function regionUnits(regionId) { return state.game.units.filter(u => u.regionId === regionId); }
function hasOperationalBase(type, regionId) { return state.game.bases.some(b => b.type === type && b.regionId === regionId && b.condition > 20); }
function regionalDefense(regionId) { return regionBases(regionId).reduce((sum, b) => sum + ((getBuilding(b.type)?.effects?.defense || 0) * b.level * (b.condition / 100)), 0); }
function regionalAirCover(regionId) { return regionBases(regionId).filter(b => b.type === 'air_base').reduce((sum, b) => sum + 16 * b.level * (b.condition / 100), 0); }
function regionalRadarCover(regionId) { return regionBases(regionId).filter(b => b.type === 'radar_station').reduce((sum, b) => sum + 14 * b.level * (b.condition / 100), 0); }
function regionalForceBonus() { return state.game.regions.reduce((sum, r) => sum + regionBases(r.id).length * r.priority, 0); }
function regionRisk(r) { return r.priority * 10 + (r.slots - regionBases(r.id).length) * 4 + (100 - averageRegionCondition(r.id)) / 6; }
function averageRegionCondition(regionId) { const arr = regionBases(regionId); return arr.length ? Math.round(arr.reduce((s,b)=>s+b.condition,0)/arr.length) : 100; }
function upgradeCost(base) { return { finance: Math.round(38 * base.level * 1.45), industry: Math.round(24 * base.level * 1.35) }; }
function repairCost(base) { const missing = Math.max(0, 100 - base.condition); return { finance: Math.max(8, Math.round(missing * 1.6 * Math.max(1, base.level * .9))), industry: Math.max(4, Math.round(missing * .8)), energy: Math.max(2, Math.round(missing * .35)) }; }
function repairBase(baseId) { const base = state.game.bases.find(b => b.id === baseId); if (!base) return; const cost = repairCost(base); if (base.condition >= 100 || state.game.finance < cost.finance || state.game.industry < cost.industry || state.game.energy < cost.energy) return; state.game.finance -= cost.finance; state.game.industry -= cost.industry; state.game.energy -= cost.energy; base.condition = clamp(base.condition + randomInt(18, 32), 0, 100); state.game.readiness = clamp(state.game.readiness + 1, 0, 100); state.game.events.push(eventText('sistema', `${getBuilding(base.type).name} recebeu manutenção em ${getRegion(base.regionId).name}. Condição atual: ${base.condition}%.`)); saveGame(); renderGame(); }
function destroyBase(baseId, reason) { const idx = state.game.bases.findIndex(b => b.id === baseId); if (idx === -1) return; const base = state.game.bases[idx]; const building = getBuilding(base.type); const factor = 1 + Math.max(0, base.level - 1) * 0.45; const reverse = {}; Object.entries(building.effects).forEach(([key, value]) => reverse[key] = -Math.round(value * factor)); applyEffects(reverse); state.game.bases.splice(idx, 1); state.game.events.push(eventText('danger', reason || `${building.name} foi destruída.`)); }
function getBuilding(id) { return state.buildings.find(b => b.id === id); }
function getUnit(id) { return state.units.find(u => u.id === id); }
function getRegion(id) { return state.game.regions.find(r => r.id === id) || state.game.regions[0]; }
function getPlayerCountry() { return state.countries.find(c => c.id === state.game?.countryId) || state.selectedCountry || state.countries[0]; }
function powerIndex() { const g = state.game; return Math.round((g.landPower + g.airPower + g.navalPower + g.missilePower + g.defense + g.logistics + g.cyber / 2) / 5); }
function eventText(kind, text) { return { kind, text, at: new Date().toISOString() }; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Math.round(v))); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function formatSoldiers(n) { return n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : `${Math.round(n / 1000)}k`; }
function cryptoId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function jitter([lat, lng], spread) { return [lat + (Math.random() - .5) * spread, lng + (Math.random() - .5) * spread * 1.4]; }
function getDistance(a, b) { const R = 6371, dLat = deg2rad(b[0] - a[0]), dLon = deg2rad(b[1] - a[1]); const x = Math.sin(dLat / 2) ** 2 + Math.cos(deg2rad(a[0])) * Math.cos(deg2rad(b[0])) * Math.sin(dLon / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
function deg2rad(d) { return d * Math.PI / 180; }

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
  let deferredPrompt;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    $("#installBtn").hidden = false;
  });
  $("#installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("#installBtn").hidden = true;
  });
}

boot().catch(err => {
  console.error(err);
  document.body.innerHTML = `<main style="padding:24px;color:white;background:#050914;min-height:100vh"><h1>Falha ao iniciar Modern War Dominion</h1><pre>${err.message}</pre></main>`;
});
