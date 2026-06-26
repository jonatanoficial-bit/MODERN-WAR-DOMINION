const VERSION = "2.1.0";
const PHASE = "Fase 21 — guerra aérea";
const SAVE_KEY = "MWD_SAVE_F17";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  countries: [],
  buildings: [],
  units: [],
  selectedCountry: null,
  game: null,
  map: null,
  layers: { countries: null, regions: null, bases: null, threats: null, fronts: null, airOps: null },
  arsenalFilter: "Todos"
};

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const LANG_KEY = "MWD_LANG";
const SUPPORTED_LANGS = ["pt-BR", "en-US", "es-ES"];
let I18N = {};
let currentLang = localStorage.getItem(LANG_KEY) || "pt-BR";

async function loadLanguage(lang = currentLang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = "pt-BR";
  try {
    const response = await fetch(`data/lang/${lang}.json`);
    I18N = await response.json();
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
  } catch (err) {
    console.warn("Falha ao carregar idioma", err);
    if (lang !== "pt-BR") return loadLanguage("pt-BR");
  }
}

function t(key, fallback = "") {
  return I18N[key] || fallback || key;
}

function applyStaticI18n() {
  document.documentElement.lang = currentLang === "pt-BR" ? "pt-BR" : currentLang === "es-ES" ? "es" : "en";
  document.title = `${t("app.title", "Modern War Dominion")} — ${t("phase.label", "Fase 15 · v1.5.0")}`;
  const select = $("#languageSelect");
  if (select) select.value = currentLang;
  $$("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key, el.textContent);
  });
  $$("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    el.setAttribute("placeholder", t(key, el.getAttribute("placeholder") || ""));
  });
}

