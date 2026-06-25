const VERSION = "1.4.0";
const PHASE = "Fase 14 — rework total da jogabilidade mobile";
const SAVE_KEY = "MWD_SAVE_F14";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  countries: [],
  buildings: [],
  units: [],
  selectedCountry: null,
  game: null,
  map: null,
  layers: { countries: null, regions: null, bases: null, threats: null },
  arsenalFilter: "Todos"
};

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const FLAG_EXTENSIONS = ["png", "webp", "jpg", "jpeg", "svg", "gif"];

function flagCandidates(country) {
  const rawCodes = [country.flagCode, country.iso, country.id, ...(country.flagAliases || [])].filter(Boolean);
  const codes = [];
  rawCodes.forEach(code => {
    const normalized = String(code).toLowerCase().trim();
    if (normalized && !codes.includes(normalized)) codes.push(normalized);
  });
  return codes.flatMap(code => FLAG_EXTENSIONS.map(ext => `assets/flags/${code}.${ext}`));
}

function escapeAttr(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function flagHtml(country, className = "flag-img") {
  const candidates = flagCandidates(country);
  const src = candidates[0] || "";
  const list = escapeAttr(JSON.stringify(candidates));
  const fallback = country.flag || "🏳️";
  return `<span class="flag-wrap ${className}-wrap"><img class="${className}" src="${src}" alt="Bandeira de ${escapeAttr(country.name)}" data-flag-index="0" data-flag-list="${list}" onerror="window.MWD_NEXT_FLAG && window.MWD_NEXT_FLAG(this)"><span class="${className} emoji-fallback" hidden>${fallback}</span></span>`;
}

window.MWD_NEXT_FLAG = function(img) {
  try {
    const list = JSON.parse(img.dataset.flagList || "[]");
    const next = Number(img.dataset.flagIndex || 0) + 1;
    if (next < list.length) {
      img.dataset.flagIndex = String(next);
      img.src = list[next];
      return;
    }
  } catch (err) {}
  img.hidden = true;
  const fallback = img.nextElementSibling;
  if (fallback) fallback.hidden = false;
};


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
    btn.addEventListener("click", () => activatePanel(btn.dataset.panel));
  });

  $$(".op-btn").forEach(btn => btn.addEventListener("click", () => launchOperation(btn.dataset.op)));

  $$(".arsenal-filter").forEach(btn => btn.addEventListener("click", () => {
    state.arsenalFilter = btn.dataset.class;
    $$(".arsenal-filter").forEach(b => b.classList.toggle("is-active", b === btn));
    renderArsenal();
  }));

  $$(".dock-btn[data-panel]").forEach(btn => btn.addEventListener("click", () => activatePanel(btn.dataset.panel)));
  $("#dockNextMonthBtn")?.addEventListener("click", advanceMonth);
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
  const list = state.countries.filter(c => [c.name, c.capital, c.region, c.doctrine, c.bloc, c.iso, c.flagCode, ...(c.flagAliases || [])].join(" ").toLowerCase().includes(term));
  list.forEach(country => {
    const card = document.createElement("article");
    card.className = "nation-card";
    card.innerHTML = `
      <div class="nation-top">${flagHtml(country, "flag-img-lg")}<div><h3>${country.name}</h3><small>${country.capital} · ${country.region}</small></div></div>
      <small>${country.doctrine}</small>
      <div class="stat-pills"><span>Militar ${country.military}</span><span>PIB ${country.gdpGame}</span><span>Defesa ${country.defenseBudget}</span><span>Navios ${country.warships}</span><span>Aeronaves ${country.airframes}</span><span>${country.nuclear ? "Nuclear" : "Convencional"}</span></div>
      <button class="select-country">Comandar ${country.name}</button>`;
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
    logisticsBudget: 100,
    monthlyLosses: 0,
    globalWar: makeGlobalWar(country),
    aiWorld: makeAiWorld(country),
    relations: seedRelations(country),
    events: [eventText("sistema", `Campanha iniciada com ${country.name}. Agora sua prioridade é ocupar slots regionais, produzir forças e sustentar a manutenção militar.`)],
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


function makeGlobalWar(playerCountry) {
  const blocs = summarizeBlocs(playerCountry.id);
  return {
    phase: "tensão armada",
    defcon: playerCountry.nuclear ? 4 : 5,
    nuclearRisk: playerCountry.nuclear ? 12 : 5,
    warScore: 0,
    sanctions: [],
    ultimatums: [],
    invasions: [],
    blocPressure: blocs.map(b => ({ name: b.name, pressure: b.name === playerCountry.bloc ? 24 : clamp(30 + b.military / 8 + Math.random() * 16, 22, 86) })),
    history: [eventText("warn", "O sistema de blocos globais entrou em monitoramento: alianças, sanções, ultimatos e crise nuclear podem escalar a qualquer mês.")]
  };
}

function summarizeBlocs(playerId = null) {
  const map = new Map();
  state.countries.forEach(c => {
    const key = c.bloc || "Não alinhado";
    if (!map.has(key)) map.set(key, { name: key, members: 0, military: 0, economy: 0, nuclear: 0, flags: [] });
    const b = map.get(key);
    b.members += 1;
    b.military += c.military;
    b.economy += c.economy;
    b.nuclear += c.nuclear ? 1 : 0;
    if (b.flags.length < 6) b.flags.push(c.id);
  });
  return [...map.values()].sort((a,b) => b.military - a.military);
}

function ensureGlobalWar() {
  if (!state.game.globalWar) state.game.globalWar = makeGlobalWar(getPlayerCountry());
  if (!Array.isArray(state.game.globalWar.history)) state.game.globalWar.history = [];
  if (!Array.isArray(state.game.globalWar.sanctions)) state.game.globalWar.sanctions = [];
  if (!Array.isArray(state.game.globalWar.ultimatums)) state.game.globalWar.ultimatums = [];
  if (!Array.isArray(state.game.globalWar.invasions)) state.game.globalWar.invasions = [];
}


function makeAiWorld(playerCountry) {
  return state.countries
    .filter(c => c.id !== playerCountry.id)
    .map(c => {
      const distance = getDistance(playerCountry.coords, c.coords);
      const blocModifier = c.bloc === playerCountry.bloc ? -10 : 8;
      const baseHostility = clamp(22 + c.military / 4 + (c.nuclear ? 8 : 0) + blocModifier - Math.round(distance / 5200), 5, 92);
      return {
        id: c.id,
        power: clamp(c.military + c.defenseBudget / 3 + c.cyber / 5 + randomInt(-6, 8), 8, 180),
        economy: clamp(c.economy + c.industry / 3 + randomInt(-8, 8), 8, 180),
        readiness: clamp(34 + c.military / 2 + randomInt(-8, 12), 12, 100),
        posture: baseHostility > 62 ? "hostil" : baseHostility > 42 ? "alerta" : c.bloc === playerCountry.bloc ? "aliado" : "neutro",
        hostility: baseHostility,
        mobilization: clamp(20 + c.defenseBudget / 3 + randomInt(-5, 10), 5, 100),
        lastMove: "monitorando"
      };
    });
}

function ensureAiWorld() {
  if (!state.game.aiWorld || !Array.isArray(state.game.aiWorld) || state.game.aiWorld.length < Math.max(20, state.countries.length - 10)) {
    state.game.aiWorld = makeAiWorld(getPlayerCountry());
  }
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
  ensureGlobalWar();
  ensureAiWorld();
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
  renderCommanderGuide();
  renderRegionSelect();
  renderRegionBoard();
  renderBuildList();
  renderProduction();
  renderUnitList();
  renderArsenal();
  renderMaintenance();
  renderGlobalWar();
  renderAiWorld();
  renderTargetSelect();
  renderIntel();
  initMap();
  updateMapLayers();
}

function renderSummary() {
  const g = state.game;
  const c = getPlayerCountry();
  const cond = forceCondition();
  const flag = flagHtml(c, "player-flag-img");
  const titleFlag = flagHtml(c, "title-flag-img");
  $("#monthLabel").textContent = `${monthNames[g.month % 12]}/${g.year}`;
  $("#commandTitle").innerHTML = `${titleFlag}<span>${c.name} — Comando Nacional</span>`;
  $("#countrySummary").innerHTML = `
    <div class="player-identity upgraded">
      ${flag}
      <div><h2>${c.name}</h2><small>${c.capital} · ${c.region}</small><span class="country-doctrine">${c.doctrine}</span></div>
    </div>
    <div class="player-focus"><span>Próximo toque recomendado</span><strong>${commanderRecommendation().title}</strong></div>
    <div class="metrics compact-metrics">
      <div class="metric"><small>Finanças</small><strong>${g.finance}</strong></div>
      <div class="metric"><small>Indústria</small><strong>${g.industry}</strong></div>
      <div class="metric"><small>Energia</small><strong>${g.energy}</strong></div>
      <div class="metric"><small>Poder</small><strong>${powerIndex()}</strong></div>
      <div class="metric"><small>Força</small><strong>${cond}%</strong></div>
      <div class="metric"><small>DEFCON</small><strong>${g.globalWar?.defcon ?? 5}</strong></div>
    </div>`;
}

function getSelectedRegion() {
  return state.game.regions.find(r => r.id === state.game.selectedRegionId) || state.game.regions[0];
}


function activatePanel(panelId) {
  $$(".side-tab").forEach(b => b.classList.toggle("is-active", b.dataset.panel === panelId));
  $$(".side-panel").forEach(p => p.classList.toggle("is-active", p.id === panelId));
  $$(".dock-btn[data-panel]").forEach(b => b.classList.toggle("is-active", b.dataset.panel === panelId));
  const panel = $("#" + panelId);
  if (panel) panel.scrollTop = 0;
}

function commanderRecommendation() {
  const g = state.game;
  if (!g) return { title: "Iniciar campanha", text: "Escolha um país para começar.", action: "new", panel: "screenNation" };
  const r = getSelectedRegion();
  const damaged = g.bases.find(b => b.condition < 60);
  const emptyRegion = state.game.regions.find(reg => regionBases(reg.id).length + g.construction.filter(j => j.regionId === reg.id).length < reg.slots);
  const hasBase = g.bases.length > 0;
  const hasProd = g.production.length > 0;
  const canProduce = state.units.some(u => hasOperationalBase(u.requires, r.id) && hasBaseAtLevel(u.requires, r.id, u.requiresLevel || 1) && g.finance >= u.cost);
  if (damaged) return { title: "Reparar base danificada", text: `${getBuilding(damaged.type).name} está com ${damaged.condition}%. Toque em Reparar prioridade para recuperar defesa.`, action: "repair", panel: "panelBuild" };
  if (!hasBase) return { title: "Construir primeira base", text: "Comece por Base terrestre na capital. Ela libera produção de infantaria e blindados.", action: "build", panel: "panelBuild" };
  if (!canProduce && regionBases(r.id).length) return { title: "Evoluir ou construir estrutura", text: "Suba o nível de uma base ou construa a estrutura exigida pelo arsenal.", action: "build", panel: "panelBuild" };
  if (canProduce && !hasProd) return { title: "Produzir unidade", text: "Há unidade disponível na região ativa. Toque em Produzir recomendado.", action: "produce", panel: "panelForces" };
  if (hasProd) return { title: "Avançar mês", text: "Existe produção/obra em andamento. Avance o mês para concluir e receber novas forças.", action: "month", panel: "panelGuide" };
  if ((g.globalWar?.nuclearRisk || 0) > 55) return { title: "Reduzir crise mundial", text: "O risco nuclear está alto. Abra Mundo e tente desescalar.", action: "world", panel: "panelGlobal" };
  const hostile = topAiThreats(1)[0];
  if (hostile && hostile.hostility > 75) return { title: "Monitorar rival perigoso", text: `${getCountry(hostile.id)?.name || "Rival"} está em postura ${hostile.posture}. Abra IA antes de atacar.`, action: "ai", panel: "panelAiWorld" };
  if (emptyRegion) return { title: "Expandir para outra região", text: `${emptyRegion.kind} ainda tem slots livres. Expanda sua rede de bases.`, action: "build", panel: "panelBuild" };
  return { title: "Preparar ataque", text: "Seu país já tem base e produção. Escolha um alvo, reconheça e ataque com cautela.", action: "ops", panel: "panelOps" };
}

function renderCommanderGuide() {
  const box = $("#commanderGuide");
  if (!box || !state.game) return;
  const g = state.game;
  const c = getPlayerCountry();
  const r = getSelectedRegion();
  const rec = commanderRecommendation();
  const bases = regionBases(r.id).length;
  const queue = g.construction.length + g.production.length;
  const cond = forceCondition();
  const flag = flagHtml(c, "hq-flag-img");
  const mainActionLabel = rec.action === "repair" ? "Reparar agora" : rec.action === "produce" ? "Produzir agora" : rec.action === "month" ? "Avançar mês" : rec.action === "world" ? "Abrir Mundo" : rec.action === "ai" ? "Abrir IA" : rec.action === "ops" ? "Atacar" : "Construir agora";
  box.innerHTML = `
    <article class="mobile-hq-card">
      <div class="hq-flag-block">${flag}</div>
      <div class="hq-main">
        <small>Você comanda</small>
        <strong>${c.name}</strong>
        <span>${c.capital} · ${c.region}</span>
        <em>${c.doctrine}</em>
      </div>
    </article>

    <article class="guide-hero mobile-objective">
      <div><small>Próxima decisão recomendada</small><strong>${rec.title}</strong><span>${rec.text}</span></div>
      <button id="primaryRecommendedBtn">${mainActionLabel}</button>
    </article>

    <div class="mission-flow">
      <article class="${g.bases.length ? 'done' : 'active'}"><b>1</b><span>Base</span><small>${g.bases.length ? "feito" : "toque em construir"}</small></article>
      <article class="${g.units.length ? 'done' : (g.bases.length ? 'active' : 'locked')}"><b>2</b><span>Unidade</span><small>${g.units.length ? "operacional" : "produzir"}</small></article>
      <article class="${powerIndex() > 70 ? 'done' : (g.units.length ? 'active' : 'locked')}"><b>3</b><span>Poder</span><small>${powerIndex()}</small></article>
      <article class="${(g.globalWar?.warScore || 0) > 25 ? 'done' : 'active'}"><b>4</b><span>Guerra</span><small>DEFCON ${g.globalWar?.defcon ?? 5}</small></article>
    </div>

    <div class="quick-kpis">
      <div><small>Região ativa</small><strong>${r.kind}</strong></div>
      <div><small>Bases aqui</small><strong>${bases}/${r.slots}</strong></div>
      <div><small>Fila</small><strong>${queue}</strong></div>
      <div><small>Força</small><strong>${cond}%</strong></div>
      <div><small>Tensão</small><strong>${g.worldTension}</strong></div>
      <div><small>Países</small><strong>${state.countries.length}</strong></div>
    </div>

    <div class="mobile-command-grid">
      <button id="quickBuildBtn"><b>🏗️ Construir</b><span>base recomendada</span></button>
      <button id="quickProduceBtn"><b>🪖 Produzir</b><span>melhor unidade</span></button>
      <button id="quickRepairBtn"><b>🛠️ Reparar</b><span>base crítica</span></button>
      <button id="quickOpsBtn"><b>⚔️ Atacar</b><span>abrir operações</span></button>
      <button id="quickWorldBtn"><b>🌐 Mundo</b><span>DEFCON e crise</span></button>
      <button id="quickAiBtn"><b>🛰️ IA</b><span>rivais ativos</span></button>
    </div>`;
  $("#primaryRecommendedBtn")?.addEventListener("click", () => runRecommendedAction(rec));
  $("#quickBuildBtn")?.addEventListener("click", quickBuildRecommended);
  $("#quickProduceBtn")?.addEventListener("click", quickProduceRecommended);
  $("#quickRepairBtn")?.addEventListener("click", quickRepairPriority);
  $("#quickOpsBtn")?.addEventListener("click", () => activatePanel("panelOps"));
  $("#quickWorldBtn")?.addEventListener("click", () => activatePanel("panelGlobal"));
  $("#quickAiBtn")?.addEventListener("click", () => activatePanel("panelAiWorld"));
}

function runRecommendedAction(rec) {
  if (!rec) rec = commanderRecommendation();
  if (rec.action === "repair") return quickRepairPriority();
  if (rec.action === "produce") return quickProduceRecommended();
  if (rec.action === "month") return advanceMonth();
  if (rec.action === "world") return activatePanel("panelGlobal");
  if (rec.action === "ai") return activatePanel("panelAiWorld");
  if (rec.action === "ops") return activatePanel("panelOps");
  return quickBuildRecommended();
}

function quickBuildRecommended() {
  const r = getSelectedRegion();
  const used = regionBases(r.id).length + state.game.construction.filter(j => j.regionId === r.id).length;
  if (used >= r.slots) { state.game.events.push(eventText("warn", "Região sem slots livres. Escolha outra região.")); renderGame(); return; }
  const order = ["army_base", "logistics_hub", "air_base", "radar_station", "naval_port", "missile_site", "cyber_command"];
  const pick = order.map(id => getBuilding(id)).find(b => b && canAfford(b.cost)) || state.buildings.find(b => canAfford(b.cost));
  if (!pick) { state.game.events.push(eventText("warn", "Recursos insuficientes para construção recomendada.")); renderGame(); return; }
  buildBase(pick.id);
  activatePanel("panelBuild");
}

function quickProduceRecommended() {
  const r = getSelectedRegion();
  const candidates = state.units.filter(u => hasOperationalBase(u.requires, r.id) && hasBaseAtLevel(u.requires, r.id, u.requiresLevel || 1) && state.game.finance >= u.cost);
  if (!candidates.length) { state.game.events.push(eventText("warn", "Nenhuma unidade disponível nesta região. Construa ou evolua bases.")); renderGame(); return; }
  const pick = candidates.sort((a,b) => (b.power + (b.attack || 0) + (b.defense || 0)) - (a.power + (a.attack || 0) + (a.defense || 0)))[0];
  queueUnit(pick.id);
  activatePanel("panelForces");
}

function quickRepairPriority() {
  const damaged = state.game.bases.filter(b => b.condition < 100).sort((a,b) => a.condition - b.condition)[0];
  if (!damaged) { state.game.events.push(eventText("sistema", "Nenhuma base precisa de reparo agora.")); renderGame(); return; }
  repairBase(damaged.id);
  activatePanel("panelBuild");
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
    card.innerHTML = `<img src="${u.image}" alt="${u.name}"><div><strong>${u.name}</strong><small>${r.name} · pronto em ${job.remaining} mês(es) · reposição ${job.replacement ? "sim" : "não"}</small></div>`;
    q.appendChild(card);
  });
}

