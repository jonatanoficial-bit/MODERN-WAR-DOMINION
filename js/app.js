const VERSION = "0.5.0";
const PHASE = "Fase 5 — pacote visual militar base";
const SAVE_KEY = "MWD_SAVE_V5";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  countries: [],
  buildings: [],
  units: [],
  selectedCountry: null,
  game: null,
  map: null,
  layers: {
    countries: null,
    bases: null,
    threats: null
  }
};

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

async function boot(){
  await loadData();
  bindUi();
  renderNationGrid();
  checkSave();
  registerServiceWorker();
}

async function loadData(){
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

function bindUi(){
  $("#newGameBtn").addEventListener("click", () => showScreen("screenNation"));
  $("#continueBtn").addEventListener("click", continueGame);
  $("#homeLogoBtn").addEventListener("click", () => showScreen("screenHome"));
  $("#fullscreenBtn").addEventListener("click", enterImmersiveMode);
  $("#forceLandscapeBtn").addEventListener("click", enterImmersiveMode);
  $("#nationSearch").addEventListener("input", renderNationGrid);
  $("#nextMonthBtn").addEventListener("click", advanceMonth);

  $$(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if(!btn.disabled) showScreen(btn.dataset.screen);
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

function showScreen(id){
  $$(".screen").forEach(s => s.classList.remove("screen-active"));
  $("#" + id).classList.add("screen-active");
  $$(".tab-btn").forEach(t => t.classList.toggle("is-active", t.dataset.screen === id));
  if(id === "screenWar") setTimeout(() => state.map?.invalidateSize(), 160);
}

async function enterImmersiveMode(){
  try{
    if(document.documentElement.requestFullscreen && !document.fullscreenElement){
      await document.documentElement.requestFullscreen();
    }
  }catch(err){ console.info("Fullscreen indisponível", err); }

  try{
    if(screen.orientation?.lock){
      await screen.orientation.lock("landscape");
    }
  }catch(err){ console.info("Bloqueio de orientação indisponível", err); }
}

function checkSave(){
  const hasSave = Boolean(localStorage.getItem(SAVE_KEY));
  $("#continueBtn").disabled = !hasSave;
}

function renderNationGrid(){
  const term = ($("#nationSearch")?.value || "").toLowerCase().trim();
  const grid = $("#nationGrid");
  grid.innerHTML = "";
  const list = state.countries.filter(c => [c.name,c.capital,c.region,c.doctrine,c.bloc,c.iso].join(" ").toLowerCase().includes(term));
  list.forEach(country => {
    const card = document.createElement("article");
    card.className = "nation-card";
    card.innerHTML = `
      <div class="nation-top">
        <span class="flag">${country.flag}</span>
        <div><h3>${country.name}</h3><small>${country.capital} · ${country.region}</small></div>
      </div>
      <small>${country.doctrine}</small>
      <div class="stat-pills">
        <span>Militar ${country.military}</span>
        <span>PIB Jogo ${country.gdpGame}</span>
        <span>Defesa ${country.defenseBudget}</span>
        <span>Navios ${country.warships}</span>
        <span>Aeronaves ${country.airframes}</span>
        <span>${country.nuclear ? "Nuclear" : "Convencional"}</span>
      </div>
      <button class="select-country">Comandar ${country.flag}</button>
    `;
    card.querySelector("button").addEventListener("click", () => startGame(country.id));
    grid.appendChild(card);
  });
}

function makeInitialGame(countryId){
  const country = state.countries.find(c => c.id === countryId) || state.countries[0];
  return {
    version: VERSION,
    phase: PHASE,
    countryId: country.id,
    month: 0,
    year: 2027,
    finance: Math.round(280 + country.economy * 3 + country.defenseBudget * 1.8),
    industry: Math.round(180 + country.industry * 3),
    energy: Math.round(130 + country.oil * 2),
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
    worldTension: 37,
    escalation: country.nuclear ? 8 : 0,
    bases: [],
    construction: [],
    units: [],
    relations: seedRelations(country),
    events: [eventText("sistema", `Campanha iniciada com ${country.name}. Prioridade: construir infraestrutura militar e sobreviver à escalada global.`)],
    threats: generateThreats(country)
  };
}

function seedRelations(playerCountry){
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

function generateThreats(playerCountry){
  const rivals = state.countries
    .filter(c => c.id !== playerCountry.id)
    .sort((a,b) => (b.military + b.missiles + (b.nuclear ? 20 : 0)) - (a.military + a.missiles + (a.nuclear ? 20 : 0)))
    .slice(0, 4);
  return rivals.map((c, idx) => ({
    id: c.id,
    countryId: c.id,
    level: clamp(42 + idx * 7 + Math.round(Math.random() * 14), 25, 91),
    type: ["pressão naval", "alerta aéreo", "crise diplomática", "atividade cyber"][idx % 4],
    coords: jitter(c.coords, 2 + idx)
  }));
}

function startGame(countryId){
  state.game = makeInitialGame(countryId);
  saveGame();
  $(".tab-btn[data-screen='screenWar']").disabled = false;
  renderGame();
  showScreen("screenWar");
  enterImmersiveMode();
}

function continueGame(){
  const raw = localStorage.getItem(SAVE_KEY);
  if(!raw) return;
  state.game = JSON.parse(raw);
  $(".tab-btn[data-screen='screenWar']").disabled = false;
  renderGame();
  showScreen("screenWar");
}

function saveGame(){
  localStorage.setItem(SAVE_KEY, JSON.stringify(state.game));
  checkSave();
}

function renderGame(){
  renderSummary();
  renderBuildList();
  renderUnitList();
  renderTargetSelect();
  renderIntel();
  initMap();
  updateMapLayers();
}

function renderSummary(){
  const g = state.game;
  const c = getPlayerCountry();
  $("#monthLabel").textContent = `${monthNames[g.month % 12]}/${g.year}`;
  $("#countrySummary").innerHTML = `
    <h2><span class="big-flag">${c.flag}</span> ${c.name}</h2>
    <small>${c.capital} · ${c.doctrine}</small>
    <div class="metrics">
      <div class="metric"><small>Finanças</small><strong>${g.finance}</strong></div>
      <div class="metric"><small>Indústria</small><strong>${g.industry}</strong></div>
      <div class="metric"><small>Energia</small><strong>${g.energy}</strong></div>
      <div class="metric"><small>Soldados</small><strong>${formatSoldiers(g.soldiers)}</strong></div>
      <div class="metric"><small>Poder</small><strong>${powerIndex()}</strong></div>
      <div class="metric"><small>Bases</small><strong>${g.bases.length}</strong></div>
    </div>
  `;
}

function renderBuildList(){
  const list = $("#buildList");
  const g = state.game;
  list.innerHTML = "";
  state.buildings.forEach(b => {
    const can = canAfford(b.cost);
    const card = document.createElement("article");
    card.className = "build-card";
    card.innerHTML = `
      ${b.image ? `<img class="card-thumb" src="${b.image}" alt="${b.name}">` : ''}<div>
        <h3>${b.icon} ${b.name}</h3>
        <p>${b.role}</p>
        <div class="cost-line">Custo: $${b.cost.finance} · Ind. ${b.cost.industry} · Energia ${b.cost.energy} · ${b.buildMonths} mês(es)</div>
      </div>
      <button ${can ? "" : "disabled"}>Construir</button>
    `;
    card.querySelector("button").addEventListener("click", () => buildBase(b.id));
    list.appendChild(card);
  });
  if(g.construction.length){
    const pending = document.createElement("div");
    pending.className = "event warn";
    pending.textContent = `Em construção: ${g.construction.map(x => `${getBuilding(x.buildingId).name} (${x.remaining}m)`).join(", ")}`;
    list.prepend(pending);
  }
}

function renderUnitList(){
  const list = $("#unitList");
  const g = state.game;
  list.innerHTML = "";
  state.units.forEach(u => {
    const hasBase = g.bases.some(b => b.type === u.requires);
    const canBuy = hasBase && g.finance >= u.cost;
    const card = document.createElement("article");
    card.className = "unit-card";
    card.innerHTML = `
      ${u.image ? `<img class="card-thumb" src="${u.image}" alt="${u.name}">` : ''}<div>
        <h3>${u.icon} ${u.name}</h3>
        <p>${u.role}</p>
        <div class="cost-line">Classe: ${u.class} · Custo $${u.cost} · Manutenção ${u.upkeep} · Requer ${getBuilding(u.requires)?.name || u.requires}</div>
      </div>
      <button ${canBuy ? "" : "disabled"}>Comprar</button>
    `;
    card.querySelector("button").addEventListener("click", () => buyUnit(u.id));
    list.appendChild(card);
  });
}

function renderTargetSelect(){
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

function renderIntel(){
  const g = state.game;
  $("#threatFill").style.width = `${clamp(g.worldTension + g.escalation, 0, 100)}%`;
  $("#intelGrid").innerHTML = `
    <div class="metric"><small>Tensão mundial</small><strong>${g.worldTension}</strong></div>
    <div class="metric"><small>Escalada</small><strong>${g.escalation}</strong></div>
    <div class="metric"><small>Defesa</small><strong>${g.defense}</strong></div>
    <div class="metric"><small>Prontidão</small><strong>${g.readiness}</strong></div>
    <div class="metric"><small>Cyber</small><strong>${g.cyber}</strong></div>
    <div class="metric"><small>Logística</small><strong>${g.logistics}</strong></div>
  `;
  const feed = $("#eventFeed");
  feed.innerHTML = "";
  g.events.slice(-8).reverse().forEach(e => {
    const div = document.createElement("div");
    div.className = `event ${e.kind || ""}`;
    div.textContent = e.text;
    feed.appendChild(div);
  });
}

function initMap(){
  if(state.map) return;
  if(!window.L){
    $("#mapFallback").hidden = false;
    return;
  }
  const c = getPlayerCountry();
  state.map = L.map("realMap", {
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 7
  }).setView(c.coords, 3);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    detectRetina: true
  }).addTo(state.map);

  state.layers.countries = L.layerGroup().addTo(state.map);
  state.layers.bases = L.layerGroup().addTo(state.map);
  state.layers.threats = L.layerGroup().addTo(state.map);

  state.map.on("tileerror", () => {
    // Mantém o jogo funcionando mesmo se o navegador bloquear tiles externos.
    if(!document.querySelector(".leaflet-tile-loaded")) $("#mapFallback").hidden = false;
  });
}

function updateMapLayers(){
  if(!state.map || !window.L) return;
  const g = state.game;
  const player = getPlayerCountry();
  state.layers.countries.clearLayers();
  state.layers.bases.clearLayers();
  state.layers.threats.clearLayers();

  state.countries.forEach(c => {
    const isPlayer = c.id === player.id;
    const icon = L.divIcon({
      className: "",
      html: `<div class="${isPlayer ? "marker-own" : "marker-country"}">${isPlayer ? player.flag : c.flag}</div>`,
      iconSize: isPlayer ? [38,38] : [32,32],
      iconAnchor: [16,16]
    });
    L.marker(c.coords, {icon}).addTo(state.layers.countries).bindPopup(`<strong>${c.flag} ${c.name}</strong><br>${c.capital}<br>Militar: ${c.military} · PIB jogo: ${c.gdpGame}`);
  });

  g.bases.forEach((base, idx) => {
    const b = getBuilding(base.type);
    const icon = L.divIcon({className:"",html:`<div class="marker-base">${b.icon}</div>`,iconSize:[30,30],iconAnchor:[15,15]});
    L.marker(base.coords, {icon}).addTo(state.layers.bases).bindPopup(`<strong>${b.name}</strong><br>${base.name}<br>Nível ${base.level}`);
  });

  g.threats.forEach(t => {
    const c = state.countries.find(x => x.id === t.countryId);
    const icon = L.divIcon({className:"",html:`<div class="marker-threat">!</div>`,iconSize:[28,28],iconAnchor:[14,14]});
    L.marker(t.coords, {icon}).addTo(state.layers.threats).bindPopup(`<strong>${c?.flag || ""} ${c?.name || "Ameaça"}</strong><br>${t.type}<br>Nível ${t.level}`);
  });

  state.map.setView(player.coords, Math.max(state.map.getZoom(), 3));
}

function buildBase(buildingId){
  const b = getBuilding(buildingId);
  if(!b || !canAfford(b.cost)) return;
  const g = state.game;
  g.finance -= b.cost.finance;
  g.industry -= b.cost.industry;
  g.energy -= b.cost.energy;
  g.construction.push({ buildingId, remaining: b.buildMonths, id: cryptoId() });
  g.events.push(eventText("sistema", `${b.name} entrou em construção. Previsão: ${b.buildMonths} mês(es).`));
  saveGame();
  renderGame();
}

function buyUnit(unitId){
  const u = state.units.find(x => x.id === unitId);
  if(!u || state.game.finance < u.cost) return;
  if(!state.game.bases.some(b => b.type === u.requires)) return;
  const g = state.game;
  g.finance -= u.cost;
  g.units.push({ id: unitId, qty: 1, veteran: 0 });
  if(u.class === "Terrestre") g.landPower += u.power;
  if(u.class === "Aéreo") g.airPower += u.power;
  if(u.class === "Naval") g.navalPower += u.power;
  if(u.class === "Estratégico") g.missilePower += u.power;
  g.readiness = clamp(g.readiness + 2, 0, 100);
  g.events.push(eventText("sistema", `${u.name} incorporado às forças armadas.`));
  saveGame();
  renderGame();
}

function launchOperation(kind){
  const targetId = $("#targetSelect").value;
  const target = state.countries.find(c => c.id === targetId);
  if(!target) return;
  const g = state.game;
  const costs = {
    recon: {finance: 12, energy: 4, tension: 2, power: g.intel + g.cyber},
    airstrike: {finance: 35, energy: 16, tension: 8, power: g.airPower + g.missilePower / 2},
    naval: {finance: 42, energy: 18, tension: 9, power: g.navalPower + g.logistics / 2},
    combined: {finance: 85, energy: 30, tension: 17, power: g.landPower + g.airPower + g.navalPower + g.missilePower}
  };
  const op = costs[kind];
  if(g.finance < op.finance || g.energy < op.energy){
    g.events.push(eventText("warn", "Recursos insuficientes para iniciar essa operação."));
    renderIntel();
    return;
  }
  g.finance -= op.finance;
  g.energy -= op.energy;
  g.worldTension = clamp(g.worldTension + op.tension, 0, 100);
  g.escalation = clamp(g.escalation + Math.round(op.tension / 2), 0, 100);
  const defense = target.military + target.intel / 2 + (target.nuclear ? 14 : 0) + Math.random() * 30;
  const attack = op.power + g.readiness / 2 + Math.random() * 35;
  const success = attack >= defense;
  const label = {
    recon:"Reconhecimento estratégico",
    airstrike:"Ataque aéreo limitado",
    naval:"Bloqueio naval",
    combined:"Operação combinada"
  }[kind];

  if(success){
    g.readiness = clamp(g.readiness - Math.round(op.tension / 3), 0, 100);
    g.intel = clamp(g.intel + (kind === "recon" ? 3 : 1), 0, 120);
    g.events.push(eventText(kind === "combined" ? "danger" : "sistema", `${label} contra ${target.name} teve sucesso tático. A tensão mundial subiu.`));
  }else{
    g.readiness = clamp(g.readiness - Math.round(op.tension / 2), 0, 100);
    g.stability = clamp(g.stability - 2, 0, 100);
    g.events.push(eventText("danger", `${label} contra ${target.name} falhou. Perdas políticas e alerta inimigo aumentaram.`));
  }
  const rel = g.relations.find(r => r.id === target.id);
  if(rel){
    rel.tension = clamp(rel.tension + op.tension * 2, 0, 100);
    rel.relation = clamp(rel.relation - op.tension * 2, 0, 100);
  }
  maybeCounterAttack(target, Math.round(op.tension * 1.5));
  saveGame();
  renderGame();
}

function maybeCounterAttack(target, pressure){
  const g = state.game;
  const chance = clamp((target.military + pressure + g.worldTension - g.defense) / 150, 0.05, 0.68);
  if(Math.random() > chance) return;
  const enemyPower = target.military + target.airframes / 80 + target.missiles / 30 + Math.random() * 25;
  const defensePower = g.defense + g.readiness / 2 + g.intel / 4 + Math.random() * 30;
  if(enemyPower > defensePower){
    const damage = Math.round(8 + Math.random() * 16);
    g.finance = Math.max(0, g.finance - damage);
    g.industry = Math.max(0, g.industry - Math.round(damage / 2));
    g.readiness = clamp(g.readiness - 4, 0, 100);
    g.events.push(eventText("danger", `${target.name} respondeu com ataque limitado. Perda de finanças e indústria.`));
  }else{
    g.readiness = clamp(g.readiness + 1, 0, 100);
    g.events.push(eventText("warn", `${target.name} tentou uma resposta limitada, mas a defesa interceptou a maior parte da ameaça.`));
  }
}

function advanceMonth(){
  const g = state.game;
  g.month += 1;
  if(g.month % 12 === 0) g.year += 1;

  const c = getPlayerCountry();
  g.finance += Math.round(45 + c.economy * 1.2 + g.stability / 3 - g.units.length * 5);
  g.industry += Math.round(24 + c.industry * .65 - g.units.length * 2);
  g.energy += Math.round(22 + c.oil * .55 - g.bases.length * 2);
  g.food += Math.round(15 + c.food * .4);
  g.readiness = clamp(g.readiness + Math.round(g.logistics / 22) - Math.round(g.worldTension / 35), 0, 100);
  g.worldTension = clamp(g.worldTension + randomInt(-3, 5), 0, 100);

  progressConstruction();
  monthlyWorldEvent();
  decayRelations();
  if(g.worldTension > 58 || Math.random() < .22) aiRaid();
  saveGame();
  renderGame();
}

function progressConstruction(){
  const g = state.game;
  const finished = [];
  g.construction.forEach(job => {
    job.remaining -= 1;
    if(job.remaining <= 0) finished.push(job);
  });
  g.construction = g.construction.filter(job => job.remaining > 0);
  finished.forEach(job => {
    const b = getBuilding(job.buildingId);
    const idx = g.bases.length + 1;
    const coords = jitter(getPlayerCountry().coords, 1.4 + idx * .24);
    g.bases.push({ id: job.id, type: job.buildingId, name: `${b.name} ${idx}`, level: 1, coords });
    applyEffects(b.effects);
    g.events.push(eventText("sistema", `${b.name} concluída e operacional no mapa.`));
  });
}

function applyEffects(effects){
  const g = state.game;
  Object.entries(effects).forEach(([key, value]) => {
    if(key === "soldiers") g.soldiers += value;
    else g[key] = clamp((g[key] || 0) + value, 0, key === "soldiers" ? 999999999 : 9999);
  });
}

function monthlyWorldEvent(){
  const g = state.game;
  const roll = Math.random();
  if(roll < .22){
    g.finance += 35;
    g.events.push(eventText("sistema", "Contrato de defesa nacional reforçou o orçamento militar."));
  }else if(roll < .44){
    g.worldTension = clamp(g.worldTension + 6, 0, 100);
    g.events.push(eventText("warn", "Crise internacional elevou a tensão mundial. Países entraram em estado de alerta."));
  }else if(roll < .63){
    g.intel = clamp(g.intel + 2, 0, 120);
    g.events.push(eventText("sistema", "Relatório de inteligência revelou movimentação militar estrangeira."));
  }else if(roll < .78){
    g.energy = Math.max(0, g.energy - 18);
    g.events.push(eventText("warn", "Oscilação energética reduziu reservas operacionais."));
  }else{
    g.stability = clamp(g.stability + 2, 0, 100);
    g.events.push(eventText("sistema", "Discurso nacional aumentou coesão interna e apoio ao governo."));
  }
}

function decayRelations(){
  const g = state.game;
  g.relations.forEach(r => {
    r.tension = clamp(r.tension + Math.round((g.worldTension - 50) / 22), 0, 100);
    if(r.tension > 70) r.relation = clamp(r.relation - 1, 0, 100);
  });
}

function aiRaid(){
  const g = state.game;
  const threat = g.threats.sort((a,b) => b.level - a.level)[0];
  const enemy = state.countries.find(c => c.id === threat.countryId);
  if(!enemy) return;
  const attack = threat.level + enemy.military / 2 + Math.random() * 25;
  const defense = g.defense + g.readiness / 2 + g.intel / 3 + Math.random() * 35;
  if(attack > defense){
    const loss = randomInt(12, 30);
    g.finance = Math.max(0, g.finance - loss);
    g.readiness = clamp(g.readiness - 5, 0, 100);
    g.events.push(eventText("danger", `Alerta vermelho: ${enemy.name} realizou incursão militar. Houve perdas e queda de prontidão.`));
  }else{
    g.readiness = clamp(g.readiness + 2, 0, 100);
    g.events.push(eventText("warn", `Tentativa de ataque de ${enemy.name} foi contida pela defesa e inteligência.`));
  }
  threat.level = clamp(threat.level + randomInt(-10, 8), 20, 98);
}

function canAfford(cost){
  const g = state.game;
  return g.finance >= cost.finance && g.industry >= cost.industry && g.energy >= cost.energy;
}
function getBuilding(id){ return state.buildings.find(b => b.id === id); }
function getPlayerCountry(){ return state.countries.find(c => c.id === state.game?.countryId) || state.selectedCountry || state.countries[0]; }
function powerIndex(){
  const g = state.game;
  return Math.round((g.landPower + g.airPower + g.navalPower + g.missilePower + g.defense + g.logistics + g.cyber / 2) / 5);
}
function eventText(kind, text){ return {kind, text, at: new Date().toISOString()}; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, Math.round(v))); }
function randomInt(min,max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
function formatSoldiers(n){ return n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : `${Math.round(n/1000)}k`; }
function cryptoId(){ return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function jitter([lat,lng], spread){ return [lat + (Math.random() - .5) * spread, lng + (Math.random() - .5) * spread * 1.4]; }
function getDistance(a,b){
  const R = 6371;
  const dLat = deg2rad(b[0]-a[0]);
  const dLon = deg2rad(b[1]-a[1]);
  const x = Math.sin(dLat/2)**2 + Math.cos(deg2rad(a[0])) * Math.cos(deg2rad(b[0])) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}
function deg2rad(d){ return d * Math.PI / 180; }

function registerServiceWorker(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
  let deferredPrompt;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    $("#installBtn").hidden = false;
  });
  $("#installBtn").addEventListener("click", async () => {
    if(!deferredPrompt) return;
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