async function setLanguage(lang) {
  await loadLanguage(lang);
  applyStaticI18n();
  if (state.game) renderGame();
  else renderNationGrid();
}

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
  await loadLanguage(currentLang);
  await loadData();
  bindUi();
  applyStaticI18n();
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
  $("#languageSelect")?.addEventListener("change", event => setLanguage(event.target.value));
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
  if (!grid) return;
  grid.innerHTML = "";
  const selectedId = state.selectedCountry?.id || "br";
  const list = state.countries.filter(c => [c.name, c.capital, c.region, c.doctrine, c.bloc, c.iso, c.flagCode, ...(c.flagAliases || [])].join(" ").toLowerCase().includes(term));
  list.forEach(country => {
    const card = document.createElement("article");
    card.className = "nation-card";
    card.classList.toggle("is-selected", country.id === selectedId);
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${t("nation.selected", "Selecionar")} ${country.name}`);
    card.innerHTML = `
      <div class="nation-top">${flagHtml(country, "flag-img-lg")}<div><h3>${country.name}</h3><small>${country.capital} · ${country.region}</small></div></div>
      <small class="nation-doctrine">${country.doctrine}</small>
      <div class="stat-pills"><span>Militar ${country.military}</span><span>PIB ${country.gdpGame}</span><span>Defesa ${country.defenseBudget}</span><span>Navios ${country.warships}</span><span>Aeronaves ${country.airframes}</span><span>${country.nuclear ? "Nuclear" : "Convencional"}</span></div>
      <button class="select-country" type="button">${t("nation.command", "Comandar")} ${country.name}</button>`;
    card.addEventListener("click", () => selectCountryForStart(country.id));
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectCountryForStart(country.id);
      }
    });
    card.querySelector("button").addEventListener("click", event => {
      event.stopPropagation();
      startGame(country.id);
    });
    grid.appendChild(card);
  });
  renderNationConfirmTray(list);
}

function selectCountryForStart(countryId) {
  const country = state.countries.find(c => c.id === countryId);
  if (!country) return;
  state.selectedCountry = country;
  renderNationGrid();
}

function renderNationConfirmTray(list = state.countries) {
  let tray = $("#nationConfirmTray");
  if (!tray) {
    tray = document.createElement("div");
    tray.id = "nationConfirmTray";
    tray.className = "nation-confirm-tray";
    $("#screenNation")?.appendChild(tray);
  }
  const selected = state.selectedCountry || list[0] || state.countries[0];
  if (!selected) {
    tray.innerHTML = "";
    return;
  }
  tray.innerHTML = `
    <div class="confirm-country">
      ${flagHtml(selected, "confirm-flag-img")}
      <div><small>${t("nation.selectedHint", "País selecionado")}</small><strong>${selected.name}</strong><span>${selected.capital} · ${selected.region}</span></div>
    </div>
    <button id="confirmNationBtn" type="button">${t("nation.confirm", "Confirmar país")}</button>`;
  $("#confirmNationBtn")?.addEventListener("click", () => startGame(selected.id));
}

function makeTutorialState() {
  return {
    claimed: [],
    reconDone: false,
    startedAt: Date.now()
  };
}

function ensureTutorial() {
  if (!state.game) return null;
  if (!state.game.tutorial) state.game.tutorial = makeTutorialState();
  if (!Array.isArray(state.game.tutorial.claimed)) state.game.tutorial.claimed = [];
  return state.game.tutorial;
}

function ensureBattleReports() {
  if (!state.game) return [];
  if (!Array.isArray(state.game.battleReports)) state.game.battleReports = [];
  return state.game.battleReports;
}

function battleOperationLabel(kind) {
  const labels = {
    recon: currentLang === "en-US" ? "Strategic reconnaissance" : currentLang === "es-ES" ? "Reconocimiento estratégico" : "Reconhecimento estratégico",
    airstrike: currentLang === "en-US" ? "Limited airstrike" : currentLang === "es-ES" ? "Ataque aéreo limitado" : "Ataque aéreo limitado",
    naval: currentLang === "en-US" ? "Naval blockade" : currentLang === "es-ES" ? "Bloqueo naval" : "Bloqueio naval",
    combined: currentLang === "en-US" ? "Combined operation" : currentLang === "es-ES" ? "Operación combinada" : "Operação combinada"
  };
  return labels[kind] || kind;
}

function makeBattleReport(kind, target, attack, defense, success, op) {
  const g = state.game;
  const intensity = kind === "recon" ? 1 : kind === "airstrike" ? 2 : kind === "naval" ? 2 : 4;
  const ratio = clamp((attack / Math.max(1, defense)) * 50, 0, 140);
  const ownLosses = kind === "recon" ? randomInt(0, success ? 1 : 3) : Math.max(1, randomInt(intensity, intensity * 8) + (success ? 0 : intensity * 4));
  const enemyDamage = success ? randomInt(8 * intensity, 18 * intensity) + Math.round(ratio / 10) : randomInt(1, 6 * intensity);
  const readinessImpact = success ? Math.max(1, Math.round(op.tension / 3)) : Math.max(2, Math.round(op.tension / 2));
  const report = {
    id: cryptoId(),
    kind,
    operation: battleOperationLabel(kind),
    targetId: target.id,
    targetName: target.name,
    targetFlag: target.flag,
    success,
    attack: Math.round(attack),
    defense: Math.round(defense),
    ownLosses,
    enemyDamage,
    tension: op.tension,
    readinessImpact,
    month: g.month,
    year: g.year,
    createdAt: new Date().toISOString()
  };
  ensureBattleReports().push(report);
  g.battleReports = g.battleReports.slice(-10);
  return report;
}

function latestBattleReport() {
  const list = ensureBattleReports();
  return list[list.length - 1] || null;
}

function renderBattleReportMini() {
  const report = latestBattleReport();
  if (!report) return "";
  return `
    <article class="latest-battle-mini ${report.success ? "success" : "failure"}">
      <div>
        <small>${t("battle.title", "Relatório de batalha")}</small>
        <strong>${report.targetFlag || "🏳️"} ${report.operation}</strong>
        <span>${report.targetName} · ${report.success ? t("battle.success", "Sucesso tático") : t("battle.failure", "Falha operacional")}</span>
      </div>
      <button id="openLatestBattleBtn">${t("battle.open", "Ver batalha")}</button>
    </article>`;
}

function renderBattleReport() {
  const box = $("#battleReportPanel");
  if (!box || !state.game) return;
  const report = latestBattleReport();
  if (!report) {
    box.innerHTML = `<div class="empty-battle">${t("battle.empty", "Nenhuma batalha registrada ainda. Faça reconhecimento ou ataque um alvo no painel Atacar.")}</div>`;
    return;
  }
  const resultText = report.success ? t("battle.success", "Sucesso tático") : t("battle.failure", "Falha operacional");
  const resultClass = report.success ? "success" : "failure";
  const history = ensureBattleReports().slice(-5).reverse();
  box.innerHTML = `
    <article class="battle-hero ${resultClass}">
      <div class="battle-radar">
        <i></i><i></i><i></i><span>${report.success ? "✓" : "!"}</span>
      </div>
      <div>
        <small>${t("battle.result", "Resultado")}</small>
        <strong>${resultText}</strong>
        <p>${report.operation} · ${report.targetFlag || "🏳️"} ${report.targetName}</p>
      </div>
    </article>

    <div class="battle-bars">
      <div><span>${t("battle.ourForce", "Nossa força")}</span><b>${report.attack}</b><i style="width:${clamp(report.attack, 0, 140)}%"></i></div>
      <div><span>${t("battle.enemyDefense", "Defesa inimiga")}</span><b>${report.defense}</b><i style="width:${clamp(report.defense, 0, 140)}%"></i></div>
    </div>

    <div class="battle-kpis">
      <div><small>${t("battle.target", "Alvo")}</small><strong>${report.targetFlag || "🏳️"} ${report.targetName}</strong></div>
      <div><small>${t("battle.operation", "Operação")}</small><strong>${report.operation}</strong></div>
      <div><small>${t("battle.losses", "Perdas próprias")}</small><strong>${report.ownLosses}</strong></div>
      <div><small>${t("battle.enemyDamage", "Dano inimigo")}</small><strong>${report.enemyDamage}</strong></div>
      <div><small>${t("battle.tension", "Tensão")}</small><strong>+${report.tension}</strong></div>
      <div><small>${t("battle.readiness", "Prontidão")}</small><strong>-${report.readinessImpact}</strong></div>
    </div>

    <h3 class="battle-history-title">${t("battle.history", "Histórico recente")}</h3>
    <div class="battle-history">
      ${history.map(item => `<article class="${item.success ? "success" : "failure"}"><b>${item.targetFlag || "🏳️"}</b><div><strong>${item.operation}</strong><span>${item.targetName} · ${item.success ? t("battle.success", "Sucesso tático") : t("battle.failure", "Falha operacional")}</span></div><small>${monthNames[item.month % 12]}/${item.year}</small></article>`).join("")}
    </div>`;
}

function tutorialMissions() {
  const g = state.game;
  const hasBaseQueued = g.bases.length + g.construction.length > 0;
  const hasOperationalBaseReady = g.bases.length > 0;
  const hasUnitQueued = g.production.length + g.units.length > 0;
  const hasOperationalUnit = g.units.length > 0;
  const tutorial = ensureTutorial();
  return [
    { id: "build-base", title: t("tutorial.m1.title", "Construir sua primeira base"), text: t("tutorial.m1.text", "Toque em Construir para iniciar uma base na região da capital."), reward: t("tutorial.m1.reward", "+80 finanças, +60 indústria"), done: hasBaseQueued, action: "build" },
    { id: "finish-base", title: t("tutorial.m2.title", "Concluir a construção"), text: t("tutorial.m2.text", "Avance o mês até a base ficar operacional."), reward: t("tutorial.m2.reward", "+40 energia, +4 defesa"), done: hasOperationalBaseReady, action: "month" },
    { id: "queue-unit", title: t("tutorial.m3.title", "Produzir primeira unidade"), text: t("tutorial.m3.text", "Com a base pronta, produza uma unidade militar."), reward: t("tutorial.m3.reward", "+60 finanças"), done: hasUnitQueued, action: "produce" },
    { id: "finish-unit", title: t("tutorial.m4.title", "Receber tropa operacional"), text: t("tutorial.m4.text", "Avance o mês até a unidade entrar no seu exército."), reward: t("tutorial.m4.reward", "+3 prontidão, +2 poder terrestre"), done: hasOperationalUnit, action: "month" },
    { id: "recon", title: t("tutorial.m5.title", "Fazer reconhecimento"), text: t("tutorial.m5.text", "Abra Atacar e faça um reconhecimento antes de uma guerra maior."), reward: t("tutorial.m5.reward", "+5 inteligência, -2 tensão"), done: !!tutorial?.reconDone, action: "ops" },
    { id: "survive-3", title: t("tutorial.m6.title", "Sobreviver aos 3 primeiros meses"), text: t("tutorial.m6.text", "Mantenha produção, recursos e defesa durante os primeiros meses."), reward: t("tutorial.m6.reward", "+100 finanças, +80 indústria, +5 estabilidade"), done: g.month >= 3, action: "month" }
  ];
}

function applyTutorialReward(id) {
  const g = state.game;
  if (!g) return;
  if (id === "build-base") { g.finance += 80; g.industry += 60; }
  if (id === "finish-base") { g.energy += 40; g.defense += 4; }
  if (id === "queue-unit") { g.finance += 60; }
  if (id === "finish-unit") { g.readiness = clamp(g.readiness + 3, 0, 100); g.landPower += 2; }
  if (id === "recon") { g.intel = clamp(g.intel + 5, 0, 100); g.worldTension = clamp(g.worldTension - 2, 0, 100); }
  if (id === "survive-3") { g.finance += 100; g.industry += 80; g.stability = clamp(g.stability + 5, 0, 100); }
}

function evaluateTutorialMissions() {
  if (!state.game) return;
  const tutorial = ensureTutorial();
  const missions = tutorialMissions();
  let changed = false;
  missions.forEach(mission => {
    if (mission.done && !tutorial.claimed.includes(mission.id)) {
      tutorial.claimed.push(mission.id);
      applyTutorialReward(mission.id);
      state.game.events.unshift(eventText("tutorial", `✅ ${mission.title} — ${mission.reward}`));
      changed = true;
    }
  });
  if (changed) saveGame();
}

function runTutorialAction(action) {
  if (action === "build") return quickBuildRecommended();
  if (action === "produce") return quickProduceRecommended();
  if (action === "month") return advanceMonth();
  if (action === "ops") return activatePanel("panelOps");
  return runRecommendedAction(commanderRecommendation());
}

function renderTutorialMissions() {
  const tutorial = ensureTutorial();
  const missions = tutorialMissions();
  const completed = missions.filter(m => tutorial.claimed.includes(m.id)).length;
  const next = missions.find(m => !tutorial.claimed.includes(m.id));
  return `
    <section class="tutorial-board">
      <div class="tutorial-head">
        <div><small>${t("tutorial.progress", "Progresso")}</small><strong>${t("tutorial.title", "Missões iniciais")}</strong></div>
        <span>${completed}/${missions.length}</span>
      </div>
      <div class="tutorial-progress"><i style="width:${Math.round((completed / missions.length) * 100)}%"></i></div>
      <div class="tutorial-list">
        ${missions.map((mission, index) => {
          const claimed = tutorial.claimed.includes(mission.id);
          const isNext = next && next.id === mission.id;
          return `
            <article class="tutorial-mission ${claimed ? "done" : isNext ? "next" : "locked"}">
              <b>${claimed ? "✓" : index + 1}</b>
              <div>
                <strong>${mission.title}</strong>
                <span>${mission.text}</span>
                <small>${t("tutorial.reward", "Recompensa")}: ${mission.reward}</small>
              </div>
              ${claimed ? `<em>${t("tutorial.done", "Concluída")}</em>` : isNext ? `<button class="tutorial-action" data-tutorial-action="${mission.action}">${mission.action === "ops" ? t("tutorial.openOps", "Abrir ataque") : mission.action === "month" ? t("tutorial.advance", "Avançar mês") : t("tutorial.action", "Fazer")}</button>` : ""}
            </article>`;
        }).join("")}
      </div>
    </section>`;
}

function bindTutorialMissionButtons() {
  $$(".tutorial-action").forEach(btn => btn.addEventListener("click", () => runTutorialAction(btn.dataset.tutorialAction)));
}


function makeWarEconomy(country) {
  return {
    mobilization: "normal",
    warBonds: 0,
    inflation: 6 + Math.max(0, Math.round((60 - country.stability) / 12)),
    civilianMorale: clamp(country.publicSupport || 60, 25, 95),
    industrialCapacity: clamp(country.industry || 60, 20, 120),
    energyStress: clamp(30 + Math.round((70 - (country.oil || 50)) / 2), 0, 95),
    tradeFlow: clamp(55 + Math.round((country.diplomacy || 50) / 3), 20, 100),
    rationing: false,
    propaganda: 0,
    lastPolicy: currentLang === "en-US" ? "Peacetime economy" : currentLang === "es-ES" ? "Economía de paz" : "Economia de paz"
  };
}

function ensureWarEconomy() {
  if (!state.game) return null;
  const c = getPlayerCountry();
  if (!state.game.warEconomy) state.game.warEconomy = makeWarEconomy(c);
  const e = state.game.warEconomy;
  e.mobilization ||= "normal";
  e.warBonds = Number(e.warBonds || 0);
  e.inflation = clamp(e.inflation ?? 6, 0, 150);
  e.civilianMorale = clamp(e.civilianMorale ?? c.publicSupport ?? 60, 0, 100);
  e.industrialCapacity = clamp(e.industrialCapacity ?? c.industry ?? 60, 0, 150);
  e.energyStress = clamp(e.energyStress ?? 30, 0, 100);
  e.tradeFlow = clamp(e.tradeFlow ?? 65, 0, 120);
  e.rationing = !!e.rationing;
  e.propaganda = clamp(e.propaganda ?? 0, 0, 100);
  return e;
}

function mobilizationLevel(value) {
  return value === "total" ? 2 : value === "partial" ? 1 : 0;
}

function mobilizationLabel(value) {
  if (value === "total") return t("economy.total", "Total");
  if (value === "partial") return t("economy.partial", "Parcial");
  return t("economy.normal", "Normal");
}

function economyMonthlyModifiers() {
  const e = ensureWarEconomy();
  const level = mobilizationLevel(e.mobilization);
  return {
    finance: Math.round((e.tradeFlow - 55) / 6 - e.inflation / 7 - e.warBonds * 2),
    industry: Math.round(level * 18 + (e.industrialCapacity - 55) / 3 - e.energyStress / 8),
    energy: Math.round((e.rationing ? 18 : 0) - e.energyStress / 5 - level * 7),
    stability: Math.round((e.civilianMorale - 55) / 18 - e.inflation / 18 - level),
    readiness: Math.round(level * 2 + (e.propaganda > 10 ? 1 : 0)),
    tension: level
  };
}

function progressWarEconomy(upkeep) {
  const g = state.game;
  const e = ensureWarEconomy();
  const level = mobilizationLevel(e.mobilization);
  e.inflation = clamp(e.inflation + level + Math.round((upkeep.finance || 0) / 80) + (e.warBonds > 0 ? 1 : 0) - (e.rationing ? 1 : 0), 0, 150);
  e.energyStress = clamp(e.energyStress + level * 2 + Math.round((upkeep.energy || 0) / 25) - (e.rationing ? 3 : 0), 0, 100);
  e.civilianMorale = clamp(e.civilianMorale - level - Math.round(e.inflation / 35) - (e.rationing ? 1 : 0) + (e.propaganda > 0 ? 2 : 0), 0, 100);
  e.tradeFlow = clamp(e.tradeFlow - Math.round(g.worldTension / 45) - (g.globalWar?.sanctions?.length || 0), 0, 120);
  e.industrialCapacity = clamp(e.industrialCapacity + level + (g.bases.length > 3 ? 1 : 0) - Math.round(e.energyStress / 55), 0, 150);
  e.propaganda = clamp(e.propaganda - 6, 0, 100);
  const mods = economyMonthlyModifiers();
  g.stability = clamp(g.stability + mods.stability, 0, 100);
  g.readiness = clamp(g.readiness + mods.readiness, 0, 120);
  g.worldTension = clamp(g.worldTension + mods.tension, 0, 100);
  return mods;
}

function warEconomyAction(kind) {
  const g = state.game;
  const e = ensureWarEconomy();
  if (!g || !e) return;
  if (kind === "mobilize") {
    if (e.mobilization === "normal") e.mobilization = "partial";
    else if (e.mobilization === "partial") e.mobilization = "total";
    else { g.events.push(eventText("warn", currentLang === "en-US" ? "The country is already fully mobilized." : currentLang === "es-ES" ? "El país ya está totalmente movilizado." : "O país já está em mobilização total.")); renderGame(); return; }
    g.finance = Math.max(0, g.finance - 35);
    g.industry += 90;
    g.readiness = clamp(g.readiness + 4, 0, 120);
    g.worldTension = clamp(g.worldTension + 2, 0, 100);
    e.inflation = clamp(e.inflation + 3, 0, 150);
    e.civilianMorale = clamp(e.civilianMorale - 3, 0, 100);
    e.lastPolicy = t("economy.mobilize", "Mobilizar país");
  }
  if (kind === "demobilize") {
    if (e.mobilization === "total") e.mobilization = "partial";
    else if (e.mobilization === "partial") e.mobilization = "normal";
    else { g.events.push(eventText("warn", currentLang === "en-US" ? "Mobilization is already normal." : currentLang === "es-ES" ? "La movilización ya está normal." : "A mobilização já está normal.")); renderGame(); return; }
    g.stability = clamp(g.stability + 5, 0, 100);
    g.readiness = clamp(g.readiness - 4, 0, 120);
    e.civilianMorale = clamp(e.civilianMorale + 5, 0, 100);
    e.inflation = clamp(e.inflation - 2, 0, 150);
    e.lastPolicy = t("economy.demobilize", "Reduzir mobilização");
  }
  if (kind === "bonds") {
    g.finance += 210;
    e.warBonds += 1;
    e.inflation = clamp(e.inflation + 4, 0, 150);
    e.civilianMorale = clamp(e.civilianMorale - 1, 0, 100);
    e.lastPolicy = t("economy.bonds", "Emitir títulos");
  }
  if (kind === "shift") {
    if (g.energy < 35) { g.events.push(eventText("warn", currentLang === "en-US" ? "Not enough energy for industrial conversion." : currentLang === "es-ES" ? "Energía insuficiente para conversión industrial." : "Energia insuficiente para conversão industrial.")); renderGame(); return; }
    g.energy -= 35;
    g.industry += 150;
    e.industrialCapacity = clamp(e.industrialCapacity + 9, 0, 150);
    e.energyStress = clamp(e.energyStress + 6, 0, 100);
    e.inflation = clamp(e.inflation + 2, 0, 150);
    e.lastPolicy = t("economy.shift", "Indústria militar");
  }
  if (kind === "ration") {
    e.rationing = !e.rationing;
    if (e.rationing) {
      g.energy += 65;
      g.food += 80;
      e.civilianMorale = clamp(e.civilianMorale - 4, 0, 100);
    } else {
      e.civilianMorale = clamp(e.civilianMorale + 3, 0, 100);
    }
    e.lastPolicy = `${t("economy.ration", "Racionamento")}: ${e.rationing ? t("economy.rationOn", "Ativo") : t("economy.rationOff", "Inativo")}`;
  }
  if (kind === "propaganda") {
    if (g.finance < 35) { g.events.push(eventText("warn", currentLang === "en-US" ? "Not enough funds for public campaign." : currentLang === "es-ES" ? "Fondos insuficientes para campaña pública." : "Finanças insuficientes para campanha pública.")); renderGame(); return; }
    g.finance -= 35;
    g.stability = clamp(g.stability + 3, 0, 100);
    e.civilianMorale = clamp(e.civilianMorale + 7, 0, 100);
    e.propaganda = clamp(e.propaganda + 24, 0, 100);
    e.lastPolicy = t("economy.propaganda", "Campanha pública");
  }
  g.events.push(eventText("sistema", `${t("economy.title", "Economia de Guerra")}: ${e.lastPolicy}.`));
  saveGame();
  renderGame();
}

function renderWarEconomy() {
  const panel = $("#warEconomyPanel");
  if (!panel || !state.game) return;
  const e = ensureWarEconomy();
  const mods = economyMonthlyModifiers();
  const g = state.game;
  panel.innerHTML = `
    <section class="economy-hero">
      <div>
        <small>${t("economy.status", "Estado econômico")}</small>
        <strong>${mobilizationLabel(e.mobilization)}</strong>
        <span>${e.lastPolicy || ""}</span>
      </div>
      <div class="economy-badge">${t("economy.gdp", "PIB de guerra")} ${Math.round((g.finance + g.industry + g.energy) / 12)}</div>
    </section>
    <div class="economy-kpis">
      <div><small>${t("economy.inflation", "Inflação")}</small><strong>${e.inflation}%</strong></div>
      <div><small>${t("economy.morale", "Moral civil")}</small><strong>${e.civilianMorale}%</strong></div>
      <div><small>${t("economy.industry", "Capacidade industrial")}</small><strong>${e.industrialCapacity}%</strong></div>
      <div><small>${t("economy.energyStress", "Pressão energética")}</small><strong>${e.energyStress}%</strong></div>
      <div><small>${t("economy.trade", "Fluxo comercial")}</small><strong>${e.tradeFlow}%</strong></div>
      <div><small>${t("economy.debt", "Títulos de guerra")}</small><strong>${e.warBonds}</strong></div>
    </div>
    <div class="economy-bars">
      ${economyBar(t("economy.inflation", "Inflação"), e.inflation, "danger")}
      ${economyBar(t("economy.morale", "Moral civil"), e.civilianMorale, "good")}
      ${economyBar(t("economy.energyStress", "Pressão energética"), e.energyStress, "warn")}
    </div>
    <h3>${t("economy.monthly", "Impacto mensal")}</h3>
    <div class="economy-impact">
      <span>💵 ${mods.finance >= 0 ? "+" : ""}${mods.finance}</span>
      <span>🏭 ${mods.industry >= 0 ? "+" : ""}${mods.industry}</span>
      <span>⚡ ${mods.energy >= 0 ? "+" : ""}${mods.energy}</span>
      <span>🛡️ ${mods.stability >= 0 ? "+" : ""}${mods.stability}</span>
    </div>
    <h3>${t("economy.policy", "Políticas rápidas")}</h3>
    <div class="economy-actions">
      <button data-economy-action="mobilize">🪖 ${t("economy.mobilize", "Mobilizar país")}</button>
      <button data-economy-action="demobilize">🕊️ ${t("economy.demobilize", "Reduzir mobilização")}</button>
      <button data-economy-action="bonds">💵 ${t("economy.bonds", "Emitir títulos")}</button>
      <button data-economy-action="shift">🏭 ${t("economy.shift", "Indústria militar")}</button>
      <button data-economy-action="ration">🍞 ${t("economy.ration", "Racionamento")} · ${e.rationing ? t("economy.rationOn", "Ativo") : t("economy.rationOff", "Inativo")}</button>
      <button data-economy-action="propaganda">📣 ${t("economy.propaganda", "Campanha pública")}</button>
    </div>
    <p class="economy-tip">${t("economy.tip", "Dica: mobilização aumenta produção, mas inflação e moral civil podem destruir a estabilidade.")}</p>
  `;
  $$("#warEconomyPanel [data-economy-action]").forEach(btn => btn.addEventListener("click", () => warEconomyAction(btn.dataset.economyAction)));
}

function economyBar(label, value, kind) {
  const pct = clamp(value, 0, 100);
  return `<div class="economy-bar ${kind}"><span>${label}</span><b>${value}%</b><i style="width:${pct}%"></i></div>`;
}


function makeCyberOps() {
  return {
    spyNetwork: 20,
    security: 35,
    cyberOffense: 28,
    counterIntel: 25,
    exposure: 8,
    selectedTargetId: null,
    lastOperation: null,
    history: []
  };
}

function ensureCyberOps() {
  if (!state.game) return null;
  if (!state.game.cyberOps) state.game.cyberOps = makeCyberOps();
  const ops = state.game.cyberOps;
  if (!Array.isArray(ops.history)) ops.history = [];
  ops.spyNetwork = clamp(ops.spyNetwork ?? 20, 0, 160);
  ops.security = clamp(ops.security ?? 35, 0, 160);
  ops.cyberOffense = clamp(ops.cyberOffense ?? 28, 0, 160);
  ops.counterIntel = clamp(ops.counterIntel ?? 25, 0, 160);
  ops.exposure = clamp(ops.exposure ?? 8, 0, 100);
  if (!ops.selectedTargetId || !getCountry(ops.selectedTargetId) || ops.selectedTargetId === state.game.countryId) {
    const threat = topAiThreats(1)[0];
    ops.selectedTargetId = threat?.id || state.countries.find(c => c.id !== state.game.countryId)?.id;
  }
  return ops;
}

function cyberTargets() {
  ensureAiWorld();
  return topAiThreats(12).map(ai => {
    const c = getCountry(ai.id);
    return { ...ai, country: c };
  }).filter(t => t.country);
}

function cyberCost(kind) {
  const costs = {
    network: { finance: 55, industry: 10, energy: 8 },
    counter: { finance: 42, industry: 12, energy: 6 },
    attack: { finance: 70, industry: 18, energy: 26 },
    steal: { finance: 62, industry: 10, energy: 18 },
    psyops: { finance: 48, industry: 6, energy: 10 },
    defend: { finance: 35, industry: 8, energy: 12 }
  };
  return costs[kind] || costs.network;
}

function canPayCyber(cost) {
  const g = state.game;
  return g.finance >= (cost.finance || 0) && g.industry >= (cost.industry || 0) && g.energy >= (cost.energy || 0);
}

function payCyber(cost) {
  const g = state.game;
  g.finance -= cost.finance || 0;
  g.industry -= cost.industry || 0;
  g.energy -= cost.energy || 0;
}

function cyberOperation(kind) {
  const g = state.game;
  const ops = ensureCyberOps();
  const targetId = $("#cyberTargetSelect")?.value || ops.selectedTargetId;
  const target = getCountry(targetId);
  const ai = g.aiWorld?.find(a => a.id === targetId);
  const cost = cyberCost(kind);
  if (!canPayCyber(cost)) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Insufficient resources for intelligence operation." : currentLang === "es-ES" ? "Recursos insuficientes para la operación de inteligencia." : "Recursos insuficientes para operação de inteligência."));
    saveGame();
    renderGame();
    return;
  }

  ops.selectedTargetId = targetId;
  payCyber(cost);

  if (kind === "network") {
    ops.spyNetwork = clamp(ops.spyNetwork + randomInt(8, 14), 0, 160);
    ops.exposure = clamp(ops.exposure + 2, 0, 100);
    recordCyberHistory(kind, true, target, currentLang === "en-US" ? "Spy network expanded." : currentLang === "es-ES" ? "Red de espías expandida." : "Rede de espiões expandida.");
    g.events.push(eventText("sistema", currentLang === "en-US" ? "Intelligence network expanded inside rival territory." : currentLang === "es-ES" ? "Red de inteligencia expandida en territorio rival." : "Rede de inteligência expandida em território rival."));
    saveGame(); renderGame(); activatePanel("panelCyber"); return;
  }

  if (kind === "counter") {
    ops.counterIntel = clamp(ops.counterIntel + randomInt(8, 15), 0, 160);
    ops.security = clamp(ops.security + randomInt(5, 10), 0, 160);
    ops.exposure = clamp(ops.exposure - randomInt(4, 9), 0, 100);
    recordCyberHistory(kind, true, target, currentLang === "en-US" ? "Counterintelligence reinforced." : currentLang === "es-ES" ? "Contrainteligencia reforzada." : "Contrainteligência reforçada.");
    g.events.push(eventText("sistema", currentLang === "en-US" ? "Counterintelligence reduced exposure risk." : currentLang === "es-ES" ? "La contrainteligencia redujo el riesgo de exposición." : "Contrainteligência reduziu risco de exposição."));
    saveGame(); renderGame(); activatePanel("panelCyber"); return;
  }

  if (kind === "defend") {
    ops.security = clamp(ops.security + randomInt(8, 16), 0, 160);
    g.cyber = clamp(g.cyber + 2, 0, 160);
    recordCyberHistory(kind, true, target, currentLang === "en-US" ? "Cyber defense hardened." : currentLang === "es-ES" ? "Defensa cyber reforzada." : "Defesa cyber reforçada.");
    g.events.push(eventText("sistema", currentLang === "en-US" ? "National digital infrastructure hardened." : currentLang === "es-ES" ? "Infraestructura digital nacional reforzada." : "Infraestrutura digital nacional reforçada."));
    saveGame(); renderGame(); activatePanel("panelCyber"); return;
  }

  const defense = (target?.cyber || 40) + (target?.intel || 40) / 2 + (ai?.readiness || 45) / 3 + Math.random() * 45;
  const attack = g.cyber + g.intel / 2 + ops.spyNetwork * .65 + ops.cyberOffense * .75 + Math.random() * 55;
  const success = attack >= defense;
  const detected = Math.random() * 100 < clamp(ops.exposure + (success ? 8 : 22) - ops.counterIntel / 4 - ops.security / 5, 4, 88);
  let effect = "";

  if (success && ai) {
    if (kind === "attack") {
      ai.economy = clamp(ai.economy - randomInt(5, 13), 1, 230);
      ai.readiness = clamp(ai.readiness - randomInt(4, 10), 1, 100);
      ai.lastMove = "sofreu sabotagem cyber";
      effect = currentLang === "en-US" ? "Infrastructure sabotaged" : currentLang === "es-ES" ? "Infraestructura saboteada" : "Infraestrutura sabotada";
    }
    if (kind === "steal") {
      g.cyber = clamp(g.cyber + randomInt(2, 5), 0, 160);
      g.intel = clamp(g.intel + randomInt(2, 5), 0, 160);
      g.industry += randomInt(15, 34);
      effect = currentLang === "en-US" ? "Technology stolen" : currentLang === "es-ES" ? "Tecnología robada" : "Tecnologia roubada";
    }
    if (kind === "psyops") {
      ai.hostility = clamp(ai.hostility - randomInt(5, 12), 0, 100);
      ai.mobilization = clamp(ai.mobilization - randomInt(4, 9), 0, 100);
      g.worldTension = clamp(g.worldTension - randomInt(1, 4), 0, 100);
      effect = currentLang === "en-US" ? "Rival morale disrupted" : currentLang === "es-ES" ? "Moral rival desorganizada" : "Moral rival desorganizada";
    }
    ops.cyberOffense = clamp(ops.cyberOffense + randomInt(1, 3), 0, 160);
  } else {
    effect = currentLang === "en-US" ? "Operation failed" : currentLang === "es-ES" ? "Operación falló" : "Operação falhou";
    g.stability = clamp(g.stability - (detected ? 2 : 0), 0, 100);
  }

  if (detected) {
    g.worldTension = clamp(g.worldTension + randomInt(3, 8), 0, 100);
    ops.exposure = clamp(ops.exposure + randomInt(6, 14), 0, 100);
  } else {
    ops.exposure = clamp(ops.exposure + randomInt(1, 5), 0, 100);
  }

  recordCyberHistory(kind, success, target, effect, detected);
  g.events.push(eventText(success ? "sistema" : "warn", `${target?.name || "Alvo"}: ${effect}${detected ? " — operação detectada." : "."}`));
  saveGame();
  renderGame();
  activatePanel("panelCyber");
}

function recordCyberHistory(kind, success, target, effect, detected = false) {
  const ops = ensureCyberOps();
  const labels = {
    network: t("cyber.buildNetwork", "Expandir rede"),
    counter: t("cyber.counterIntel", "Reforçar contrainteligência"),
    attack: t("cyber.cyberAttack", "Sabotar infraestrutura"),
    steal: t("cyber.stealTech", "Roubar tecnologia"),
    psyops: t("cyber.psyops", "Operação psicológica"),
    defend: t("cyber.defend", "Defesa cyber")
  };
  const report = {
    id: cryptoId(),
    kind,
    label: labels[kind] || kind,
    success,
    detected,
    targetId: target?.id || ops.selectedTargetId,
    targetName: target?.name || "Alvo",
    effect,
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`
  };
  ops.lastOperation = report;
  ops.history.unshift(report);
  ops.history = ops.history.slice(0, 10);
}