function renderUnitList() {
  const list = $("#unitList");
  const r = getSelectedRegion();
  list.innerHTML = "";
  const ordered = [...state.units].sort((a,b) => (a.tier - b.tier) || a.class.localeCompare(b.class));
  ordered.forEach(u => {
    const level = u.minBaseLevel || 1;
    const hasBase = hasOperationalBase(u.requires, r.id, level);
    const canBuy = hasBase && state.game.finance >= u.cost;
    const card = document.createElement("article");
    card.className = "unit-card";
    card.innerHTML = `${u.image ? `<img class="card-thumb" src="${u.image}" alt="${u.name}">` : ""}<div><h3>${u.icon} ${u.name}</h3><p>${u.role}</p><div class="cost-line">${u.class} · Tier ${u.tier || 1} · Ataque ${u.attack ?? u.power} · Defesa ${u.defense ?? 0} · Alcance ${u.rangeKm || "—"} km</div><div class="cost-line">$${u.cost} · Manut. ${u.upkeep} · ${u.buildMonths}m · requer ${getBuilding(u.requires)?.name || u.requires} nível ${level} na região ativa</div></div><button ${canBuy ? "" : "disabled"}>Produzir</button>`;
    card.querySelector("button").addEventListener("click", () => queueUnit(u.id));
    list.appendChild(card);
  });
}