function progressCyberOps() {
  const ops = ensureCyberOps();
  if (!ops) return;
  const pressure = state.game.worldTension > 65 ? 2 : 1;
  ops.exposure = clamp(ops.exposure - Math.max(1, Math.round((ops.counterIntel + ops.security) / 80)) + pressure, 0, 100);
  if (ops.exposure > 70 && Math.random() < .24) {
    state.game.worldTension = clamp(state.game.worldTension + 4, 0, 100);
    state.game.events.push(eventText("warn", currentLang === "en-US" ? "Foreign agencies are close to exposing a covert network." : currentLang === "es-ES" ? "Agencias extranjeras están cerca de exponer una red encubierta." : "Agências estrangeiras estão perto de expor uma rede encoberta."));
  }
}

function cyberBar(label, value) {
  return `<div class="cyber-bar"><div><span>${label}</span><strong>${value}</strong></div><i><b style="width:${clamp(value,0,100)}%"></b></i></div>`;
}

function renderCyberOps() {
  const panel = $("#cyberOpsPanel");
  if (!panel || !state.game) return;
  const ops = ensureCyberOps();
  const targets = cyberTargets();
  const selected = targets.find(t => t.id === ops.selectedTargetId) || targets[0];
  const last = ops.lastOperation;
  panel.innerHTML = `
    <div class="cyber-target-row">
      <label class="field-label">${t("cyber.target", "Alvo de inteligência")}</label>
      <select id="cyberTargetSelect">
        ${targets.map(tg => `<option value="${tg.id}" ${tg.id === ops.selectedTargetId ? "selected" : ""}>${tg.country.flag || ""} ${tg.country.name} · ${tg.posture} · ${tg.hostility}</option>`).join("")}
      </select>
    </div>
    <div class="cyber-dashboard">
      ${cyberBar(t("cyber.network", "Rede de espiões"), ops.spyNetwork)}
      ${cyberBar(t("cyber.security", "Segurança digital"), ops.security)}
      ${cyberBar(t("cyber.offense", "Ataque cyber"), ops.cyberOffense)}
      ${cyberBar(t("cyber.counter", "Contrainteligência"), ops.counterIntel)}
      ${cyberBar(t("cyber.exposure", "Risco de exposição"), ops.exposure)}
    </div>
    <div class="cyber-last">
      <small>${t("cyber.last", "Última operação")}</small>
      <strong>${last ? `${last.label} · ${last.targetName}` : t("cyber.noHistory", "Nenhuma operação secreta realizada.")}</strong>
      ${last ? `<span>${last.success ? t("cyber.success", "sucesso") : t("cyber.fail", "falha")} · ${last.effect}${last.detected ? " · detectada" : ""}</span>` : ""}
    </div>
    <div class="cyber-actions">
      <button data-cyber-action="network"><b>🕵️ ${t("cyber.buildNetwork", "Expandir rede")}</b><span>${t("cyber.cost","Custo")}: 55/10/8</span></button>
      <button data-cyber-action="counter"><b>🛡️ ${t("cyber.counterIntel", "Reforçar contrainteligência")}</b><span>${t("cyber.cost","Custo")}: 42/12/6</span></button>
      <button data-cyber-action="attack"><b>💻 ${t("cyber.cyberAttack", "Sabotar infraestrutura")}</b><span>${selected?.country?.name || ""}</span></button>
      <button data-cyber-action="steal"><b>🧬 ${t("cyber.stealTech", "Roubar tecnologia")}</b><span>${selected?.country?.name || ""}</span></button>
      <button data-cyber-action="psyops"><b>📡 ${t("cyber.psyops", "Operação psicológica")}</b><span>${selected?.country?.name || ""}</span></button>
      <button data-cyber-action="defend"><b>🔐 ${t("cyber.defend", "Defesa cyber")}</b><span>${t("cyber.effect","Efeito")}: +segurança</span></button>
    </div>
    <div class="cyber-history">
      <h3>${t("cyber.history", "Histórico secreto")}</h3>
      ${ops.history.length ? ops.history.slice(0,6).map(item => `<article class="${item.success ? "success" : "fail"}"><strong>${item.label}</strong><span>${item.targetName} · ${item.at} · ${item.success ? t("cyber.success","sucesso") : t("cyber.fail","falha")}</span><small>${item.effect}${item.detected ? " · detectada" : ""}</small></article>`).join("") : `<p class="muted">${t("cyber.noHistory", "Nenhuma operação secreta realizada.")}</p>`}
    </div>`;
  $("#cyberTargetSelect")?.addEventListener("change", event => {
    ops.selectedTargetId = event.target.value;
    saveGame();
    renderCyberOps();
  });
  $$("#cyberOpsPanel [data-cyber-action]").forEach(btn => btn.addEventListener("click", () => cyberOperation(btn.dataset.cyberAction)));
}


function makeGroundWar() {
  return {
    selectedTargetId: null,
    fronts: [],
    history: [],
    occupiedZones: 0
  };
}

function ensureGroundWar() {
  if (!state.game) return null;
  if (!state.game.groundWar) state.game.groundWar = makeGroundWar();
  const gw = state.game.groundWar;
  if (!Array.isArray(gw.fronts)) gw.fronts = [];
  if (!Array.isArray(gw.history)) gw.history = [];
  if (typeof gw.occupiedZones !== "number") gw.occupiedZones = 0;
  if (!gw.selectedTargetId || !getCountry(gw.selectedTargetId) || gw.selectedTargetId === state.game.countryId) {
    const threat = topAiThreats(1)[0];
    gw.selectedTargetId = threat?.id || state.countries.find(c => c.id !== state.game.countryId)?.id;
  }
  gw.fronts.forEach(front => {
    front.progress = clamp(front.progress ?? 0, 0, 100);
    front.supply = clamp(front.supply ?? 50, 0, 100);
    front.resistance = clamp(front.resistance ?? 40, 0, 100);
    front.casualties = Math.max(0, Math.round(front.casualties || 0));
    front.status = front.status || "advancing";
  });
  return gw;
}

function groundTargets() {
  ensureAiWorld();
  return topAiThreats(14).map(ai => ({ ...ai, country: getCountry(ai.id) })).filter(item => item.country);
}

function groundCost(kind) {
  const costs = {
    start: { finance: 120, industry: 45, energy: 35 },
    reinforce: { finance: 75, industry: 30, energy: 22 },
    pacify: { finance: 46, industry: 16, energy: 12 },
    withdraw: { finance: 18, industry: 0, energy: 8 }
  };
  return costs[kind] || costs.start;
}