function renderArsenal() {
  const list = $("#arsenalList");
  if (!list) return;
  const filter = state.arsenalFilter || "Todos";
  list.innerHTML = "";
  const units = state.units
    .filter(u => filter === "Todos" || u.class === filter)
    .sort((a,b) => (a.class.localeCompare(b.class)) || (a.tier - b.tier) || a.cost - b.cost);
  units.forEach(u => {
    const owned = ownedUnitQty(u.id);
    const b = getBuilding(u.requires);
    const caps = (u.capabilities || []).map(c => `<span>${c}</span>`).join("");
    const card = document.createElement("article");
    card.className = `arsenal-card class-${slug(u.class)}`;
    card.innerHTML = `
      <img src="${u.image}" alt="${u.name}">
      <div class="arsenal-body">
        <div class="arsenal-title"><h3>${u.icon} ${u.name}</h3><strong>${u.class} · Tier ${u.tier || 1}</strong></div>
        <p>${u.role}</p>
        <div class="arsenal-stats">
          <span>Ataque <b>${u.attack ?? u.power}</b></span>
          <span>Defesa <b>${u.defense ?? 0}</b></span>
          <span>Poder <b>${u.power}</b></span>
          <span>Alcance <b>${u.rangeKm || "—"} km</b></span>
          <span>Produção <b>${u.buildMonths}m</b></span>
          <span>Manutenção <b>${u.upkeep}</b></span>
        </div>
        <div class="arsenal-meta"><span>Requer: ${b?.name || u.requires} nível ${u.minBaseLevel || 1}</span><span>Possui: ${owned}</span><span>Tripulação/lote: ${u.crew || "—"}</span></div>
        <div class="capability-line">${caps}</div>
      </div>`;
    list.appendChild(card);
  });
}


function renderMaintenance() {
  const summary = $("#maintenanceSummary");
  const list = $("#maintenanceList");
  if (!summary || !list || !state.game) return;
  const g = state.game;
  const upkeep = monthlyUpkeep();
  const condition = forceCondition();
  const readyClass = condition >= 72 ? "readiness-high" : condition >= 45 ? "readiness-mid" : "readiness-low";
  summary.innerHTML = `
    <div class="maintenance-kpi"><small>Custo mensal</small><strong>$${upkeep.finance}</strong></div>
    <div class="maintenance-kpi"><small>Energia/combustível</small><strong>${upkeep.energy}</strong></div>
    <div class="maintenance-kpi"><small>Peças/indústria</small><strong>${upkeep.industry}</strong></div>
    <div class="maintenance-kpi"><small>Condição média</small><strong class="${readyClass}">${condition}%</strong></div>`;
  list.innerHTML = "";
  if (!g.units.length) {
    list.innerHTML = '<div class="event queue-empty">Nenhuma unidade operacional ainda. Produza unidades para iniciar manutenção real.</div>';
    return;
  }
  g.units.forEach((stack, index) => {
    const u = getUnit(stack.id);
    const r = getRegion(stack.regionId);
    stack.condition = stack.condition ?? 100;
    const repair = stackRepairCost(stack);
    const replace = replacementCost(stack);
    const canRepair = stack.condition < 100 && g.finance >= repair.finance && g.industry >= repair.industry && g.energy >= repair.energy;
    const canReplace = hasOperationalBase(u.requires, stack.regionId, u.minBaseLevel || 1) && g.finance >= replace.finance && g.industry >= replace.industry && g.energy >= replace.energy;
    const condClass = stack.condition >= 70 ? 'readiness-high' : stack.condition >= 40 ? 'readiness-mid' : 'readiness-low';
    const card = document.createElement('article');
    card.className = 'maintenance-card';
    card.innerHTML = `
      <img src="${u.image}" alt="${u.name}">
      <div>
        <div class="maintenance-title"><h3>${u.icon} ${u.name}</h3><span>${r.name}</span></div>
        <div class="condition-bar"><i style="width:${stack.condition}%"></i></div>
        <div class="maintenance-meta">
          <span>Qtd ${stack.qty}</span><span>Condição <b class="${condClass}">${stack.condition}%</b></span><span>Manut. ${u.upkeep * stack.qty}/mês</span><span>Reparo $${repair.finance}/Ind.${repair.industry}/En.${repair.energy}</span>
        </div>
        <div class="maintenance-actions"><button class="repair-stack" ${canRepair ? '' : 'disabled'}>Manutenção</button><button class="replace-btn" ${canReplace ? '' : 'disabled'}>Repor lote</button></div>
      </div>`;
    card.querySelector('.repair-stack').addEventListener('click', () => maintainStack(index));
    card.querySelector('.replace-btn').addEventListener('click', () => replaceStack(index));
    list.appendChild(card);
  });
}


function renderGlobalWar() {
  const panel = $("#globalWarPanel");
  if (!panel || !state.game) return;
  ensureGlobalWar();
  const g = state.game;
  const gw = g.globalWar;
  const player = getPlayerCountry();
  const blocs = summarizeBlocs(player.id);
  const targetId = $("#targetSelect")?.value || state.countries.find(c => c.id !== player.id)?.id;
  const target = state.countries.find(c => c.id === targetId) || state.countries.find(c => c.id !== player.id);
  const sanctions = gw.sanctions.slice(-4).map(s => `<div class="global-line"><strong>${s.sourceFlag || player.flag} Sanção</strong><span>${s.targetName} · ${s.remaining}m · pressão ${s.pressure}</span></div>`).join("") || '<div class="global-empty">Nenhuma sanção ativa.</div>';
  const ultimatums = gw.ultimatums.slice(-4).map(u => `<div class="global-line danger"><strong>Ultimato</strong><span>${u.targetName} · vence em ${u.remaining}m · risco ${u.risk}</span></div>`).join("") || '<div class="global-empty">Nenhum ultimato ativo.</div>';
  const invasions = gw.invasions.slice(-4).map(i => `<div class="global-line war"><strong>Frente aberta</strong><span>${i.attackerName} → ${i.targetName} · ${i.progress}% · ${i.remaining}m</span></div>`).join("") || '<div class="global-empty">Nenhuma invasão ativa.</div>';
  const blocHtml = blocs.map(b => `<article class="bloc-card ${b.name === player.bloc ? 'is-player' : ''}"><strong>${b.flags.map(id => flagHtml(state.countries.find(c => c.id === id) || player, 'bloc-flag-img')).join('')} ${b.name}</strong><span>${b.members} países · poder ${Math.round(b.military)} · economia ${Math.round(b.economy)} · nuclear ${b.nuclear}</span></article>`).join("");
  panel.innerHTML = `
    <div class="global-kpis">
      <div><small>Fase mundial</small><strong>${gw.phase}</strong></div>
      <div><small>DEFCON</small><strong>${gw.defcon}</strong></div>
      <div><small>Risco nuclear</small><strong>${gw.nuclearRisk}%</strong></div>
      <div><small>Guerra global</small><strong>${gw.warScore}%</strong></div>
    </div>
    <div class="global-meter"><i style="width:${clamp(gw.nuclearRisk,0,100)}%"></i></div>
    <h3>Objetivos de campanha</h3><div class="goal-grid">${renderCampaignGoals()}</div>
    <label class="field-label">Alvo diplomático/militar</label>
    <select id="globalTargetSelect">${state.countries.filter(c => c.id !== player.id).map(c => `<option value="${c.id}" ${target && c.id === target.id ? 'selected' : ''}>${c.flag} ${c.name} · ${c.bloc}</option>`).join("")}</select>
    <div class="global-actions">
      <button data-global-action="sanction">Aplicar sanção</button>
      <button data-global-action="ultimatum">Emitir ultimato</button>
      <button data-global-action="invasion" class="danger">Iniciar invasão</button>
      <button data-global-action="deescalate">Desescalar crise</button>
    </div>
    <h3>Blocos militares</h3><div class="bloc-grid">${blocHtml}</div>
    <h3>Sanções ativas</h3>${sanctions}
    <h3>Ultimatos</h3>${ultimatums}
    <h3>Frentes de invasão</h3>${invasions}
  `;
  panel.querySelectorAll("[data-global-action]").forEach(btn => btn.addEventListener("click", () => globalWarAction(btn.dataset.globalAction)));
}