function canPayGround(cost) {
  const g = state.game;
  return g.finance >= (cost.finance || 0) && g.industry >= (cost.industry || 0) && g.energy >= (cost.energy || 0);
}

function payGround(cost) {
  const g = state.game;
  g.finance -= cost.finance || 0;
  g.industry -= cost.industry || 0;
  g.energy -= cost.energy || 0;
}

function groundFrontStatus(front) {
  if (front.progress >= 100) return "occupied";
  if (front.supply < 22) return "collapsing";
  if (front.resistance > 68) return "contested";
  return "advancing";
}

function groundStatusLabel(status) {
  const labels = {
    occupied: t("ground.occupied", "ocupado"),
    advancing: t("ground.advancing", "avançando"),
    contested: t("ground.contested", "contestado"),
    collapsing: t("ground.collapsing", "em colapso")
  };
  return labels[status] || status;
}

function recordGroundHistory(kind, front, text) {
  const gw = ensureGroundWar();
  const item = {
    id: cryptoId(),
    kind,
    targetId: front.targetId,
    targetName: front.targetName,
    text,
    progress: front.progress,
    supply: front.supply,
    resistance: front.resistance,
    casualties: front.casualties,
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`
  };
  gw.history.unshift(item);
  gw.history = gw.history.slice(0, 12);
}

function groundOperation(kind) {
  const g = state.game;
  const gw = ensureGroundWar();
  const targetId = $("#groundTargetSelect")?.value || gw.selectedTargetId;
  const target = getCountry(targetId);
  if (!target) return;
  gw.selectedTargetId = targetId;
  const cost = groundCost(kind);
  if (!canPayGround(cost)) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Insufficient resources for ground operation." : currentLang === "es-ES" ? "Recursos insuficientes para operación terrestre." : "Recursos insuficientes para operação terrestre."));
    saveGame(); renderGame(); return;
  }
  let front = gw.fronts.find(f => f.targetId === targetId && f.status !== "withdrawn");

  if (kind === "start") {
    if (front) {
      g.events.push(eventText("warn", currentLang === "en-US" ? "There is already an active front against this target." : currentLang === "es-ES" ? "Ya existe un frente activo contra este objetivo." : "Já existe uma frente ativa contra este alvo."));
      renderGroundWar(); return;
    }
    payGround(cost);
    const ai = g.aiWorld?.find(a => a.id === targetId);
    const initialSupply = clamp(40 + Math.round(g.logistics / 2.5) + regionBases(g.selectedRegionId).length * 4 - Math.round((ai?.readiness || 50) / 6), 24, 92);
    const resistance = clamp(26 + Math.round((target.stability || 55) / 2) + Math.round((ai?.hostility || 40) / 5), 18, 90);
    front = {
      id: cryptoId(),
      targetId,
      targetName: target.name,
      coords: jitter(target.coords, .65),
      progress: randomInt(6, 15),
      supply: initialSupply,
      resistance,
      casualties: randomInt(60, 240),
      status: "advancing",
      months: 0
    };
    gw.fronts.push(front);
    g.worldTension = clamp(g.worldTension + 10, 0, 100);
    g.escalation = clamp(g.escalation + 5, 0, 100);
    g.readiness = clamp(g.readiness - 3, 0, 100);
    recordGroundHistory(kind, front, `Frente aberta contra ${target.name}.`);
    g.events.push(eventText("danger", `Frente terrestre aberta contra ${target.name}. Suprimento inicial ${front.supply}%.`));
    saveGame(); renderGame(); activatePanel("panelGround"); return;
  }

  if (!front) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Open an invasion front first." : currentLang === "es-ES" ? "Abre primero un frente de invasión." : "Abra uma frente de invasão primeiro."));
    renderGroundWar(); return;
  }

  payGround(cost);

  if (kind === "reinforce") {
    const attack = Math.round(g.landPower * .45 + g.logistics * .22 + g.readiness * .25 + regionalForceBonus() * .18 + Math.random() * 18);
    const enemy = Math.round(front.resistance * .45 + (target.military || 50) * .25 + Math.random() * 20);
    const gain = clamp(Math.round((attack - enemy) / 5) + randomInt(4, 11), 1, 24);
    const casualties = clamp(Math.round(enemy * 5 + Math.random() * 260 - front.supply * 2), 40, 950);
    front.progress = clamp(front.progress + gain, 0, 100);
    front.supply = clamp(front.supply - randomInt(3, 8) + Math.round(g.logistics / 50), 0, 100);
    front.resistance = clamp(front.resistance + randomInt(-3, 5) - (front.progress > 70 ? 2 : 0), 0, 100);
    front.casualties += casualties;
    front.months += 1;
    g.readiness = clamp(g.readiness - randomInt(1, 4), 0, 100);
    g.soldiers = Math.max(0, g.soldiers - casualties);
    applyOperationalWear("combined", attack >= enemy);
    if (front.progress >= 100 && front.status !== "occupied") {
      front.progress = 100;
      front.status = "occupied";
      gw.occupiedZones += 1;
      const ai = g.aiWorld?.find(a => a.id === targetId);
      if (ai) {
        ai.power = clamp(ai.power - randomInt(8, 18), 1, 230);
        ai.readiness = clamp(ai.readiness - randomInt(8, 16), 1, 100);
        ai.lastMove = "perdeu território";
      }
      g.industry += randomInt(20, 55);
      g.events.push(eventText("sistema", `${target.name}: zona estratégica ocupada. Resistência local ainda precisa ser controlada.`));
    } else {
      front.status = groundFrontStatus(front);
      g.events.push(eventText("sistema", `${target.name}: avanço terrestre +${gain}%. Baixas aproximadas: ${casualties}.`));
    }
    recordGroundHistory(kind, front, `Reforço na frente: +${gain}% de avanço, ${casualties} baixas.`);
  }

  if (kind === "pacify") {
    const reduction = randomInt(7, 15) + Math.round(g.intel / 50) + Math.round(g.stability / 60);
    front.resistance = clamp(front.resistance - reduction, 0, 100);
    front.supply = clamp(front.supply + randomInt(3, 9), 0, 100);
    g.stability = clamp(g.stability + (front.status === "occupied" ? 1 : 0), 0, 100);
    front.status = groundFrontStatus(front);
    recordGroundHistory(kind, front, `Resistência reduzida em ${reduction} pontos.`);
    g.events.push(eventText("sistema", `${target.name}: pacificação reduziu resistência para ${front.resistance}%.`));
  }

  if (kind === "withdraw") {
    front.status = "withdrawn";
    gw.fronts = gw.fronts.filter(f => f.id !== front.id);
    g.readiness = clamp(g.readiness - 2, 0, 100);
    g.worldTension = clamp(g.worldTension - 2, 0, 100);
    recordGroundHistory(kind, front, `Retirada da frente contra ${target.name}.`);
    g.events.push(eventText("warn", `${target.name}: frente retirada. Parte do avanço territorial foi perdida.`));
  }

  saveGame();
  renderGame();
  activatePanel("panelGround");
}

function progressGroundWar() {
  const gw = ensureGroundWar();
  if (!gw) return;
  const g = state.game;
  gw.fronts.forEach(front => {
    if (front.status === "withdrawn") return;
    front.months += 1;
    const attrition = clamp(Math.round((front.resistance + 20) * (front.status === "occupied" ? 2.2 : 3.8) - front.supply * 1.3 + Math.random() * 140), 10, 650);
    front.casualties += attrition;
    g.soldiers = Math.max(0, g.soldiers - attrition);
    front.supply = clamp(front.supply - randomInt(2, 7) + Math.round(g.logistics / 55), 0, 100);
    if (front.status === "occupied") {
      front.resistance = clamp(front.resistance + randomInt(-5, 4) - Math.round(g.intel / 70), 0, 100);
      if (front.resistance > 72 && Math.random() < .22) {
        front.progress = clamp(front.progress - randomInt(4, 10), 65, 100);
        front.status = "contested";
        g.events.push(eventText("warn", `${front.targetName}: resistência local iniciou levante contra a ocupação.`));
      }
    } else {
      if (front.supply < 25) front.progress = clamp(front.progress - randomInt(1, 5), 0, 100);
      if (front.resistance > 70) front.progress = clamp(front.progress - randomInt(0, 3), 0, 100);
    }
    front.status = groundFrontStatus(front);
    if (Math.random() < .12) g.events.push(eventText("warn", `${front.targetName}: atrito terrestre causou ${attrition} baixas.`));
  });
}

function groundBar(label, value) {
  return `<div class="ground-bar"><div><span>${label}</span><strong>${value}</strong></div><i><b style="width:${clamp(value,0,100)}%"></b></i></div>`;
}

function renderGroundWar() {
  const panel = $("#groundWarPanel");
  if (!panel || !state.game) return;
  const gw = ensureGroundWar();
  const targets = groundTargets();
  const active = gw.fronts.filter(f => f.status !== "withdrawn");
  panel.innerHTML = `
    <div class="ground-target-row">
      <label class="field-label">${t("ground.target", "Alvo terrestre")}</label>
      <select id="groundTargetSelect">
        ${targets.map(tg => `<option value="${tg.id}" ${tg.id === gw.selectedTargetId ? "selected" : ""}>${tg.country.flag || ""} ${tg.country.name} · ${tg.posture} · ${tg.hostility}</option>`).join("")}
      </select>
    </div>
    <div class="ground-actions">
      <button data-ground-action="start"><b>🪖 ${t("ground.start", "Iniciar invasão")}</b><span>120/45/35</span></button>
      <button data-ground-action="reinforce"><b>🚚 ${t("ground.reinforce", "Reforçar frente")}</b><span>75/30/22</span></button>
      <button data-ground-action="pacify"><b>🛡️ ${t("ground.pacify", "Pacificar território")}</b><span>46/16/12</span></button>
      <button data-ground-action="withdraw"><b>↩️ ${t("ground.withdraw", "Retirar frente")}</b><span>18/0/8</span></button>
    </div>
    <section class="ground-fronts">
      <h3>${t("ground.active", "Frentes ativas")}</h3>
      ${active.length ? active.map(front => `
        <article class="ground-front ${front.status}">
          <div class="ground-front-title"><strong>${front.targetName}</strong><span>${groundStatusLabel(front.status)}</span></div>
          ${groundBar(t("ground.progress", "Avanço"), front.progress)}
          ${groundBar(t("ground.supply", "Suprimento"), front.supply)}
          ${groundBar(t("ground.resistance", "Resistência"), front.resistance)}
          <div class="ground-kpis">
            <div><small>${t("ground.casualties", "Baixas")}</small><b>${front.casualties.toLocaleString(currentLang === "en-US" ? "en-US" : "pt-BR")}</b></div>
            <div><small>${t("ground.status", "Status")}</small><b>${groundStatusLabel(front.status)}</b></div>
          </div>
        </article>`).join("") : `<p class="muted">${t("ground.noFront", "Nenhuma frente terrestre ativa.")}</p>`}
    </section>
    <section class="ground-history">
      <h3>${t("ground.history", "Histórico terrestre")}</h3>
      ${gw.history.length ? gw.history.slice(0,6).map(item => `<article><strong>${item.targetName}</strong><span>${item.at} · ${item.text}</span><small>${t("ground.progress","Avanço")}: ${item.progress}% · ${t("ground.supply","Suprimento")}: ${item.supply}%</small></article>`).join("") : `<p class="muted">${t("ground.noFront", "Nenhuma frente terrestre ativa.")}</p>`}
    </section>`;
  $("#groundTargetSelect")?.addEventListener("change", event => {
    gw.selectedTargetId = event.target.value;
    saveGame();
    renderGroundWar();
  });
  $$("#groundWarPanel [data-ground-action]").forEach(btn => btn.addEventListener("click", () => groundOperation(btn.dataset.groundAction)));
}


function makeAirWar() {
  return {
    selectedTargetId: null,
    airSupremacy: 28,
    enemyAirPressure: 22,
    droneReadiness: 30,
    airDefense: 35,
    sorties: 0,
    history: []
  };
}

function ensureAirWar() {
  if (!state.game) return null;
  if (!state.game.airWar) state.game.airWar = makeAirWar();
  const aw = state.game.airWar;
  if (!Array.isArray(aw.history)) aw.history = [];
  aw.airSupremacy = clamp(aw.airSupremacy ?? 28, 0, 160);
  aw.enemyAirPressure = clamp(aw.enemyAirPressure ?? 22, 0, 160);
  aw.droneReadiness = clamp(aw.droneReadiness ?? 30, 0, 160);
  aw.airDefense = clamp(aw.airDefense ?? 35, 0, 160);
  aw.sorties = Math.max(0, Math.round(aw.sorties || 0));
  if (!aw.selectedTargetId || !getCountry(aw.selectedTargetId) || aw.selectedTargetId === state.game.countryId) {
    const threat = topAiThreats(1)[0];
    aw.selectedTargetId = threat?.id || state.countries.find(c => c.id !== state.game.countryId)?.id;
  }
  return aw;
}

function airTargets() {
  ensureAiWorld();
  return topAiThreats(14).map(ai => ({ ...ai, country: getCountry(ai.id) })).filter(item => item.country);
}

function airCost(kind) {
  const costs = {
    patrol: { finance: 36, industry: 6, energy: 24 },
    precision: { finance: 78, industry: 18, energy: 42 },
    drone: { finance: 42, industry: 12, energy: 18 },
    intercept: { finance: 30, industry: 8, energy: 20 },
    sead: { finance: 68, industry: 16, energy: 34 }
  };
  return costs[kind] || costs.patrol;
}

function canPayAir(cost) {
  const g = state.game;
  return g.finance >= (cost.finance || 0) && g.industry >= (cost.industry || 0) && g.energy >= (cost.energy || 0);
}

function payAir(cost) {
  const g = state.game;
  g.finance -= cost.finance || 0;
  g.industry -= cost.industry || 0;
  g.energy -= cost.energy || 0;
}

function airOperationLabel(kind) {
  const labels = {
    patrol: t("air.patrol", "Patrulha aérea"),
    precision: t("air.precision", "Bombardeio de precisão"),
    drone: t("air.drone", "Ataque de drones"),
    intercept: t("air.intercept", "Interceptar ameaça"),
    sead: t("air.sead", "Suprimir defesa AA")
  };
  return labels[kind] || kind;
}

function recordAirHistory(kind, success, target, effect, damage = 0) {
  const aw = ensureAirWar();
  const report = {
    id: cryptoId(),
    kind,
    label: airOperationLabel(kind),
    success,
    targetId: target?.id || aw.selectedTargetId,
    targetName: target?.name || "Alvo",
    effect,
    damage,
    supremacy: aw.airSupremacy,
    pressure: aw.enemyAirPressure,
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`,
    coords: target?.coords ? jitter(target.coords, .75) : null
  };
  aw.history.unshift(report);
  aw.history = aw.history.slice(0, 12);
}