function renderCampaignGoals() {
  const g = state.game;
  ensureGlobalWar();
  const gw = g.globalWar;
  const goals = [
    { name: "Dominação militar", value: clamp(powerIndex() + g.bases.length * 4 + gw.warScore / 3, 0, 100), desc: "poder + bases + guerra global" },
    { name: "Dissuasão estratégica", value: clamp(g.defense / 1.2 + g.missilePower / 1.8 + (getPlayerCountry().nuclear ? 18 : 0), 0, 100), desc: "defesa, mísseis e risco controlado" },
    { name: "Supremacia industrial", value: clamp((g.industry + g.finance / 3 + g.logistics) / 7, 0, 100), desc: "indústria, orçamento e logística" },
    { name: "Estabilidade nacional", value: clamp(g.stability + forceCondition() / 5 - gw.nuclearRisk / 5, 0, 100), desc: "apoio interno e forças íntegras" }
  ];
  return goals.map(goal => `<article class="goal-card"><strong>${goal.name}</strong><span>${goal.value}%</span><div class="goal-bar"><i style="width:${goal.value}%"></i></div><small>${goal.desc}</small></article>`).join("");
}


function renderAiWorld() {
  const panel = $("#aiWorldPanel");
  if (!panel || !state.game) return;
  ensureAiWorld();
  const list = topAiThreats(12);
  const active = state.game.aiWorld.filter(a => a.posture === "hostil" || a.posture === "alerta").length;
  const avgPower = Math.round(state.game.aiWorld.reduce((s,a)=>s+a.power,0) / Math.max(1,state.game.aiWorld.length));
  const cards = list.map(ai => {
    const c = getCountry(ai.id);
    const rel = state.game.relations.find(r => r.id === ai.id);
    const postureClass = ai.posture === "hostil" ? "danger" : ai.posture === "alerta" ? "warn" : ai.posture === "aliado" ? "good" : "";
    return `<article class="ai-country-card ${postureClass}">
      ${flagHtml(c, "ai-flag-img")}
      <div><strong>${c?.name || ai.id}</strong><small>${c?.bloc || "Não alinhado"} · ${ai.lastMove}</small>
      <div class="ai-bars"><span><i style="width:${clamp(ai.power,0,100)}%"></i></span><b>Poder ${ai.power}</b><span><i style="width:${clamp(ai.readiness,0,100)}%"></i></span><b>Pront. ${ai.readiness}</b></div></div>
      <div class="ai-posture"><em>${ai.posture}</em><small>Host. ${ai.hostility}</small><small>Relação ${rel?.relation ?? 50}</small></div>
    </article>`;
  }).join("");
  panel.innerHTML = `<div class="ai-world-kpis">
    <div><small>Países IA</small><strong>${state.game.aiWorld.length}</strong></div>
    <div><small>Em alerta/hostis</small><strong>${active}</strong></div>
    <div><small>Poder médio</small><strong>${avgPower}</strong></div>
    <div><small>Tensão</small><strong>${state.game.worldTension}</strong></div>
  </div><h3>Principais ameaças e potências ativas</h3><div class="ai-country-list">${cards}</div>`;
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
    const icon = L.divIcon({ className: "", html: `<div class="${isPlayer ? "marker-own" : "marker-country"}">${flagHtml(c, "marker-flag-img")}</div>`, iconSize: isPlayer ? [38, 38] : [32, 32], iconAnchor: [16, 16] });
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
  if (!u || !hasOperationalBase(u.requires, r.id, u.minBaseLevel || 1) || g.finance < u.cost) return;
  g.finance -= u.cost;
  g.production.push({ id: cryptoId(), unitId, regionId: r.id, remaining: u.buildMonths });
  g.events.push(eventText("sistema", `${u.name} entrou na fila de produção em ${r.name}.`));
  saveGame();
  renderGame();
}