function airWarOperation(kind) {
  const g = state.game;
  const aw = ensureAirWar();
  const targetId = $("#airTargetSelect")?.value || aw.selectedTargetId;
  const target = getCountry(targetId);
  if (!target) return;
  const ai = g.aiWorld?.find(a => a.id === targetId);
  aw.selectedTargetId = targetId;
  const cost = airCost(kind);
  if (!canPayAir(cost)) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Insufficient resources for air operation." : currentLang === "es-ES" ? "Recursos insuficientes para operación aérea." : "Recursos insuficientes para operação aérea."));
    saveGame(); renderGame(); return;
  }
  payAir(cost);

  if (kind === "patrol") {
    const gain = randomInt(7, 14) + Math.round(g.airPower / 35) + Math.round(regionalRadarCover(g.selectedRegionId) / 30);
    aw.airSupremacy = clamp(aw.airSupremacy + gain, 0, 160);
    aw.enemyAirPressure = clamp(aw.enemyAirPressure - randomInt(3, 8), 0, 160);
    aw.sorties += 1;
    g.readiness = clamp(g.readiness + 1, 0, 100);
    recordAirHistory(kind, true, target, currentLang === "en-US" ? "Patrol improved air control." : currentLang === "es-ES" ? "La patrulla mejoró el control aéreo." : "Patrulha melhorou controle aéreo.", gain);
    g.events.push(eventText("sistema", currentLang === "en-US" ? "Air patrol increased air superiority." : currentLang === "es-ES" ? "Patrulla aérea aumentó superioridad aérea." : "Patrulha aérea aumentou superioridade aérea."));
    saveGame(); renderGame(); activatePanel("panelAir"); return;
  }

  if (kind === "intercept") {
    const reduction = randomInt(8, 16) + Math.round(g.airPower / 45) + Math.round(aw.airDefense / 35);
    aw.enemyAirPressure = clamp(aw.enemyAirPressure - reduction, 0, 160);
    aw.airDefense = clamp(aw.airDefense + randomInt(3, 7), 0, 160);
    aw.sorties += 1;
    recordAirHistory(kind, true, target, currentLang === "en-US" ? "Enemy air threat intercepted." : currentLang === "es-ES" ? "Amenaza aérea enemiga interceptada." : "Ameaça aérea inimiga interceptada.", reduction);
    g.events.push(eventText("sistema", currentLang === "en-US" ? "Interceptors reduced enemy air pressure." : currentLang === "es-ES" ? "Interceptores redujeron presión aérea enemiga." : "Interceptadores reduziram pressão aérea inimiga."));
    saveGame(); renderGame(); activatePanel("panelAir"); return;
  }

  const defense = (target.airframes || 50) / 8 + (target.cyber || 40) / 3 + (ai?.readiness || 45) / 2 + aw.enemyAirPressure / 2 + Math.random() * 40;
  const attackBase = kind === "drone" ? (g.cyber + g.intel + aw.droneReadiness) / 1.7 : g.airPower + g.missilePower / 2 + aw.airSupremacy / 2 + g.readiness / 3;
  const attack = attackBase + Math.random() * 55;
  const success = attack >= defense;
  let damage = 0;
  let effect = "";

  if (success && ai) {
    if (kind === "precision") {
      damage = randomInt(8, 18) + Math.round(aw.airSupremacy / 22);
      ai.power = clamp(ai.power - damage, 1, 230);
      ai.economy = clamp(ai.economy - randomInt(3, 9), 1, 230);
      ai.readiness = clamp(ai.readiness - randomInt(4, 10), 1, 100);
      effect = currentLang === "en-US" ? "Precision strike damaged enemy infrastructure." : currentLang === "es-ES" ? "Bombardeo dañó infraestructura enemiga." : "Bombardeio danificou infraestrutura inimiga.";
      g.worldTension = clamp(g.worldTension + 5, 0, 100);
    }
    if (kind === "drone") {
      damage = randomInt(4, 11) + Math.round(g.intel / 40);
      ai.readiness = clamp(ai.readiness - damage, 1, 100);
      ai.hostility = clamp(ai.hostility + randomInt(1, 4), 0, 100);
      aw.droneReadiness = clamp(aw.droneReadiness + randomInt(2, 6), 0, 160);
      effect = currentLang === "en-US" ? "Drone strike disrupted enemy readiness." : currentLang === "es-ES" ? "Ataque de drones desorganizó preparación enemiga." : "Ataque de drones desorganizou prontidão inimiga.";
      g.worldTension = clamp(g.worldTension + 3, 0, 100);
    }
    if (kind === "sead") {
      damage = randomInt(5, 14) + Math.round(aw.airSupremacy / 25);
      ai.readiness = clamp(ai.readiness - randomInt(3, 8), 1, 100);
      aw.airSupremacy = clamp(aw.airSupremacy + randomInt(4, 9), 0, 160);
      const ground = ensureGroundWar();
      ground.fronts.filter(f => f.targetId === target.id).forEach(f => {
        f.resistance = clamp(f.resistance - randomInt(4, 10), 0, 100);
        f.supply = clamp(f.supply + randomInt(1, 5), 0, 100);
      });
      effect = currentLang === "en-US" ? "Air defenses suppressed." : currentLang === "es-ES" ? "Defensas aéreas suprimidas." : "Defesas aéreas suprimidas.";
      g.worldTension = clamp(g.worldTension + 4, 0, 100);
    }
    aw.airSupremacy = clamp(aw.airSupremacy + randomInt(1, 5), 0, 160);
    aw.enemyAirPressure = clamp(aw.enemyAirPressure - randomInt(1, 5), 0, 160);
    g.intel = clamp(g.intel + 1, 0, 160);
  } else {
    damage = randomInt(1, 5);
    effect = currentLang === "en-US" ? "Air operation failed under enemy defense." : currentLang === "es-ES" ? "Operación aérea falló bajo defensa enemiga." : "Operação aérea falhou sob defesa inimiga.";
    aw.enemyAirPressure = clamp(aw.enemyAirPressure + randomInt(2, 7), 0, 160);
    g.readiness = clamp(g.readiness - randomInt(1, 4), 0, 100);
  }

  aw.sorties += 1;
  applyOperationalWear(kind === "drone" ? "recon" : "airstrike", success);
  recordAirHistory(kind, success, target, effect, damage);
  g.events.push(eventText(success ? "sistema" : "warn", `${target.name}: ${effect}`));
  saveGame();
  renderGame();
  activatePanel("panelAir");
}