function globalWarAction(kind) {
  ensureGlobalWar();
  const g = state.game;
  const gw = g.globalWar;
  const targetId = $("#globalTargetSelect")?.value || $("#targetSelect")?.value;
  const target = state.countries.find(c => c.id === targetId);
  if (!target) return;
  if (kind === "sanction") {
    if (g.finance < 24) { g.events.push(eventText("warn", "Orçamento insuficiente para sustentar nova rodada de sanções.")); renderGame(); return; }
    g.finance -= 24;
    gw.sanctions.push({ id: cryptoId(), targetId: target.id, targetName: target.name, sourceFlag: getPlayerCountry().flag, remaining: 6, pressure: clamp(18 + g.intel / 6 + Math.random() * 18, 12, 55) });
    g.worldTension = clamp(g.worldTension + 3, 0, 100);
    gw.warScore = clamp(gw.warScore + 2, 0, 100);
    g.events.push(eventText("warn", `Sanções contra ${target.name} aumentaram pressão econômica e tensão diplomática.`));
  }
  if (kind === "ultimatum") {
    if (g.readiness < 45) { g.events.push(eventText("warn", "Prontidão insuficiente para sustentar um ultimato crível.")); renderGame(); return; }
    gw.ultimatums.push({ id: cryptoId(), targetId: target.id, targetName: target.name, remaining: 2, risk: clamp(30 + target.military / 3 + g.worldTension / 2, 20, 95) });
    g.worldTension = clamp(g.worldTension + 7, 0, 100);
    gw.warScore = clamp(gw.warScore + 6, 0, 100);
    gw.nuclearRisk = clamp(gw.nuclearRisk + (target.nuclear ? 8 : 3), 0, 100);
    g.events.push(eventText("danger", `Ultimato emitido contra ${target.name}. O risco de guerra aberta aumentou.`));
  }
  if (kind === "invasion") {
    const invasionCost = 120;
    if (g.finance < invasionCost || g.readiness < 55 || powerIndex() < 35) { g.events.push(eventText("warn", "Você precisa de mais orçamento, prontidão e poder militar para iniciar uma invasão.")); renderGame(); return; }
    g.finance -= invasionCost;
    g.readiness = clamp(g.readiness - 12, 0, 100);
    gw.invasions.push({ id: cryptoId(), attackerId: g.countryId, attackerName: getPlayerCountry().name, targetId: target.id, targetName: target.name, progress: 8, remaining: 8, intensity: clamp(30 + powerIndex()/2, 20, 95) });
    g.worldTension = clamp(g.worldTension + 16, 0, 100);
    gw.warScore = clamp(gw.warScore + 18, 0, 100);
    gw.nuclearRisk = clamp(gw.nuclearRisk + (target.nuclear ? 16 : 6), 0, 100);
    g.events.push(eventText("danger", `Invasão iniciada contra ${target.name}. A guerra global entrou em nova fase.`));
  }
  if (kind === "deescalate") {
    const cost = 42;
    if (g.finance < cost) { g.events.push(eventText("warn", "Recursos diplomáticos insuficientes para desescalar a crise.")); renderGame(); return; }
    g.finance -= cost;
    g.worldTension = clamp(g.worldTension - 8, 0, 100);
    gw.nuclearRisk = clamp(gw.nuclearRisk - 7, 0, 100);
    gw.warScore = clamp(gw.warScore - 5, 0, 100);
    g.stability = clamp(g.stability + 2, 0, 100);
    g.events.push(eventText("sistema", "Canais diplomáticos reduziram a escalada mundial temporariamente."));
  }
  updateGlobalPhase();
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
  applyOperationalWear(kind, success);
  if (state.game.globalWar) { state.game.globalWar.warScore = clamp(state.game.globalWar.warScore + Math.round(op.tension / 2), 0, 100); state.game.globalWar.nuclearRisk = clamp(state.game.globalWar.nuclearRisk + (target.nuclear ? 2 : 1), 0, 100); updateGlobalPhase(); }
  maybeCounterAttack(target, Math.round(op.tension * 1.5));
  saveGame();
  renderGame();
}

function advanceMonth() {
  const g = state.game;
  const c = getPlayerCountry();
  g.month += 1;
  if (g.month % 12 === 0) g.year += 1;
  const upkeep = monthlyUpkeep();
  g.finance = Math.max(0, g.finance + Math.round(45 + c.economy * 1.2 + g.stability / 3) - upkeep.finance);
  g.industry = Math.max(0, g.industry + Math.round(24 + c.industry * .65 - g.bases.length) - upkeep.industry);
  g.energy = Math.max(0, g.energy + Math.round(22 + c.oil * .55 - g.bases.length * 2) - upkeep.energy);
  g.food += Math.round(15 + c.food * .4);
  applyMonthlyWear(upkeep);
  g.readiness = clamp(g.readiness + Math.round(g.logistics / 24) - Math.round(g.worldTension / 36) - (forceCondition() < 45 ? 3 : 0), 0, 100);
  g.worldTension = clamp(g.worldTension + randomInt(-3, 5), 0, 100);
  progressConstruction();
  progressProduction();
  monthlyWorldEvent();
  progressAiWorld();
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
    if (existing) {
      existing.qty += 1;
      existing.condition = clamp((existing.condition ?? 100) + 4, 0, 100);
    } else {
      g.units.push({ id: u.id, regionId: job.regionId, qty: 1, veteran: 0, condition: 100 });
    }
    addUnitPower(u);
    g.events.push(eventText("sistema", `${u.name} ${job.replacement ? "foi reposto" : "ficou operacional"} em ${getRegion(job.regionId).name}.`));
  });
}


function progressGlobalWar() {
  ensureGlobalWar();
  const g = state.game;
  const gw = g.globalWar;
  gw.sanctions.forEach(s => {
    s.remaining -= 1;
    const rel = g.relations.find(r => r.id === s.targetId);
    if (rel) { rel.relation = clamp(rel.relation - 2, 0, 100); rel.tension = clamp(rel.tension + 3, 0, 100); }
    g.finance += Math.round(s.pressure / 7);
  });
  gw.sanctions = gw.sanctions.filter(s => s.remaining > 0);
  gw.ultimatums.forEach(u => {
    u.remaining -= 1;
    if (u.remaining <= 0) {
      const target = state.countries.find(c => c.id === u.targetId);
      if (target && Math.random() * 100 < u.risk) {
        gw.invasions.push({ id: cryptoId(), attackerId: target.id, attackerName: target.name, targetId: g.countryId, targetName: getPlayerCountry().name, progress: 5, remaining: 6, intensity: clamp(target.military / 2, 20, 90) });
        g.worldTension = clamp(g.worldTension + 10, 0, 100);
        gw.warScore = clamp(gw.warScore + 12, 0, 100);
        gw.nuclearRisk = clamp(gw.nuclearRisk + (target.nuclear ? 12 : 5), 0, 100);
        g.events.push(eventText("danger", `${target.name} rejeitou o ultimato e abriu uma frente militar contra você.`));
      } else if (target) {
        g.finance += 30;
        g.events.push(eventText("sistema", `${target.name} recuou após ultimato e aceitou concessões estratégicas.`));
      }
    }
  });
  gw.ultimatums = gw.ultimatums.filter(u => u.remaining > 0);
  gw.invasions.forEach(front => {
    front.remaining -= 1;
    const attacker = state.countries.find(c => c.id === front.attackerId);
    const againstPlayer = front.targetId === g.countryId;
    const force = againstPlayer ? (attacker?.military || 45) + front.intensity : powerIndex() + regionalForceBonus();
    const resistance = againstPlayer ? g.defense + regionalForceBonus() + forceCondition()/2 : (state.countries.find(c => c.id === front.targetId)?.military || 50) + Math.random() * 30;
    front.progress = clamp(front.progress + Math.round((force - resistance) / 10) + randomInt(3, 11), 0, 100);
    g.worldTension = clamp(g.worldTension + 2, 0, 100);
    gw.warScore = clamp(gw.warScore + 2, 0, 100);
    if (againstPlayer && Math.random() < .42) aiRaid();
    if (front.progress >= 100) {
      if (againstPlayer) {
        g.stability = clamp(g.stability - 12, 0, 100);
        g.finance = Math.max(0, g.finance - 90);
        g.events.push(eventText("danger", `Frente inimiga rompeu defesas nacionais. Estabilidade e orçamento sofreram forte queda.`));
      } else {
        g.finance += 90;
        g.stability = clamp(g.stability + 5, 0, 100);
        g.events.push(eventText("sistema", `Operação contra ${front.targetName} alcançou vitória estratégica.`));
      }
      front.remaining = 0;
    }
  });
  gw.invasions = gw.invasions.filter(f => f.remaining > 0 && f.progress < 100);
  if (g.worldTension > 70) gw.nuclearRisk = clamp(gw.nuclearRisk + (g.worldTension > 88 ? 4 : 2), 0, 100);
  if (gw.nuclearRisk > 75 && Math.random() < .18) nuclearIncident();
  updateGlobalPhase();
}