function progressAirWar() {
  const aw = ensureAirWar();
  if (!aw) return;
  const g = state.game;
  const strongest = topAiThreats(1)[0];
  const pressureGain = Math.max(0, Math.round((g.worldTension - 42) / 28)) + (strongest?.hostility > 72 ? 2 : 0);
  aw.enemyAirPressure = clamp(aw.enemyAirPressure + pressureGain - Math.round(aw.airDefense / 80) - Math.round(aw.airSupremacy / 95), 0, 160);
  aw.airSupremacy = clamp(aw.airSupremacy - (aw.enemyAirPressure > 75 ? 2 : 1) + Math.round(g.airPower / 180), 0, 160);
  if (aw.enemyAirPressure > 80 && Math.random() < .22) {
    const base = g.bases.find(b => b.condition > 20);
    if (base) {
      const loss = randomInt(4, 12);
      base.condition = clamp(base.condition - loss, 0, 100);
      g.events.push(eventText("danger", currentLang === "en-US" ? `Enemy air pressure damaged ${base.name}.` : currentLang === "es-ES" ? `Presión aérea enemiga dañó ${base.name}.` : `Pressão aérea inimiga danificou ${base.name}.`));
    }
  }
}

function airBar(label, value) {
  return `<div class="air-bar"><div><span>${label}</span><strong>${value}</strong></div><i><b style="width:${clamp(value,0,100)}%"></b></i></div>`;
}

function renderAirWar() {
  const panel = $("#airWarPanel");
  if (!panel || !state.game) return;
  const aw = ensureAirWar();
  const targets = airTargets();
  const last = aw.history[0];
  panel.innerHTML = `
    <div class="air-target-row">
      <label class="field-label">${t("air.target", "Alvo aéreo")}</label>
      <select id="airTargetSelect">
        ${targets.map(tg => `<option value="${tg.id}" ${tg.id === aw.selectedTargetId ? "selected" : ""}>${tg.country.flag || ""} ${tg.country.name} · ${tg.posture} · ${tg.hostility}</option>`).join("")}
      </select>
    </div>
    <div class="air-dashboard">
      ${airBar(t("air.supremacy", "Superioridade aérea"), aw.airSupremacy)}
      ${airBar(t("air.enemyPressure", "Pressão aérea inimiga"), aw.enemyAirPressure)}
      ${airBar(t("air.droneReadiness", "Prontidão de drones"), aw.droneReadiness)}
      ${airBar(t("air.airDefense", "Defesa aérea"), aw.airDefense)}
    </div>
    <div class="air-last">
      <small>${t("air.sorties", "Sortidas")}: ${aw.sorties}</small>
      <strong>${last ? `${last.label} · ${last.targetName}` : t("air.noHistory", "Nenhuma operação aérea realizada.")}</strong>
      ${last ? `<span>${last.success ? t("air.success","sucesso") : t("air.fail","falha")} · ${last.effect}</span>` : ""}
    </div>
    <div class="air-actions">
      <button data-air-action="patrol"><b>🛩️ ${t("air.patrol", "Patrulha aérea")}</b><span>${t("air.cost","Custo")}: 36/6/24</span></button>
      <button data-air-action="precision"><b>🎯 ${t("air.precision", "Bombardeio de precisão")}</b><span>${t("air.cost","Custo")}: 78/18/42</span></button>
      <button data-air-action="drone"><b>🛸 ${t("air.drone", "Ataque de drones")}</b><span>${t("air.cost","Custo")}: 42/12/18</span></button>
      <button data-air-action="intercept"><b>🛡️ ${t("air.intercept", "Interceptar ameaça")}</b><span>${t("air.cost","Custo")}: 30/8/20</span></button>
      <button data-air-action="sead"><b>📡 ${t("air.sead", "Suprimir defesa AA")}</b><span>${t("air.cost","Custo")}: 68/16/34</span></button>
    </div>
    <section class="air-history">
      <h3>${t("air.history", "Histórico aéreo")}</h3>
      ${aw.history.length ? aw.history.slice(0,7).map(item => `<article class="${item.success ? "success" : "fail"}"><strong>${item.label}</strong><span>${item.targetName} · ${item.at} · ${item.success ? t("air.success","sucesso") : t("air.fail","falha")}</span><small>${item.effect}</small></article>`).join("") : `<p class="muted">${t("air.noHistory", "Nenhuma operação aérea realizada.")}</p>`}
    </section>`;
  $("#airTargetSelect")?.addEventListener("change", event => {
    aw.selectedTargetId = event.target.value;
    saveGame();
    renderAirWar();
  });
  $$("#airWarPanel [data-air-action]").forEach(btn => btn.addEventListener("click", () => airWarOperation(btn.dataset.airAction)));
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
    battleReports: [],
    logisticsBudget: 100,
    monthlyLosses: 0,
    globalWar: makeGlobalWar(country),
    aiWorld: makeAiWorld(country),
    warEconomy: makeWarEconomy(country),
    tutorial: makeTutorialState(),
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
  ensureTutorial();
  evaluateTutorialMissions();
  ensureWarEconomy();
  ensureCyberOps();
  ensureGroundWar();
  ensureAirWar();
  renderSummary();
  renderCommanderGuide();
  renderRegionSelect();
  renderRegionBoard();
  renderBuildList();
  renderProduction();
  renderUnitList();
  renderArsenal();
  renderMaintenance();
  renderWarEconomy();
  renderCyberOps();
  renderGroundWar();
  renderAirWar();
  renderGlobalWar();
  renderAiWorld();
  renderTargetSelect();
  renderBattleReport();
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
    <div class="player-focus"><span>${currentLang === "en-US" ? "Recommended next tap" : currentLang === "es-ES" ? "Próximo toque recomendado" : "Próximo toque recomendado"}</span><strong>${commanderRecommendation().title}</strong></div>
    <div class="metrics compact-metrics">
      <div class="metric"><small>${currentLang === "en-US" ? "Funds" : currentLang === "es-ES" ? "Fondos" : "Finanças"}</small><strong>${g.finance}</strong></div>
      <div class="metric"><small>${currentLang === "en-US" ? "Industry" : currentLang === "es-ES" ? "Industria" : "Indústria"}</small><strong>${g.industry}</strong></div>
      <div class="metric"><small>${currentLang === "en-US" ? "Energy" : currentLang === "es-ES" ? "Energía" : "Energia"}</small><strong>${g.energy}</strong></div>
      <div class="metric"><small>${currentLang === "en-US" ? "Power" : currentLang === "es-ES" ? "Poder" : "Poder"}</small><strong>${powerIndex()}</strong></div>
      <div class="metric"><small>${currentLang === "en-US" ? "Force" : currentLang === "es-ES" ? "Fuerza" : "Força"}</small><strong>${cond}%</strong></div>
      <div class="metric"><small>DEFCON</small><strong>${g.globalWar?.defcon ?? 5}</strong></div>
      <div class="metric"><small>${t("economy.inflation", "Inflação")}</small><strong>${ensureWarEconomy().inflation}%</strong></div>
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
  if (!g) return { title: t("rec.start", "Iniciar campanha"), text: t("rec.startText", "Escolha um país para começar."), action: "new", panel: "screenNation" };
  const r = getSelectedRegion();
  const damaged = g.bases.find(b => b.condition < 60);
  const emptyRegion = state.game.regions.find(reg => regionBases(reg.id).length + g.construction.filter(j => j.regionId === reg.id).length < reg.slots);
  const hasBase = g.bases.length > 0;
  const hasProd = g.production.length > 0;
  const canProduce = state.units.some(u => hasOperationalBase(u.requires, r.id) && hasBaseAtLevel(u.requires, r.id, u.requiresLevel || 1) && g.finance >= u.cost);
  if (damaged) return { title: t("rec.repair", "Reparar base danificada"), text: `${getBuilding(damaged.type).name} ${currentLang === "en-US" ? "is at" : currentLang === "es-ES" ? "está con" : "está com"} ${damaged.condition}%.`, action: "repair", panel: "panelBuild" };
  if (!hasBase) return { title: t("rec.firstBase", "Construir primeira base"), text: t("rec.firstBaseText", "Comece por Base terrestre na capital."), action: "build", panel: "panelBuild" };
  if (!canProduce && regionBases(r.id).length) return { title: t("rec.infrastructure", "Evoluir ou construir estrutura"), text: t("rec.infrastructureText", "Suba o nível de uma base ou construa a estrutura exigida pelo arsenal."), action: "build", panel: "panelBuild" };
  if (canProduce && !hasProd) return { title: t("rec.produce", "Produzir unidade"), text: t("rec.produceText", "Há unidade disponível na região ativa."), action: "produce", panel: "panelForces" };
  if (hasProd) return { title: t("rec.month", "Avançar mês"), text: t("rec.monthText", "Existe produção/obra em andamento."), action: "month", panel: "panelGuide" };
  const econ = ensureWarEconomy();
  if ((g.finance < 120 || g.industry < 100 || econ.inflation > 35 || econ.civilianMorale < 35) && g.month > 0) return { title: t("rec.economy", "Ajustar economia de guerra"), text: t("rec.economyText", "Recursos baixos ou inflação alta."), action: "economy", panel: "panelEconomy" };
  const cyberOps = ensureCyberOps();
  const mainThreat = topAiThreats(1)[0];
  if (mainThreat && mainThreat.hostility > 70 && cyberOps.spyNetwork < 45 && g.month > 1) return { title: t("rec.cyber", "Executar inteligência"), text: t("rec.cyberText", "Rivais hostis estão crescendo."), action: "cyber", panel: "panelCyber" };
  const air = ensureAirWar();
  if (g.units.length && g.month > 2 && air.airSupremacy < 55) return { title: t("rec.air", "Buscar superioridade aérea"), text: t("rec.airText", "Domine o céu antes de escalar ataques maiores."), action: "air", panel: "panelAir" };
  const ground = ensureGroundWar();
  if (g.units.length && ground.fronts.filter(f => f.status !== "withdrawn").length === 0 && g.month > 2) return { title: t("rec.ground", "Abrir frente terrestre"), text: t("rec.groundText", "Você já tem tropas."), action: "ground", panel: "panelGround" };
  if ((g.globalWar?.nuclearRisk || 0) > 55) return { title: t("rec.world", "Reduzir crise mundial"), text: t("rec.worldText", "O risco nuclear está alto."), action: "world", panel: "panelGlobal" };
  const hostile = topAiThreats(1)[0];
  if (hostile && hostile.hostility > 75) return { title: currentLang === "en-US" ? "Monitor dangerous rival" : currentLang === "es-ES" ? "Monitorear rival peligroso" : "Monitorar rival perigoso", text: `${getCountry(hostile.id)?.name || "Rival"} ${currentLang === "en-US" ? "is in" : currentLang === "es-ES" ? "está en postura" : "está em postura"} ${hostile.posture}.`, action: "ai", panel: "panelAiWorld" };
  if (emptyRegion) return { title: t("rec.expand", "Expandir para outra região"), text: `${emptyRegion.kind} ${currentLang === "en-US" ? "still has free slots." : currentLang === "es-ES" ? "todavía tiene espacios libres." : "ainda tem slots livres."}`, action: "build", panel: "panelBuild" };
  return { title: t("rec.attack", "Preparar ataque"), text: t("rec.attackText", "Seu país já tem base e produção."), action: "ops", panel: "panelOps" };
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
  const mainActionLabel = rec.action === "repair" ? t("guide.repair", "Reparar") : rec.action === "produce" ? t("guide.produce", "Produzir") : rec.action === "month" ? t("nextMonth", "Avançar mês") : rec.action === "economy" ? t("guide.economy", "Economia") : rec.action === "cyber" ? t("guide.cyber", "Cyber") : rec.action === "air" ? t("guide.air", "Aérea") : rec.action === "ground" ? t("guide.ground", "Frente") : rec.action === "world" ? t("guide.world", "Mundo") : rec.action === "ai" ? t("guide.ai", "IA") : rec.action === "ops" ? t("guide.attack", "Atacar") : t("guide.build", "Construir");
  box.innerHTML = `
    <article class="mobile-hq-card">
      <div class="hq-flag-block">${flag}</div>
      <div class="hq-main">
        <small>${t("guide.youCommand", "Você comanda")}</small>
        <strong>${c.name}</strong>
        <span>${c.capital} · ${c.region}</span>
        <em>${c.doctrine}</em>
      </div>
    </article>

    <article class="guide-hero mobile-objective">
      <div><small>${t("guide.nextDecision", "Próxima decisão recomendada")}</small><strong>${rec.title}</strong><span>${rec.text}</span></div>
      <button id="primaryRecommendedBtn">${mainActionLabel}</button>
    </article>

    <div class="mission-flow">
      <article class="${g.bases.length ? 'done' : 'active'}"><b>1</b><span>${t("mission.base", "Base")}</span><small>${g.bases.length ? t("mission.doneShort", "feito") : t("mission.buildShort", "construir")}</small></article>
      <article class="${g.units.length ? 'done' : (g.bases.length ? 'active' : 'locked')}"><b>2</b><span>${t("mission.unit", "Unidade")}</span><small>${g.units.length ? t("mission.operational", "operacional") : t("mission.produceShort", "produzir")}</small></article>
      <article class="${powerIndex() > 70 ? 'done' : (g.units.length ? 'active' : 'locked')}"><b>3</b><span>${t("mission.power", "Poder")}</span><small>${powerIndex()}</small></article>
      <article class="${(g.globalWar?.warScore || 0) > 25 ? 'done' : 'active'}"><b>4</b><span>${t("mission.war", "Guerra")}</span><small>DEFCON ${g.globalWar?.defcon ?? 5}</small></article>
    </div>

    <div class="quick-kpis">
      <div><small>${t("guide.currentRegion", "Região ativa")}</small><strong>${r.kind}</strong></div>
      <div><small>${t("guide.basesHere", "Bases aqui")}</small><strong>${bases}/${r.slots}</strong></div>
      <div><small>${t("guide.queue", "Fila")}</small><strong>${queue}</strong></div>
      <div><small>${currentLang === "en-US" ? "Force" : currentLang === "es-ES" ? "Fuerza" : "Força"}</small><strong>${cond}%</strong></div>
      <div><small>${t("guide.tension", "Tensão")}</small><strong>${g.worldTension}</strong></div>
      <div><small>${t("guide.countries", "Países")}</small><strong>${state.countries.length}</strong></div>
    </div>

    ${renderTutorialMissions()}

    ${renderBattleReportMini()}

    <div class="mobile-command-grid">
      <button id="quickBuildBtn"><b>🏗️ ${t("guide.build", "Construir")}</b><span>${t("guide.buildSub", "base recomendada")}</span></button>
      <button id="quickProduceBtn"><b>🪖 ${t("guide.produce", "Produzir")}</b><span>${t("guide.produceSub", "melhor unidade")}</span></button>
      <button id="quickRepairBtn"><b>🛠️ ${t("guide.repair", "Reparar")}</b><span>${t("guide.repairSub", "base crítica")}</span></button>
      <button id="quickOpsBtn"><b>⚔️ ${t("guide.attack", "Atacar")}</b><span>${t("guide.attackSub", "abrir operações")}</span></button>
      <button id="quickAirBtn"><b>✈️ ${t("guide.air", "Aérea")}</b><span>${t("guide.airSub", "dominar o céu")}</span></button>
      <button id="quickGroundBtn"><b>🗺️ ${t("guide.ground", "Frente")}</b><span>${t("guide.groundSub", "ocupar território")}</span></button>
      <button id="quickCyberBtn"><b>🕵️ ${t("guide.cyber", "Cyber")}</b><span>${t("guide.cyberSub", "espionar rivais")}</span></button>
      <button id="quickEconomyBtn"><b>🏭 ${t("guide.economy", "Economia")}</b><span>${t("guide.economySub", "mobilização e inflação")}</span></button>
      <button id="quickWorldBtn"><b>🌐 ${t("guide.world", "Mundo")}</b><span>${t("guide.worldSub", "DEFCON e crise")}</span></button>
      <button id="quickAiBtn"><b>🛰️ ${t("guide.ai", "IA")}</b><span>${t("guide.aiSub", "rivais ativos")}</span></button>
    </div>`;
  $("#primaryRecommendedBtn")?.addEventListener("click", () => runRecommendedAction(rec));
  $("#quickBuildBtn")?.addEventListener("click", quickBuildRecommended);
  $("#quickProduceBtn")?.addEventListener("click", quickProduceRecommended);
  $("#quickRepairBtn")?.addEventListener("click", quickRepairPriority);
  $("#quickOpsBtn")?.addEventListener("click", () => activatePanel("panelOps"));
  $("#quickAirBtn")?.addEventListener("click", () => activatePanel("panelAir"));
  $("#quickGroundBtn")?.addEventListener("click", () => activatePanel("panelGround"));
  $("#quickCyberBtn")?.addEventListener("click", () => activatePanel("panelCyber"));
  $("#quickEconomyBtn")?.addEventListener("click", () => activatePanel("panelEconomy"));
  $("#quickWorldBtn")?.addEventListener("click", () => activatePanel("panelGlobal"));
  $("#quickAiBtn")?.addEventListener("click", () => activatePanel("panelAiWorld"));
  bindTutorialMissionButtons();
  $("#openLatestBattleBtn")?.addEventListener("click", () => activatePanel("panelBattle"));
}

function runRecommendedAction(rec) {
  if (!rec) rec = commanderRecommendation();
  if (rec.action === "repair") return quickRepairPriority();
  if (rec.action === "produce") return quickProduceRecommended();
  if (rec.action === "month") return advanceMonth();
  if (rec.action === "economy") return activatePanel("panelEconomy");
  if (rec.action === "cyber") return activatePanel("panelCyber");
  if (rec.action === "air") return activatePanel("panelAir");
  if (rec.action === "ground") return activatePanel("panelGround");
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
    <div><small>${t("guide.tension", "Tensão")}</small><strong>${state.game.worldTension}</strong></div>
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
  state.layers.fronts = L.layerGroup().addTo(state.map);
  state.layers.airOps = L.layerGroup().addTo(state.map);
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
  ensureGroundWar()?.fronts?.filter(f => f.status !== "withdrawn").forEach(front => {
    const target = getCountry(front.targetId);
    const icon = L.divIcon({ className: "", html: `<div class="marker-front">⚔</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
    L.marker(front.coords || target?.coords || player.coords, { icon }).addTo(state.layers.fronts).bindPopup(`<strong>${target?.flag || ""} ${front.targetName}</strong><br>${groundStatusLabel(front.status)}<br>${t("ground.progress","Avanço")}: ${front.progress}% · ${t("ground.supply","Suprimento")}: ${front.supply}%`);
    if (target?.coords) L.polyline([player.coords, target.coords], { color: "#ffdf6b", weight: 2, opacity: .55, dashArray: "7 7" }).addTo(state.layers.fronts);
  });
  ensureAirWar()?.history?.slice(0,5).filter(item => item.coords).forEach(item => {
    const target = getCountry(item.targetId);
    const icon = L.divIcon({ className: "", html: `<div class="marker-air">✈</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
    L.marker(item.coords, { icon }).addTo(state.layers.airOps).bindPopup(`<strong>${target?.flag || ""} ${item.targetName}</strong><br>${item.label}<br>${item.success ? t("air.success","sucesso") : t("air.fail","falha")}`);
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
  ensureTutorial();
  if (kind === "recon" && g.tutorial) g.tutorial.reconDone = true;
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
  const label = battleOperationLabel(kind);
  if (success) {
    g.readiness = clamp(g.readiness - Math.round(op.tension / 3), 0, 100);
    g.intel = clamp(g.intel + (kind === "recon" ? 3 : 1), 0, 120);
    g.events.push(eventText(kind === "combined" ? "danger" : "sistema", `${label} contra ${target.name} teve sucesso tático. A tensão mundial subiu.`));
  } else {
    g.readiness = clamp(g.readiness - Math.round(op.tension / 2), 0, 100);
    g.stability = clamp(g.stability - 2, 0, 100);
    g.events.push(eventText("danger", `${label} contra ${target.name} falhou. Perdas políticas e alerta inimigo aumentaram.`));
  }
  const report = makeBattleReport(kind, target, attack, defense, success, op);
  if (success && kind === "combined") {
    const ground = ensureGroundWar();
    if (ground) ground.selectedTargetId = target.id;
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
  activatePanel("panelBattle");
}

function advanceMonth() {
  const g = state.game;
  const c = getPlayerCountry();
  g.month += 1;
  if (g.month % 12 === 0) g.year += 1;
  const upkeep = monthlyUpkeep();
  const economyMods = progressWarEconomy(upkeep);
  g.finance = Math.max(0, g.finance + Math.round(45 + c.economy * 1.2 + g.stability / 3 + economyMods.finance) - upkeep.finance);
  g.industry = Math.max(0, g.industry + Math.round(24 + c.industry * .65 - g.bases.length + economyMods.industry) - upkeep.industry);
  g.energy = Math.max(0, g.energy + Math.round(22 + c.oil * .55 - g.bases.length * 2 + economyMods.energy) - upkeep.energy);
  g.food += Math.round(15 + c.food * .4 + (ensureWarEconomy().rationing ? 12 : 0));
  applyMonthlyWear(upkeep);
  g.readiness = clamp(g.readiness + Math.round(g.logistics / 24) - Math.round(g.worldTension / 36) - (forceCondition() < 45 ? 3 : 0), 0, 100);
  g.worldTension = clamp(g.worldTension + randomInt(-3, 5), 0, 100);
  progressConstruction();
  progressProduction();
  progressCyberOps();
  progressGroundWar();
  progressAirWar();
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