function nuclearIncident() {
  const g = state.game;
  const gw = g.globalWar;
  const contained = Math.random() < (g.intel + g.cyber + g.stability) / 280;
  if (contained) {
    gw.nuclearRisk = clamp(gw.nuclearRisk - 16, 0, 100);
    g.events.push(eventText("warn", "Incidente nuclear foi contido por canais de emergência e comunicação militar."));
  } else {
    gw.defcon = Math.max(1, gw.defcon - 1);
    gw.warScore = clamp(gw.warScore + 15, 0, 100);
    g.worldTension = clamp(g.worldTension + 12, 0, 100);
    g.stability = clamp(g.stability - 8, 0, 100);
    g.events.push(eventText("danger", "Incidente nuclear elevou DEFCON e abalou a estabilidade global."));
  }
}

function updateGlobalPhase() {
  ensureGlobalWar();
  const gw = state.game.globalWar;
  const t = state.game.worldTension;
  if (gw.nuclearRisk >= 85 || t >= 92 || gw.defcon <= 2) gw.phase = "crise nuclear";
  else if (gw.warScore >= 70 || gw.invasions.length >= 3) gw.phase = "guerra mundial aberta";
  else if (gw.invasions.length || gw.ultimatums.length) gw.phase = "guerra regionalizada";
  else if (gw.sanctions.length || t > 55) gw.phase = "guerra fria ativa";
  else gw.phase = "tensão armada";
  gw.defcon = gw.phase === "crise nuclear" ? Math.min(gw.defcon, 2) : gw.phase === "guerra mundial aberta" ? Math.min(gw.defcon, 3) : gw.phase === "guerra regionalizada" ? Math.min(gw.defcon, 4) : Math.max(gw.defcon, 4);
}



function progressAiWorld() {
  ensureAiWorld();
  const g = state.game;
  const player = getPlayerCountry();
  const events = [];
  g.aiWorld.forEach(ai => {
    const c = getCountry(ai.id);
    if (!c) return;
    const blocSame = c.bloc === player.bloc;
    const tensionPush = g.worldTension > 65 ? 2 : g.worldTension > 48 ? 1 : 0;
    const economyGain = Math.max(1, Math.round((ai.economy / 85) + Math.random() * 2));
    const powerGain = Math.max(0, Math.round((ai.mobilization / 55) + Math.random() * 2 + tensionPush));
    ai.economy = clamp(ai.economy + economyGain - (ai.posture === "hostil" ? 1 : 0), 1, 220);
    ai.power = clamp(ai.power + powerGain + (ai.posture === "hostil" ? 1 : 0), 1, 230);
    ai.readiness = clamp(ai.readiness + randomInt(-2, 4) + tensionPush, 1, 100);
    ai.hostility = clamp(ai.hostility + (blocSame ? -1 : tensionPush) + randomInt(-2, 3), 0, 100);
    if (ai.hostility > 74) ai.posture = "hostil";
    else if (ai.hostility > 50 || ai.readiness > 76) ai.posture = "alerta";
    else if (blocSame && ai.hostility < 48) ai.posture = "aliado";
    else ai.posture = "neutro";
    const roll = Math.random();
    if (roll < .08 + g.worldTension / 900) {
      ai.lastMove = "mobilizou forças";
      ai.power = clamp(ai.power + randomInt(2, 7), 1, 230);
      ai.readiness = clamp(ai.readiness + randomInt(3, 8), 1, 100);
      if (ai.posture === "hostil" || ai.posture === "alerta") events.push(`${c.name} mobilizou forças e elevou prontidão.`);
    } else if (roll < .13 + g.worldTension / 1000) {
      ai.lastMove = "pressionou bloco rival";
      ai.hostility = clamp(ai.hostility + randomInt(2, 6), 0, 100);
      g.globalWar.warScore = clamp((g.globalWar.warScore || 0) + 1, 0, 100);
    } else if (roll < .18 && !blocSame) {
      ai.lastMove = "expandiu indústria militar";
      ai.economy = clamp(ai.economy + randomInt(2, 5), 1, 220);
    } else {
      ai.lastMove = ai.posture === "hostil" ? "em prontidão ofensiva" : "monitorando";
    }
  });
  const topHostile = topAiThreats(1)[0];
  if (topHostile && topHostile.hostility > 82 && Math.random() < .28) {
    const enemy = getCountry(topHostile.id);
    g.threats.push({ id: cryptoId(), countryId: enemy.id, level: clamp(topHostile.power / 2 + topHostile.readiness / 2, 35, 98), type: "pressão militar IA", coords: jitter(enemy.coords, 1.8) });
    g.threats = g.threats.slice(-8);
    g.worldTension = clamp(g.worldTension + 2, 0, 100);
    events.push(`${enemy.name} iniciou pressão militar direta contra sua zona de influência.`);
  }
  events.slice(0, 2).forEach(text => g.events.push(eventText("warn", text)));
  updateGlobalPhase();
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
    damageRegionalUnits(region.id, intercepted ? 5 : 12, enemy.name);
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


function monthlyUpkeep() {
  const g = state.game;
  return (g.units || []).reduce((sum, stack) => {
    const u = getUnit(stack.id);
    if (!u) return sum;
    const condPenalty = (stack.condition ?? 100) < 45 ? 1.22 : 1;
    sum.finance += Math.round(u.upkeep * stack.qty * condPenalty);
    sum.energy += Math.max(1, Math.round((u.upkeep * stack.qty) / (u.class === 'Naval' || u.class === 'Aéreo' ? 1.6 : 3.2)));
    sum.industry += Math.max(0, Math.round((u.upkeep * stack.qty) / 5));
    return sum;
  }, { finance: 0, energy: 0, industry: 0 });
}

function forceCondition() {
  const units = state.game?.units || [];
  const totalQty = units.reduce((s,u)=>s+u.qty,0);
  if (!totalQty) return 100;
  return clamp(units.reduce((s,u)=>s+(u.condition ?? 100)*u.qty,0)/totalQty,0,100);
}

function stackRepairCost(stack) {
  const u = getUnit(stack.id);
  const missing = Math.max(0, 100 - (stack.condition ?? 100));
  return {
    finance: Math.max(6, Math.round(missing * (u.upkeep || 4) * .55 * Math.max(1, stack.qty * .65))),
    industry: Math.max(3, Math.round(missing * .35 * Math.max(1, stack.qty * .45))),
    energy: Math.max(2, Math.round(missing * .18 * Math.max(1, stack.qty * .35)))
  };
}

function replacementCost(stack) {
  const u = getUnit(stack.id);
  return { finance: Math.round(u.cost * .85), industry: Math.max(4, Math.round(u.cost * .22)), energy: Math.max(3, Math.round(u.upkeep * 2.2)) };
}

function maintainStack(index) {
  const stack = state.game.units[index];
  if (!stack) return;
  const cost = stackRepairCost(stack);
  if (stack.condition >= 100 || state.game.finance < cost.finance || state.game.industry < cost.industry || state.game.energy < cost.energy) return;
  state.game.finance -= cost.finance;
  state.game.industry -= cost.industry;
  state.game.energy -= cost.energy;
  stack.condition = clamp((stack.condition ?? 100) + randomInt(22, 38), 0, 100);
  state.game.readiness = clamp(state.game.readiness + 2, 0, 100);
  state.game.events.push(eventText('sistema', `${getUnit(stack.id).name} recebeu manutenção em ${getRegion(stack.regionId).name}. Condição: ${stack.condition}%.`));
  saveGame(); renderGame();
}

function replaceStack(index) {
  const stack = state.game.units[index];
  if (!stack) return;
  const u = getUnit(stack.id);
  const cost = replacementCost(stack);
  if (!hasOperationalBase(u.requires, stack.regionId, u.minBaseLevel || 1) || state.game.finance < cost.finance || state.game.industry < cost.industry || state.game.energy < cost.energy) return;
  state.game.finance -= cost.finance;
  state.game.industry -= cost.industry;
  state.game.energy -= cost.energy;
  state.game.production.push({ id: cryptoId(), unitId: u.id, regionId: stack.regionId, remaining: Math.max(1, (u.buildMonths || 2) - 1), replacement: true });
  state.game.events.push(eventText('sistema', `Reposição de ${u.name} enviada para ${getRegion(stack.regionId).name}.`));
  saveGame(); renderGame();
}

function applyMonthlyWear(upkeep) {
  const g = state.game;
  const shortage = (g.finance <= 4 || g.energy <= 4 || g.industry <= 3) ? 4 : 0;
  (g.units || []).forEach(stack => {
    const u = getUnit(stack.id);
    if (!u) return;
    const classWear = u.class === 'Naval' || u.class === 'Aéreo' ? 2 : 1;
    const wear = randomInt(1, 2 + classWear) + Math.floor(g.worldTension / 45) + shortage;
    stack.condition = clamp((stack.condition ?? 100) - wear, 0, 100);
    if (stack.condition < 18 && stack.qty > 0 && Math.random() < .16) {
      reduceStackQty(stack, 1, `${u.name} sofreu baixa por falta de manutenção.`);
    }
  });
}

function applyOperationalWear(kind, success) {
  const r = getSelectedRegion();
  const candidates = regionUnits(r.id).filter(stack => operationUsesUnit(kind, getUnit(stack.id)));
  if (!candidates.length) return;
  const wearBase = { recon: 4, airstrike: 10, naval: 10, combined: 14 }[kind] || 6;
  candidates.slice(0, 4).forEach(stack => {
    const u = getUnit(stack.id);
    const wear = wearBase + (success ? randomInt(0, 4) : randomInt(5, 12));
    stack.condition = clamp((stack.condition ?? 100) - wear, 0, 100);
    if (!success && stack.condition < 28 && Math.random() < .24) reduceStackQty(stack, 1, `${u.name} sofreu perdas em operação.`);
  });
  state.game.events.push(eventText(success ? 'warn' : 'danger', `Operação gerou desgaste nas unidades de ${r.name}. Manutenção recomendada.`));
}

function operationUsesUnit(kind, u) {
  if (!u) return false;
  if (kind === 'recon') return ['Aéreo','Estratégico','Terrestre'].includes(u.class);
  if (kind === 'airstrike') return u.class === 'Aéreo' || u.id === 'missile_battery';
  if (kind === 'naval') return u.class === 'Naval' || u.class === 'Aéreo';
  return true;
}

function damageRegionalUnits(regionId, severity, enemyName) {
  const stacks = regionUnits(regionId).sort((a,b)=>(a.condition ?? 100)-(b.condition ?? 100)).slice(0,3);
  if (!stacks.length) return;
  stacks.forEach(stack => {
    const u = getUnit(stack.id);
    const damage = randomInt(Math.max(2, severity-3), severity+8);
    stack.condition = clamp((stack.condition ?? 100) - damage, 0, 100);
    if (stack.condition < 20 && Math.random() < .20) reduceStackQty(stack, 1, `${enemyName} causou baixa em ${u.name}.`);
  });
}

function reduceStackQty(stack, qty, reason) {
  const u = getUnit(stack.id);
  const loss = Math.min(qty, stack.qty);
  if (loss <= 0) return;
  stack.qty -= loss;
  state.game.monthlyLosses = (state.game.monthlyLosses || 0) + loss;
  removeUnitPower(u, loss);
  state.game.events.push(eventText('danger', reason || `${u.name} perdeu ${loss} lote(s).`));
  if (stack.qty <= 0) state.game.units = state.game.units.filter(s => s !== stack);
}

function addUnitPower(u) {
  const g = state.game;
  if (u.class === "Terrestre") g.landPower += u.power;
  if (u.class === "Aéreo") g.airPower += u.power;
  if (u.class === "Naval") g.navalPower += u.power;
  if (u.class === "Estratégico") g.missilePower += u.power;
  g.readiness = clamp(g.readiness + 2, 0, 100);
}

function removeUnitPower(u, qty = 1) {
  const g = state.game;
  if (!u) return;
  if (u.class === "Terrestre") g.landPower = Math.max(0, g.landPower - u.power * qty);
  if (u.class === "Aéreo") g.airPower = Math.max(0, g.airPower - u.power * qty);
  if (u.class === "Naval") g.navalPower = Math.max(0, g.navalPower - u.power * qty);
  if (u.class === "Estratégico") g.missilePower = Math.max(0, g.missilePower - u.power * qty);
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
function hasOperationalBase(type, regionId, minLevel = 1) { return state.game.bases.some(b => b.type === type && b.regionId === regionId && b.condition > 20 && b.level >= minLevel); }
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
function ownedUnitQty(unitId) { return state.game?.units?.filter(u => u.id === unitId).reduce((sum,u)=>sum+u.qty,0) || 0; }
function slug(text) { return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
function getBuilding(id) { return state.buildings.find(b => b.id === id); }
function getCountry(id) { return state.countries.find(c => c.id === id); }
function topAiThreats(limit = 8) { ensureAiWorld(); return [...state.game.aiWorld].sort((a,b) => ((b.power + b.readiness + b.hostility) - (a.power + a.readiness + a.hostility))).slice(0, limit); }
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
