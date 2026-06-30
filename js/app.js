const VERSION = "3.3.0";
const PHASE = "Fase 33 — pesquisa tecnologia e modernização militar";
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
  mapUserMoved: false,
  mapAutoCentered: false,
  layers: { countries: null, regions: null, bases: null, threats: null, fronts: null, airOps: null, navalOps: null, missiles: null, logistics: null, tactical: null, battleEffects: null, weather: null, intel: null, tech: null },
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
  let topTray = $("#nationTopConfirm");
  if (!topTray) {
    topTray = document.createElement("div");
    topTray.id = "nationTopConfirm";
    topTray.className = "nation-top-confirm";
    const grid = $("#nationGrid");
    grid?.parentNode?.insertBefore(topTray, grid);
  }
  const selected = state.selectedCountry || list[0] || state.countries[0];
  if (!selected) {
    tray.innerHTML = "";
    topTray.innerHTML = "";
    return;
  }
  tray.setAttribute("data-country-id", selected.id);
  topTray.setAttribute("data-country-id", selected.id);

  const selectedMarkup = `
    <div class="confirm-country">
      <div class="confirm-flag-wrap">${flagHtml(selected, "confirm-flag-img")}</div>
      <div class="confirm-country-meta">
        <small>${t("nation.selectedHint", "País selecionado")}</small>
        <strong>${selected.name}</strong>
        <span>${selected.capital} · ${selected.region}</span>
      </div>
    </div>
    <button class="confirm-nation-btn" type="button" data-confirm-nation="${selected.id}">✅ ${t("nation.confirm", "Confirmar país")}</button>`;

  tray.innerHTML = selectedMarkup;
  topTray.innerHTML = selectedMarkup;

  $$("[data-confirm-nation]").forEach(btn => {
    btn.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      startGame(btn.dataset.confirmNation || selected.id);
    });
  });
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


function ensureBattleScenes() {
  if (!state.game) return [];
  if (!Array.isArray(state.game.battleScenes)) state.game.battleScenes = [];
  return state.game.battleScenes;
}

function sceneIcon(kind) {
  if (kind === "airstrike" || kind === "precision" || kind === "drone" || kind === "sead" || kind === "carrier") return "✈️";
  if (kind === "naval" || kind === "blockade" || kind === "submarine") return "🚢";
  if (kind === "missile" || kind === "deterrence") return "🚀";
  if (kind === "ground" || kind === "combined" || kind === "reinforce") return "🪖";
  if (kind === "recon") return "🛰️";
  return "⚔️";
}

function recordBattleScene(kind, target, success, intensity = 50, label = "", details = "") {
  if (!state.game || !target?.coords) return null;
  const player = getPlayerCountry();
  const scenes = ensureBattleScenes();
  const targetCoords = jitter(target.coords, .75);
  const fromCoords = player?.coords || getSelectedRegion()?.coords || target.coords;
  const scene = {
    id: cryptoId(),
    kind,
    icon: sceneIcon(kind),
    label: label || battleOperationLabel(kind) || kind,
    details: details || "",
    success: !!success,
    targetId: target.id,
    targetName: target.name,
    targetFlag: target.flag,
    fromCoords,
    coords: targetCoords,
    intensity: clamp(intensity, 8, 100),
    smoke: clamp(intensity + randomInt(6, 28), 18, 100),
    fire: clamp(intensity + (success ? 20 : 8), 10, 100),
    month: state.game.month,
    year: state.game.year,
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`
  };
  scenes.unshift(scene);
  state.game.battleScenes = scenes.slice(0, 14);
  return scene;
}

function latestBattleScene() {
  const scenes = ensureBattleScenes();
  if (scenes.length) return scenes[0];
  const report = latestBattleReport();
  if (!report) return null;
  return {
    id: "report-preview",
    kind: "combined",
    icon: report.success ? "⚔️" : "⚠️",
    label: report.operation,
    details: report.success ? t("battle.success", "Sucesso tático") : t("battle.failure", "Falha operacional"),
    success: report.success,
    targetName: report.targetName,
    targetFlag: report.targetFlag,
    intensity: clamp(Math.round((report.attack + report.defense) / 2), 20, 100),
    smoke: clamp(report.enemyDamage + report.ownLosses, 15, 100),
    fire: clamp(report.enemyDamage, 10, 100),
    at: `${monthNames[report.month % 12]}/${report.year}`
  };
}

function renderBattlefieldCinematic() {
  const scene = latestBattleScene();
  const scenes = ensureBattleScenes().slice(0, 6);
  if (!scene) return `<div class="battlefield-empty">${t("battlefield.noScene", "Nenhuma cena de batalha registrada ainda.")}</div>`;
  const smokeDots = Array.from({length: 7}, (_, i) => `<i class="smoke s${i+1}"></i>`).join("");
  const fireDots = Array.from({length: 5}, (_, i) => `<b class="blast b${i+1}"></b>`).join("");
  return `
    <section class="battlefield-cinematic ${scene.success ? "success" : "failure"}">
      <div class="battlefield-stage">
        <div class="battlefield-route-line"></div>
        <div class="battlefield-side our"><span>MWD</span><strong>${scene.icon}</strong></div>
        <div class="battlefield-impact">
          ${smokeDots}${fireDots}
          <strong>${scene.targetFlag || "🏳️"}</strong>
        </div>
        <div class="battlefield-side enemy"><span>${scene.targetName || "Alvo"}</span><strong>${scene.success ? "🔥" : "🛡️"}</strong></div>
      </div>
      <div class="battlefield-info">
        <div><small>${t("battlefield.live", "Confronto visual")}</small><strong>${scene.label}</strong><span>${scene.targetFlag || "🏳️"} ${scene.targetName || ""} · ${scene.at || ""}</span></div>
        <div class="battlefield-bars">
          <p><span>${t("battlefield.intensity", "Intensidade")}</span><b>${scene.intensity}</b><i style="width:${scene.intensity}%"></i></p>
          <p><span>${t("battlefield.smoke", "fumaça")}</span><b>${scene.smoke}</b><i style="width:${scene.smoke}%"></i></p>
          <p><span>${t("battlefield.fire", "impacto")}</span><b>${scene.fire}</b><i style="width:${scene.fire}%"></i></p>
        </div>
        <em>${t("battlefield.mapNote", "Acompanhe explosões, fumaça e rotas no mapa real.")}</em>
      </div>
      <div class="battlefield-timeline">
        ${scenes.length ? scenes.map(item => `<article class="${item.success ? "success" : "failure"}"><b>${item.icon}</b><div><strong>${item.label}</strong><span>${item.targetFlag || ""} ${item.targetName} · ${item.at}</span></div><small>${item.intensity}</small></article>`).join("") : ""}
      </div>
    </section>`;
}

function renderBattlefieldMapOverlays(player) {
  const scenes = ensureBattleScenes().slice(0, 8);
  if (!state.map || !state.layers.battleEffects || !window.L || !scenes.length) return;
  scenes.forEach((scene, index) => {
    if (!scene.coords) return;
    const target = getCountry(scene.targetId);
    const opacity = Math.max(.25, 1 - index * .09);
    L.circle(scene.coords, {
      radius: 65000 + scene.intensity * 1200,
      color: scene.success ? "#ff784f" : "#ffd166",
      fillColor: scene.success ? "#ff3f2f" : "#ffd166",
      fillOpacity: .10 * opacity,
      opacity: .42 * opacity,
      weight: 2,
      className: "battle-zone-ring"
    }).addTo(state.layers.battleEffects).bindPopup(`<strong>${t("battlefield.zone","Zona de combate")}</strong><br>${scene.targetFlag || ""} ${scene.targetName}<br>${scene.label}`);
    const impactIcon = L.divIcon({ className: "", html: `<div class="marker-battle-impact ${scene.success ? "success" : "failure"}"><span>${scene.icon}</span><i></i><b></b></div>`, iconSize: [54, 54], iconAnchor: [27, 27] });
    L.marker(scene.coords, { icon: impactIcon }).addTo(state.layers.battleEffects).bindPopup(`<strong>${scene.label}</strong><br>${scene.targetFlag || ""} ${scene.targetName}<br>${t("battlefield.intensity","Intensidade")}: ${scene.intensity}`);
    const smokeIcon = L.divIcon({ className: "", html: `<div class="marker-smoke-cloud"><i></i><i></i><i></i></div>`, iconSize: [46, 34], iconAnchor: [23, 17] });
    L.marker(jitter(scene.coords, .45), { icon: smokeIcon }).addTo(state.layers.battleEffects).bindPopup(`${t("battlefield.smoke","fumaça")} · ${scene.targetName}`);
    if (scene.fromCoords) {
      L.polyline([scene.fromCoords, scene.coords], {
        color: scene.success ? "#ff784f" : "#ffd166",
        weight: 4,
        opacity: .70 * opacity,
        dashArray: "10 12",
        className: "battle-attack-route"
      }).addTo(state.layers.battleEffects).bindPopup(`${t("battlefield.route","Rota de ataque")} · ${scene.label}`);
      const ratio = .58 + ((Date.now() / 7000 + index * .12) % .25);
      const moving = interpolateCoords(scene.fromCoords, scene.coords, Math.min(.92, ratio));
      const attackIcon = L.divIcon({ className: "", html: `<div class="marker-attack-unit">${scene.icon}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] });
      L.marker(moving, { icon: attackIcon }).addTo(state.layers.battleEffects).bindPopup(`${scene.label} → ${scene.targetName}`);
    }
  });
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
    box.innerHTML = `<div class="empty-battle">${t("battle.empty", "Nenhuma batalha registrada ainda. Faça reconhecimento ou ataque um alvo no painel Atacar.")}</div>${renderBattlefieldCinematic()}`;
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

    ${renderBattlefieldCinematic()}

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
  recordBattleScene("ground", getCountry(front.targetId), front.status !== "collapsing", front.progress || 35, text || groundStatusLabel(front.status), `${front.progress}%`);
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
  recordBattleScene(kind, target, success, damage >= 10 ? damage * 4 : 38, airOperationLabel(kind), effect);
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


function makeNavalWar() {
  return {
    selectedTargetId: null,
    seaControl: 30,
    blockadePressure: 12,
    submarineThreat: 22,
    carrierReach: 18,
    convoySecurity: 35,
    operations: 0,
    history: []
  };
}

function ensureNavalWar() {
  if (!state.game) return null;
  if (!state.game.navalWar) state.game.navalWar = makeNavalWar();
  const nw = state.game.navalWar;
  if (!Array.isArray(nw.history)) nw.history = [];
  nw.seaControl = clamp(nw.seaControl ?? 30, 0, 160);
  nw.blockadePressure = clamp(nw.blockadePressure ?? 12, 0, 160);
  nw.submarineThreat = clamp(nw.submarineThreat ?? 22, 0, 160);
  nw.carrierReach = clamp(nw.carrierReach ?? 18, 0, 160);
  nw.convoySecurity = clamp(nw.convoySecurity ?? 35, 0, 160);
  nw.operations = Math.max(0, Math.round(nw.operations || 0));
  if (!nw.selectedTargetId || !getCountry(nw.selectedTargetId) || nw.selectedTargetId === state.game.countryId) {
    const threat = topAiThreats(1)[0];
    nw.selectedTargetId = threat?.id || state.countries.find(c => c.id !== state.game.countryId)?.id;
  }
  return nw;
}

function navalTargets() {
  ensureAiWorld();
  return topAiThreats(14).map(ai => ({ ...ai, country: getCountry(ai.id) })).filter(item => item.country);
}

function navalCost(kind) {
  const costs = {
    patrol: { finance: 38, industry: 10, energy: 24 },
    blockade: { finance: 78, industry: 24, energy: 38 },
    submarine: { finance: 66, industry: 18, energy: 28 },
    carrier: { finance: 110, industry: 32, energy: 56 },
    escort: { finance: 42, industry: 14, energy: 22 }
  };
  return costs[kind] || costs.patrol;
}

function canPayNaval(cost) {
  const g = state.game;
  return g.finance >= (cost.finance || 0) && g.industry >= (cost.industry || 0) && g.energy >= (cost.energy || 0);
}

function payNaval(cost) {
  const g = state.game;
  g.finance -= cost.finance || 0;
  g.industry -= cost.industry || 0;
  g.energy -= cost.energy || 0;
}

function navalOperationLabel(kind) {
  const labels = {
    patrol: t("naval.patrol", "Patrulha naval"),
    blockade: t("naval.blockade", "Bloqueio naval"),
    submarine: t("naval.submarine", "Ataque submarino"),
    carrier: t("naval.carrier", "Ataque de porta-aviões"),
    escort: t("naval.escort", "Escoltar comboios")
  };
  return labels[kind] || kind;
}

function recordNavalHistory(kind, success, target, effect, impact = 0) {
  const nw = ensureNavalWar();
  const report = {
    id: cryptoId(),
    kind,
    label: navalOperationLabel(kind),
    success,
    targetId: target?.id || nw.selectedTargetId,
    targetName: target?.name || "Alvo",
    effect,
    impact,
    seaControl: nw.seaControl,
    blockadePressure: nw.blockadePressure,
    submarineThreat: nw.submarineThreat,
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`,
    coords: target?.coords ? jitter([target.coords[0] + randomInt(-2, 2), target.coords[1] + randomInt(-4, 4)], .85) : null
  };
  nw.history.unshift(report);
  nw.history = nw.history.slice(0, 12);
  recordBattleScene(kind === "carrier" ? "carrier" : "naval", target, success, impact >= 10 ? impact * 4 : 36, navalOperationLabel(kind), effect);
}

function navalOperation(kind) {
  const g = state.game;
  const nw = ensureNavalWar();
  const targetId = $("#navalTargetSelect")?.value || nw.selectedTargetId;
  const target = getCountry(targetId);
  if (!target) return;
  const ai = g.aiWorld?.find(a => a.id === targetId);
  nw.selectedTargetId = targetId;
  const cost = navalCost(kind);
  if (!canPayNaval(cost)) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Insufficient resources for naval operation." : currentLang === "es-ES" ? "Recursos insuficientes para operación naval." : "Recursos insuficientes para operação naval."));
    saveGame(); renderGame(); return;
  }
  payNaval(cost);

  if (kind === "patrol") {
    const gain = randomInt(7, 15) + Math.round(g.navalPower / 28) + Math.round(g.logistics / 55);
    nw.seaControl = clamp(nw.seaControl + gain, 0, 160);
    nw.submarineThreat = clamp(nw.submarineThreat - randomInt(2, 7), 0, 160);
    nw.operations += 1;
    recordNavalHistory(kind, true, target, currentLang === "en-US" ? "Patrol improved sea control." : currentLang === "es-ES" ? "La patrulla mejoró el control marítimo." : "Patrulha melhorou controle marítimo.", gain);
    g.events.push(eventText("sistema", currentLang === "en-US" ? "Naval patrol increased sea control." : currentLang === "es-ES" ? "Patrulla naval aumentó control marítimo." : "Patrulha naval aumentou controle marítimo."));
    saveGame(); renderGame(); activatePanel("panelNaval"); return;
  }

  if (kind === "escort") {
    const gain = randomInt(8, 17) + Math.round(g.logistics / 48);
    nw.convoySecurity = clamp(nw.convoySecurity + gain, 0, 160);
    nw.blockadePressure = clamp(nw.blockadePressure - randomInt(4, 10), 0, 160);
    nw.submarineThreat = clamp(nw.submarineThreat - randomInt(3, 9), 0, 160);
    g.finance += randomInt(8, 24);
    nw.operations += 1;
    recordNavalHistory(kind, true, target, currentLang === "en-US" ? "Convoys secured and trade flow protected." : currentLang === "es-ES" ? "Convoyes asegurados y comercio protegido." : "Comboios protegidos e fluxo comercial mantido.", gain);
    g.events.push(eventText("sistema", currentLang === "en-US" ? "Convoy escort protected maritime trade." : currentLang === "es-ES" ? "Escolta protegió comercio marítimo." : "Escolta de comboios protegeu comércio marítimo."));
    saveGame(); renderGame(); activatePanel("panelNaval"); return;
  }

  const defense = (target.warships || 10) * 1.9 + (target.airframes || 40) / 15 + (ai?.readiness || 45) / 2 + Math.random() * 45;
  const attackBase = kind === "submarine"
    ? g.navalPower * .65 + g.intel * .35 + nw.seaControl * .35 + Math.random() * 25
    : kind === "carrier"
      ? g.navalPower * .62 + g.airPower * .42 + nw.carrierReach * .7 + nw.seaControl * .25 + Math.random() * 42
      : g.navalPower * .72 + nw.seaControl * .45 + g.logistics * .22 + Math.random() * 35;
  const attack = attackBase;
  const success = attack >= defense;
  let impact = 0;
  let effect = "";

  if (success && ai) {
    if (kind === "blockade") {
      impact = randomInt(8, 18) + Math.round(nw.seaControl / 28);
      ai.economy = clamp(ai.economy - impact, 1, 230);
      ai.readiness = clamp(ai.readiness - randomInt(3, 8), 1, 100);
      nw.blockadePressure = clamp(nw.blockadePressure + randomInt(8, 16), 0, 160);
      g.worldTension = clamp(g.worldTension + 7, 0, 100);
      effect = currentLang === "en-US" ? "Blockade damaged enemy economy." : currentLang === "es-ES" ? "Bloqueo dañó economía enemiga." : "Bloqueio danificou economia inimiga.";
    }
    if (kind === "submarine") {
      impact = randomInt(7, 15) + Math.round(g.intel / 45);
      ai.power = clamp(ai.power - impact, 1, 230);
      ai.readiness = clamp(ai.readiness - randomInt(4, 10), 1, 100);
      nw.submarineThreat = clamp(nw.submarineThreat + randomInt(2, 7), 0, 160);
      g.worldTension = clamp(g.worldTension + 5, 0, 100);
      effect = currentLang === "en-US" ? "Submarine strike disrupted enemy fleet." : currentLang === "es-ES" ? "Ataque submarino desorganizó flota enemiga." : "Ataque submarino desorganizou frota inimiga.";
    }
    if (kind === "carrier") {
      impact = randomInt(10, 22) + Math.round(nw.carrierReach / 25);
      ai.power = clamp(ai.power - impact, 1, 230);
      ai.economy = clamp(ai.economy - randomInt(4, 10), 1, 230);
      nw.carrierReach = clamp(nw.carrierReach + randomInt(5, 12), 0, 160);
      const air = ensureAirWar();
      if (air) air.airSupremacy = clamp(air.airSupremacy + randomInt(3, 9), 0, 160);
      g.worldTension = clamp(g.worldTension + 8, 0, 100);
      effect = currentLang === "en-US" ? "Carrier strike projected power inland." : currentLang === "es-ES" ? "Portaaviones proyectó fuerza tierra adentro." : "Porta-aviões projetou força para o interior.";
    }
    nw.seaControl = clamp(nw.seaControl + randomInt(2, 6), 0, 160);
  } else {
    impact = randomInt(1, 5);
    effect = currentLang === "en-US" ? "Naval operation failed under enemy defense." : currentLang === "es-ES" ? "Operación naval falló bajo defensa enemiga." : "Operação naval falhou sob defesa inimiga.";
    nw.seaControl = clamp(nw.seaControl - randomInt(2, 7), 0, 160);
    nw.submarineThreat = clamp(nw.submarineThreat + randomInt(1, 6), 0, 160);
    g.readiness = clamp(g.readiness - randomInt(1, 3), 0, 100);
  }

  nw.operations += 1;
  applyOperationalWear(kind === "carrier" ? "airstrike" : "naval", success);
  recordNavalHistory(kind, success, target, effect, impact);
  g.events.push(eventText(success ? "sistema" : "warn", `${target.name}: ${effect}`));
  saveGame();
  renderGame();
  activatePanel("panelNaval");
}

function progressNavalWar() {
  const nw = ensureNavalWar();
  if (!nw) return;
  const g = state.game;
  const strongest = topAiThreats(1)[0];
  const enemyPush = Math.max(0, Math.round((g.worldTension - 44) / 30)) + (strongest?.power > powerIndex() ? 2 : 0);
  nw.blockadePressure = clamp(nw.blockadePressure + enemyPush - Math.round(nw.seaControl / 85) - Math.round(nw.convoySecurity / 95), 0, 160);
  nw.submarineThreat = clamp(nw.submarineThreat + enemyPush - Math.round(nw.seaControl / 95) - Math.round(nw.convoySecurity / 90), 0, 160);
  nw.seaControl = clamp(nw.seaControl - (nw.blockadePressure > 70 ? 2 : 1) + Math.round(g.navalPower / 170), 0, 160);
  if ((nw.blockadePressure > 78 || nw.submarineThreat > 82) && Math.random() < .25) {
    const financeLoss = randomInt(12, 34);
    const energyLoss = randomInt(6, 18);
    g.finance = Math.max(0, g.finance - financeLoss);
    g.energy = Math.max(0, g.energy - energyLoss);
    g.events.push(eventText("warn", currentLang === "en-US" ? `Maritime pressure reduced trade: -${financeLoss} funds, -${energyLoss} energy.` : currentLang === "es-ES" ? `Presión marítima redujo comercio: -${financeLoss} fondos, -${energyLoss} energía.` : `Pressão marítima reduziu comércio: -${financeLoss} finanças, -${energyLoss} energia.`));
  }
}

function navalBar(label, value) {
  return `<div class="naval-bar"><div><span>${label}</span><strong>${value}</strong></div><i><b style="width:${clamp(value,0,100)}%"></b></i></div>`;
}

function renderNavalWar() {
  const panel = $("#navalWarPanel");
  if (!panel || !state.game) return;
  const nw = ensureNavalWar();
  const targets = navalTargets();
  const last = nw.history[0];
  panel.innerHTML = `
    <div class="naval-target-row">
      <label class="field-label">${t("naval.target", "Alvo naval")}</label>
      <select id="navalTargetSelect">
        ${targets.map(tg => `<option value="${tg.id}" ${tg.id === nw.selectedTargetId ? "selected" : ""}>${tg.country.flag || ""} ${tg.country.name} · ${tg.posture} · ${tg.hostility}</option>`).join("")}
      </select>
    </div>
    <div class="naval-dashboard">
      ${navalBar(t("naval.seaControl", "Controle marítimo"), nw.seaControl)}
      ${navalBar(t("naval.blockadePressure", "Pressão de bloqueio"), nw.blockadePressure)}
      ${navalBar(t("naval.submarineThreat", "Ameaça submarina"), nw.submarineThreat)}
      ${navalBar(t("naval.carrierReach", "Alcance de porta-aviões"), nw.carrierReach)}
      ${navalBar(t("naval.convoySecurity", "Segurança de comboios"), nw.convoySecurity)}
    </div>
    <div class="naval-last">
      <small>${t("naval.history", "Histórico naval")}: ${nw.operations}</small>
      <strong>${last ? `${last.label} · ${last.targetName}` : t("naval.noHistory", "Nenhuma operação naval realizada.")}</strong>
      ${last ? `<span>${last.success ? t("naval.success","sucesso") : t("naval.fail","falha")} · ${last.effect}</span>` : ""}
    </div>
    <div class="naval-actions">
      <button data-naval-action="patrol"><b>🚢 ${t("naval.patrol", "Patrulha naval")}</b><span>${t("naval.cost","Custo")}: 38/10/24</span></button>
      <button data-naval-action="blockade"><b>⛔ ${t("naval.blockade", "Bloqueio naval")}</b><span>${t("naval.cost","Custo")}: 78/24/38</span></button>
      <button data-naval-action="submarine"><b>⚓ ${t("naval.submarine", "Ataque submarino")}</b><span>${t("naval.cost","Custo")}: 66/18/28</span></button>
      <button data-naval-action="carrier"><b>🛫 ${t("naval.carrier", "Ataque de porta-aviões")}</b><span>${t("naval.cost","Custo")}: 110/32/56</span></button>
      <button data-naval-action="escort"><b>🛡️ ${t("naval.escort", "Escoltar comboios")}</b><span>${t("naval.cost","Custo")}: 42/14/22</span></button>
    </div>
    <section class="naval-history">
      <h3>${t("naval.history", "Histórico naval")}</h3>
      ${nw.history.length ? nw.history.slice(0,7).map(item => `<article class="${item.success ? "success" : "fail"}"><strong>${item.label}</strong><span>${item.targetName} · ${item.at} · ${item.success ? t("naval.success","sucesso") : t("naval.fail","falha")}</span><small>${item.effect}</small></article>`).join("") : `<p class="muted">${t("naval.noHistory", "Nenhuma operação naval realizada.")}</p>`}
    </section>`;
  $("#navalTargetSelect")?.addEventListener("change", event => {
    nw.selectedTargetId = event.target.value;
    saveGame();
    renderNavalWar();
  });
  $$("#navalWarPanel [data-naval-action]").forEach(btn => btn.addEventListener("click", () => navalOperation(btn.dataset.navalAction)));
}


function makeMissileWar() {
  return {
    selectedTargetId: null,
    stockpile: 18,
    shield: 28,
    earlyWarning: 30,
    deterrence: 25,
    launches: 0,
    history: []
  };
}

function ensureMissileWar() {
  if (!state.game) return null;
  if (!state.game.missileWar) state.game.missileWar = makeMissileWar();
  const mw = state.game.missileWar;
  if (!Array.isArray(mw.history)) mw.history = [];
  mw.stockpile = clamp(mw.stockpile ?? 18, 0, 220);
  mw.shield = clamp(mw.shield ?? 28, 0, 180);
  mw.earlyWarning = clamp(mw.earlyWarning ?? 30, 0, 180);
  mw.deterrence = clamp(mw.deterrence ?? 25, 0, 180);
  mw.launches = Math.max(0, Math.round(mw.launches || 0));
  if (!mw.selectedTargetId || !getCountry(mw.selectedTargetId) || mw.selectedTargetId === state.game.countryId) {
    const threat = topAiThreats(1)[0];
    mw.selectedTargetId = threat?.id || state.countries.find(c => c.id !== state.game.countryId)?.id;
  }
  return mw;
}

function missileTargets() {
  ensureAiWorld();
  return topAiThreats(14).map(ai => ({ ...ai, country: getCountry(ai.id) })).filter(item => item.country);
}

function missileCost(kind) {
  const costs = {
    build: { finance: 82, industry: 42, energy: 18 },
    shield: { finance: 90, industry: 38, energy: 26 },
    precision: { finance: 110, industry: 34, energy: 42 },
    warning: { finance: 62, industry: 18, energy: 24 },
    deterrence: { finance: 75, industry: 22, energy: 28 }
  };
  return costs[kind] || costs.build;
}

function canPayMissile(cost) {
  const g = state.game;
  return g.finance >= (cost.finance || 0) && g.industry >= (cost.industry || 0) && g.energy >= (cost.energy || 0);
}

function payMissile(cost) {
  const g = state.game;
  g.finance -= cost.finance || 0;
  g.industry -= cost.industry || 0;
  g.energy -= cost.energy || 0;
}

function missileOperationLabel(kind) {
  const labels = {
    build: t("missile.build", "Fabricar mísseis"),
    shield: t("missile.shieldAction", "Reforçar escudo"),
    precision: t("missile.precision", "Ataque convencional"),
    warning: t("missile.warningAction", "Elevar alerta"),
    deterrence: t("missile.deterrenceAction", "Postura dissuasória")
  };
  return labels[kind] || kind;
}

function recordMissileHistory(kind, success, target, effect, impact = 0) {
  const mw = ensureMissileWar();
  const report = {
    id: cryptoId(),
    kind,
    label: missileOperationLabel(kind),
    success,
    targetId: target?.id || mw.selectedTargetId,
    targetName: target?.name || "Alvo",
    effect,
    impact,
    stockpile: mw.stockpile,
    shield: mw.shield,
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`,
    coords: target?.coords ? jitter(target.coords, .8) : null
  };
  mw.history.unshift(report);
  mw.history = mw.history.slice(0, 12);
  recordBattleScene(kind === "precision" ? "missile" : kind, target, success, impact >= 10 ? impact * 4 : 42, missileOperationLabel(kind), effect);
}

function missileOperation(kind) {
  const g = state.game;
  const mw = ensureMissileWar();
  const targetId = $("#missileTargetSelect")?.value || mw.selectedTargetId;
  const target = getCountry(targetId);
  if (!target) return;
  const ai = g.aiWorld?.find(a => a.id === targetId);
  mw.selectedTargetId = targetId;
  const cost = missileCost(kind);
  if (!canPayMissile(cost)) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Insufficient resources for strategic operation." : currentLang === "es-ES" ? "Recursos insuficientes para operación estratégica." : "Recursos insuficientes para operação estratégica."));
    saveGame(); renderGame(); return;
  }

  if (kind !== "precision" || mw.stockpile > 0) payMissile(cost);

  if (kind === "build") {
    const gain = randomInt(8, 16) + Math.round(g.industry / 80) + Math.round(g.missilePower / 12);
    mw.stockpile = clamp(mw.stockpile + gain, 0, 220);
    g.missilePower = clamp(g.missilePower + randomInt(1, 3), 0, 200);
    recordMissileHistory(kind, true, target, currentLang === "en-US" ? "Missile stockpile expanded." : currentLang === "es-ES" ? "Inventario de misiles ampliado." : "Estoque de mísseis ampliado.", gain);
    g.events.push(eventText("sistema", currentLang === "en-US" ? "Strategic missile stockpile expanded." : currentLang === "es-ES" ? "Inventario estratégico de misiles ampliado." : "Estoque estratégico de mísseis ampliado."));
    saveGame(); renderGame(); activatePanel("panelMissile"); return;
  }

  if (kind === "shield") {
    const gain = randomInt(7, 15) + Math.round(g.cyber / 55) + Math.round(g.defense / 65);
    mw.shield = clamp(mw.shield + gain, 0, 180);
    g.defense = clamp(g.defense + randomInt(1, 3), 0, 200);
    recordMissileHistory(kind, true, target, currentLang === "en-US" ? "Missile defense shield reinforced." : currentLang === "es-ES" ? "Escudo antimisil reforzado." : "Escudo antimíssil reforçado.", gain);
    g.events.push(eventText("sistema", currentLang === "en-US" ? "Missile defense shield was reinforced." : currentLang === "es-ES" ? "Escudo antimisil fue reforzado." : "Escudo antimíssil foi reforçado."));
    saveGame(); renderGame(); activatePanel("panelMissile"); return;
  }

  if (kind === "warning") {
    const gain = randomInt(8, 17) + Math.round(g.intel / 50) + Math.round(g.radar || 0);
    mw.earlyWarning = clamp(mw.earlyWarning + gain, 0, 180);
    g.intel = clamp(g.intel + randomInt(1, 3), 0, 180);
    recordMissileHistory(kind, true, target, currentLang === "en-US" ? "Early warning network elevated." : currentLang === "es-ES" ? "Red de alerta temprana elevada." : "Rede de alerta antecipado elevada.", gain);
    g.events.push(eventText("sistema", currentLang === "en-US" ? "Early warning systems increased strategic readiness." : currentLang === "es-ES" ? "Sistemas de alerta aumentaron preparación estratégica." : "Sistemas de alerta aumentaram prontidão estratégica."));
    saveGame(); renderGame(); activatePanel("panelMissile"); return;
  }

  if (kind === "deterrence") {
    const gain = randomInt(7, 14) + Math.round(mw.stockpile / 25) + Math.round(mw.shield / 35);
    mw.deterrence = clamp(mw.deterrence + gain, 0, 180);
    g.escalation = clamp(g.escalation + 2, 0, 100);
    if (g.globalWar) {
      g.globalWar.nuclearRisk = clamp((g.globalWar.nuclearRisk || 0) + 2, 0, 100);
      updateGlobalPhase();
    }
    const threat = topAiThreats(1)[0];
    if (threat) threat.hostility = clamp(threat.hostility - randomInt(2, 7), 0, 100);
    recordMissileHistory(kind, true, target, currentLang === "en-US" ? "Deterrence posture increased strategic pressure." : currentLang === "es-ES" ? "Postura disuasoria aumentó presión estratégica." : "Postura dissuasória elevou pressão estratégica.", gain);
    g.events.push(eventText("warn", currentLang === "en-US" ? "Deterrence posture increased strategic tension but discouraged rivals." : currentLang === "es-ES" ? "Postura disuasoria elevó tensión estratégica, pero desalentó rivales." : "Postura dissuasória elevou tensão estratégica, mas desmotivou rivais."));
    saveGame(); renderGame(); activatePanel("panelMissile"); return;
  }

  if (kind === "precision") {
    if (mw.stockpile <= 0) {
      g.events.push(eventText("warn", currentLang === "en-US" ? "No missile stockpile available." : currentLang === "es-ES" ? "No hay inventario de misiles disponible." : "Não há estoque de mísseis disponível."));
      renderMissileWar();
      return;
    }
    mw.stockpile = clamp(mw.stockpile - 1, 0, 220);
    const defense = (target.missiles || 25) * 1.4 + (target.cyber || 45) / 2 + (ai?.readiness || 55) / 2 + Math.random() * 45;
    const attack = g.missilePower * 1.6 + mw.stockpile / 3 + mw.earlyWarning / 3 + g.intel / 2 + Math.random() * 60;
    const success = attack >= defense;
    let impact = 0;
    let effect = "";
    if (success && ai) {
      impact = randomInt(10, 24) + Math.round(g.missilePower / 18);
      ai.power = clamp(ai.power - impact, 1, 230);
      ai.economy = clamp(ai.economy - randomInt(5, 14), 1, 230);
      ai.readiness = clamp(ai.readiness - randomInt(6, 16), 1, 100);
      ai.lastMove = "sofreu ataque estratégico";
      g.worldTension = clamp(g.worldTension + 9, 0, 100);
      g.escalation = clamp(g.escalation + 5, 0, 100);
      if (g.globalWar) {
        g.globalWar.warScore = clamp((g.globalWar.warScore || 0) + 3, 0, 100);
        g.globalWar.nuclearRisk = clamp((g.globalWar.nuclearRisk || 0) + (target.nuclear ? 5 : 2), 0, 100);
        updateGlobalPhase();
      }
      effect = currentLang === "en-US" ? "Conventional missile strike damaged strategic infrastructure." : currentLang === "es-ES" ? "Ataque convencional dañó infraestructura estratégica." : "Ataque convencional danificou infraestrutura estratégica.";
    } else {
      impact = randomInt(1, 5);
      g.worldTension = clamp(g.worldTension + 4, 0, 100);
      g.readiness = clamp(g.readiness - 1, 0, 100);
      effect = currentLang === "en-US" ? "Missile strike was intercepted or failed." : currentLang === "es-ES" ? "Ataque de misiles fue interceptado o falló." : "Ataque de mísseis foi interceptado ou falhou.";
    }
    mw.launches += 1;
    applyOperationalWear("airstrike", success);
    recordMissileHistory(kind, success, target, effect, impact);
    g.events.push(eventText(success ? "danger" : "warn", `${target.name}: ${effect}`));
    saveGame();
    renderGame();
    activatePanel("panelMissile");
  }
}

function progressMissileWar() {
  const mw = ensureMissileWar();
  if (!mw) return;
  const g = state.game;
  const risk = (g.globalWar?.nuclearRisk || 0) + g.worldTension / 3 + g.escalation / 2;
  mw.deterrence = clamp(mw.deterrence - 1 + Math.round(mw.stockpile / 90), 0, 180);
  mw.earlyWarning = clamp(mw.earlyWarning - 1 + Math.round(g.intel / 130), 0, 180);
  if (risk > 70 && mw.shield < 45 && Math.random() < .18) {
    const base = g.bases.find(b => b.condition > 15);
    if (base) {
      const damage = randomInt(8, 22);
      base.condition = clamp(base.condition - damage, 0, 100);
      g.events.push(eventText("danger", currentLang === "en-US" ? `Strategic missile incident damaged ${base.name}.` : currentLang === "es-ES" ? `Incidente estratégico de misiles dañó ${base.name}.` : `Incidente estratégico de mísseis danificou ${base.name}.`));
    }
  }
  if (risk > 82 && mw.earlyWarning > 55 && mw.shield > 55 && Math.random() < .15) {
    g.worldTension = clamp(g.worldTension - 2, 0, 100);
    g.events.push(eventText("sistema", currentLang === "en-US" ? "Early warning and missile shield prevented strategic escalation." : currentLang === "es-ES" ? "Alerta y escudo antimisil evitaron escalada estratégica." : "Alerta antecipado e escudo antimíssil evitaram escalada estratégica."));
  }
}

function missileBar(label, value) {
  return `<div class="missile-bar"><div><span>${label}</span><strong>${value}</strong></div><i><b style="width:${clamp(value,0,100)}%"></b></i></div>`;
}

function renderMissileWar() {
  const panel = $("#missileWarPanel");
  if (!panel || !state.game) return;
  const mw = ensureMissileWar();
  const targets = missileTargets();
  const last = mw.history[0];
  const nuclearRisk = state.game.globalWar?.nuclearRisk || 0;
  panel.innerHTML = `
    <div class="missile-target-row">
      <label class="field-label">${t("missile.target", "Alvo estratégico")}</label>
      <select id="missileTargetSelect">
        ${targets.map(tg => `<option value="${tg.id}" ${tg.id === mw.selectedTargetId ? "selected" : ""}>${tg.country.flag || ""} ${tg.country.name} · ${tg.posture} · ${tg.hostility}</option>`).join("")}
      </select>
    </div>
    <div class="missile-dashboard">
      ${missileBar(t("missile.stockpile", "Estoque de mísseis"), mw.stockpile)}
      ${missileBar(t("missile.shield", "Escudo antimíssil"), mw.shield)}
      ${missileBar(t("missile.warning", "Alerta antecipado"), mw.earlyWarning)}
      ${missileBar(t("missile.deterrence", "Dissuasão"), mw.deterrence)}
      ${missileBar(t("missile.risk", "Risco nuclear"), nuclearRisk)}
    </div>
    <div class="missile-last">
      <small>${t("missile.history", "Histórico estratégico")}: ${mw.launches}</small>
      <strong>${last ? `${last.label} · ${last.targetName}` : t("missile.noHistory", "Nenhuma operação estratégica realizada.")}</strong>
      ${last ? `<span>${last.success ? t("missile.success","sucesso") : t("missile.fail","falha")} · ${last.effect}</span>` : ""}
    </div>
    <div class="missile-actions">
      <button data-missile-action="build"><b>🏭 ${t("missile.build", "Fabricar mísseis")}</b><span>${t("missile.cost","Custo")}: 82/42/18</span></button>
      <button data-missile-action="shield"><b>🛡️ ${t("missile.shieldAction", "Reforçar escudo")}</b><span>${t("missile.cost","Custo")}: 90/38/26</span></button>
      <button data-missile-action="precision"><b>🎯 ${t("missile.precision", "Ataque convencional")}</b><span>${t("missile.cost","Custo")}: 110/34/42</span></button>
      <button data-missile-action="warning"><b>📡 ${t("missile.warningAction", "Elevar alerta")}</b><span>${t("missile.cost","Custo")}: 62/18/24</span></button>
      <button data-missile-action="deterrence"><b>☢️ ${t("missile.deterrenceAction", "Postura dissuasória")}</b><span>${t("missile.cost","Custo")}: 75/22/28</span></button>
    </div>
    <section class="missile-history">
      <h3>${t("missile.history", "Histórico estratégico")}</h3>
      ${mw.history.length ? mw.history.slice(0,7).map(item => `<article class="${item.success ? "success" : "fail"}"><strong>${item.label}</strong><span>${item.targetName} · ${item.at} · ${item.success ? t("missile.success","sucesso") : t("missile.fail","falha")}</span><small>${item.effect}</small></article>`).join("") : `<p class="muted">${t("missile.noHistory", "Nenhuma operação estratégica realizada.")}</p>`}
    </section>`;
  $("#missileTargetSelect")?.addEventListener("change", event => {
    mw.selectedTargetId = event.target.value;
    saveGame();
    renderMissileWar();
  });
  $$("#missileWarPanel [data-missile-action]").forEach(btn => btn.addEventListener("click", () => missileOperation(btn.dataset.missileAction)));
}


function makeLogisticsSystem() {
  return {
    selectedRegionId: null,
    supplyNetwork: 34,
    fuelReserve: 32,
    ammoStock: 36,
    transportCapacity: 30,
    routeSecurity: 28,
    bottleneck: 18,
    airliftReady: 20,
    convoys: 0,
    history: []
  };
}

function ensureLogisticsSystem() {
  if (!state.game) return null;
  if (!state.game.logisticsSystem) state.game.logisticsSystem = makeLogisticsSystem();
  const ls = state.game.logisticsSystem;
  if (!Array.isArray(ls.history)) ls.history = [];
  ls.supplyNetwork = clamp(ls.supplyNetwork ?? 34, 0, 180);
  ls.fuelReserve = clamp(ls.fuelReserve ?? 32, 0, 180);
  ls.ammoStock = clamp(ls.ammoStock ?? 36, 0, 180);
  ls.transportCapacity = clamp(ls.transportCapacity ?? 30, 0, 180);
  ls.routeSecurity = clamp(ls.routeSecurity ?? 28, 0, 180);
  ls.bottleneck = clamp(ls.bottleneck ?? 18, 0, 100);
  ls.airliftReady = clamp(ls.airliftReady ?? 20, 0, 180);
  ls.convoys = Math.max(0, Math.round(ls.convoys || 0));
  if (!ls.selectedRegionId || !getRegion(ls.selectedRegionId)) ls.selectedRegionId = state.game.selectedRegionId || state.game.regions[0]?.id;
  return ls;
}

function logisticsCost(kind) {
  const costs = {
    expand: { finance: 70, industry: 35, energy: 18 },
    ammo: { finance: 55, industry: 42, energy: 8 },
    fuel: { finance: 50, industry: 15, energy: 30 },
    secure: { finance: 42, industry: 18, energy: 12 },
    airlift: { finance: 65, industry: 18, energy: 38 },
    emergency: { finance: 60, industry: 28, energy: 18 }
  };
  return costs[kind] || costs.expand;
}

function canPayLogistics(cost) {
  const g = state.game;
  return g.finance >= (cost.finance || 0) && g.industry >= (cost.industry || 0) && g.energy >= (cost.energy || 0);
}

function payLogistics(cost) {
  const g = state.game;
  g.finance -= cost.finance || 0;
  g.industry -= cost.industry || 0;
  g.energy -= cost.energy || 0;
}

function recordLogisticsHistory(kind, region, effect, impact = 0) {
  const ls = ensureLogisticsSystem();
  const labels = {
    expand: t("logistics.expand", "Expandir rede"),
    ammo: t("logistics.ammoAction", "Estocar munição"),
    fuel: t("logistics.fuelAction", "Reservar combustível"),
    secure: t("logistics.secure", "Proteger rotas"),
    airlift: t("logistics.airlift", "Ponte aérea"),
    emergency: t("logistics.emergency", "Reparo emergencial")
  };
  const item = {
    id: cryptoId(),
    kind,
    label: labels[kind] || kind,
    regionId: region?.id || ls.selectedRegionId,
    regionName: region?.name || "Região",
    effect,
    impact,
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`,
    coords: region?.coords ? jitter(region.coords, .42) : null
  };
  ls.history.unshift(item);
  ls.history = ls.history.slice(0, 12);
}

function logisticsAction(kind) {
  const g = state.game;
  const ls = ensureLogisticsSystem();
  const regionId = $("#logisticsRegionSelect")?.value || ls.selectedRegionId || g.selectedRegionId;
  const region = getRegion(regionId);
  const cost = logisticsCost(kind);
  if (!canPayLogistics(cost)) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Insufficient resources for logistics action." : currentLang === "es-ES" ? "Recursos insuficientes para acción logística." : "Recursos insuficientes para ação logística."));
    saveGame(); renderGame(); return;
  }
  ls.selectedRegionId = region.id;
  payLogistics(cost);
  let effect = "";
  let impact = 0;

  if (kind === "expand") {
    impact = randomInt(8, 16) + Math.round(g.logistics / 55);
    ls.supplyNetwork = clamp(ls.supplyNetwork + impact, 0, 180);
    ls.transportCapacity = clamp(ls.transportCapacity + randomInt(4, 10), 0, 180);
    ls.bottleneck = clamp(ls.bottleneck - randomInt(3, 8), 0, 100);
    g.logistics = clamp(g.logistics + 3, 0, 180);
    effect = currentLang === "en-US" ? "Supply network expanded." : currentLang === "es-ES" ? "Red de suministros expandida." : "Rede de suprimentos expandida.";
  }

  if (kind === "ammo") {
    impact = randomInt(10, 20);
    ls.ammoStock = clamp(ls.ammoStock + impact, 0, 180);
    g.readiness = clamp(g.readiness + 1, 0, 100);
    effect = currentLang === "en-US" ? "Ammunition stockpile reinforced." : currentLang === "es-ES" ? "Stock de munición reforzado." : "Estoque de munição reforçado.";
  }

  if (kind === "fuel") {
    impact = randomInt(9, 18);
    ls.fuelReserve = clamp(ls.fuelReserve + impact, 0, 180);
    ls.bottleneck = clamp(ls.bottleneck - randomInt(1, 5), 0, 100);
    effect = currentLang === "en-US" ? "Fuel reserves secured." : currentLang === "es-ES" ? "Reservas de combustible aseguradas." : "Reservas de combustível garantidas.";
  }

  if (kind === "secure") {
    impact = randomInt(8, 16);
    ls.routeSecurity = clamp(ls.routeSecurity + impact, 0, 180);
    ls.bottleneck = clamp(ls.bottleneck - randomInt(4, 9), 0, 100);
    const naval = ensureNavalWar();
    if (naval) naval.convoySecurity = clamp(naval.convoySecurity + randomInt(2, 6), 0, 180);
    effect = currentLang === "en-US" ? "Routes secured and convoy risk reduced." : currentLang === "es-ES" ? "Rutas protegidas y riesgo de convoy reducido." : "Rotas protegidas e risco de comboio reduzido.";
  }

  if (kind === "airlift") {
    impact = randomInt(8, 18) + Math.round(ls.airliftReady / 50);
    ls.airliftReady = clamp(ls.airliftReady + randomInt(3, 8), 0, 180);
    ls.fuelReserve = clamp(ls.fuelReserve - randomInt(2, 8), 0, 180);
    const fronts = ensureGroundWar()?.fronts?.filter(f => f.status !== "withdrawn") || [];
    if (fronts.length) {
      const weakest = fronts.sort((a,b) => a.supply - b.supply)[0];
      weakest.supply = clamp(weakest.supply + impact, 0, 100);
      weakest.resistance = clamp(weakest.resistance - randomInt(1, 5), 0, 100);
      effect = `${weakest.targetName}: ${currentLang === "en-US" ? "front supplied by airlift." : currentLang === "es-ES" ? "frente abastecido por puente aéreo." : "frente abastecida por ponte aérea."}`;
    } else {
      region.supply = clamp((region.supply || 50) + impact, 0, 100);
      effect = currentLang === "en-US" ? "Airlift increased regional supply." : currentLang === "es-ES" ? "Puente aéreo aumentó suministro regional." : "Ponte aérea aumentou suprimento regional.";
    }
  }

  if (kind === "emergency") {
    const damaged = g.bases.filter(b => b.regionId === region.id && b.condition < 95);
    if (damaged.length) {
      const repaired = damaged.slice(0, 2);
      repaired.forEach(base => base.condition = clamp(base.condition + randomInt(10, 22), 0, 100));
      impact = repaired.length;
      effect = currentLang === "en-US" ? "Emergency teams repaired damaged structures." : currentLang === "es-ES" ? "Equipos emergenciales repararon estructuras dañadas." : "Equipes emergenciais repararam estruturas danificadas.";
    } else {
      ls.bottleneck = clamp(ls.bottleneck - randomInt(4, 9), 0, 100);
      ls.supplyNetwork = clamp(ls.supplyNetwork + randomInt(2, 6), 0, 180);
      effect = currentLang === "en-US" ? "Emergency logistics cleared bottlenecks." : currentLang === "es-ES" ? "Logística emergencial liberó cuellos." : "Logística emergencial liberou gargalos.";
    }
  }

  ls.convoys += 1;
  recordLogisticsHistory(kind, region, effect, impact);
  g.events.push(eventText("sistema", effect));
  saveGame();
  renderGame();
  activatePanel("panelLogistics");
}

function progressLogisticsSystem() {
  const ls = ensureLogisticsSystem();
  if (!ls) return;
  const g = state.game;
  const activeFronts = ensureGroundWar()?.fronts?.filter(f => f.status !== "withdrawn") || [];
  const pressure = activeFronts.length * 2 + Math.max(0, Math.round((g.worldTension - 52) / 18));
  const naval = ensureNavalWar();
  const air = ensureAirWar();
  const convoyHelp = Math.round((naval?.convoySecurity || 0) / 85);
  const airHelp = Math.round((air?.airSupremacy || 0) / 95);
  ls.bottleneck = clamp(ls.bottleneck + pressure - Math.round(ls.routeSecurity / 70) - convoyHelp - airHelp, 0, 100);
  ls.fuelReserve = clamp(ls.fuelReserve - activeFronts.length - Math.round((air?.enemyAirPressure || 0) / 60) + Math.round(ls.supplyNetwork / 95), 0, 180);
  ls.ammoStock = clamp(ls.ammoStock - activeFronts.length - Math.round(g.production.length / 3) + Math.round(ls.transportCapacity / 100), 0, 180);
  ls.supplyNetwork = clamp(ls.supplyNetwork + Math.round(g.logistics / 120) - (ls.bottleneck > 70 ? 2 : 0), 0, 180);
  activeFronts.forEach(front => {
    const gain = Math.round((ls.supplyNetwork + ls.transportCapacity + ls.routeSecurity) / 120) - Math.round(ls.bottleneck / 45);
    front.supply = clamp(front.supply + gain, 0, 100);
    if (ls.ammoStock < 20 || ls.fuelReserve < 20) front.supply = clamp(front.supply - randomInt(2, 6), 0, 100);
  });
  if (ls.bottleneck > 78 && Math.random() < .25) {
    g.readiness = clamp(g.readiness - randomInt(1, 4), 0, 100);
    g.events.push(eventText("warn", currentLang === "en-US" ? "Logistics bottleneck reduced operational readiness." : currentLang === "es-ES" ? "Cuello logístico redujo preparación operacional." : "Gargalo logístico reduziu prontidão operacional."));
  }
}

function logisticsBar(label, value, dangerReverse = false) {
  const danger = dangerReverse ? value > 65 : value < 28;
  return `<div class="logistics-bar ${danger ? "danger" : ""}"><div><span>${label}</span><strong>${value}</strong></div><i><b style="width:${clamp(value,0,100)}%"></b></i></div>`;
}

function renderLogisticsSystem() {
  const panel = $("#logisticsPanel");
  if (!panel || !state.game) return;
  const ls = ensureLogisticsSystem();
  const region = getRegion(ls.selectedRegionId);
  const fronts = ensureGroundWar()?.fronts?.filter(f => f.status !== "withdrawn") || [];
  panel.innerHTML = `
    <div class="logistics-target-row">
      <label class="field-label">${t("logistics.region", "Região logística")}</label>
      <select id="logisticsRegionSelect">
        ${state.game.regions.map(r => `<option value="${r.id}" ${r.id === ls.selectedRegionId ? "selected" : ""}>${r.kind} · ${r.name}</option>`).join("")}
      </select>
    </div>
    <div class="logistics-dashboard">
      ${logisticsBar(t("logistics.network", "Rede de suprimentos"), ls.supplyNetwork)}
      ${logisticsBar(t("logistics.fuel", "Reserva de combustível"), ls.fuelReserve)}
      ${logisticsBar(t("logistics.ammo", "Estoque de munição"), ls.ammoStock)}
      ${logisticsBar(t("logistics.transport", "Capacidade de transporte"), ls.transportCapacity)}
      ${logisticsBar(t("logistics.routeSecurity", "Segurança de rotas"), ls.routeSecurity)}
      ${logisticsBar(t("logistics.bottleneck", "Gargalo logístico"), ls.bottleneck, true)}
    </div>
    <div class="logistics-last">
      <small>${t("logistics.effect", "Efeito")}: ${fronts.length} ${currentLang === "en-US" ? "fronts supplied" : currentLang === "es-ES" ? "frentes abastecidos" : "frentes abastecidas"}</small>
      <strong>${ls.history[0] ? `${ls.history[0].label} · ${ls.history[0].regionName}` : t("logistics.noHistory", "Nenhuma ação logística realizada.")}</strong>
      ${ls.history[0] ? `<span>${ls.history[0].effect}</span>` : ""}
    </div>
    <div class="logistics-actions">
      <button data-logistics-action="expand"><b>🚚 ${t("logistics.expand", "Expandir rede")}</b><span>${t("logistics.cost","Custo")}: 70/35/18</span></button>
      <button data-logistics-action="ammo"><b>🧨 ${t("logistics.ammoAction", "Estocar munição")}</b><span>${t("logistics.cost","Custo")}: 55/42/8</span></button>
      <button data-logistics-action="fuel"><b>⛽ ${t("logistics.fuelAction", "Reservar combustível")}</b><span>${t("logistics.cost","Custo")}: 50/15/30</span></button>
      <button data-logistics-action="secure"><b>🛡️ ${t("logistics.secure", "Proteger rotas")}</b><span>${t("logistics.cost","Custo")}: 42/18/12</span></button>
      <button data-logistics-action="airlift"><b>🛫 ${t("logistics.airlift", "Ponte aérea")}</b><span>${t("logistics.cost","Custo")}: 65/18/38</span></button>
      <button data-logistics-action="emergency"><b>🛠️ ${t("logistics.emergency", "Reparo emergencial")}</b><span>${region?.kind || ""}</span></button>
    </div>
    <section class="logistics-history">
      <h3>${t("logistics.history", "Histórico logístico")}</h3>
      ${ls.history.length ? ls.history.slice(0,7).map(item => `<article><strong>${item.label}</strong><span>${item.regionName} · ${item.at}</span><small>${item.effect}</small></article>`).join("") : `<p class="muted">${t("logistics.noHistory", "Nenhuma ação logística realizada.")}</p>`}
    </section>`;
  $("#logisticsRegionSelect")?.addEventListener("change", event => {
    ls.selectedRegionId = event.target.value;
    saveGame();
    renderLogisticsSystem();
  });
  $$("#logisticsPanel [data-logistics-action]").forEach(btn => btn.addEventListener("click", () => logisticsAction(btn.dataset.logisticsAction)));
}


function makeMovementSystem() {
  return {
    originRegionId: "capital",
    selectedStackUid: null,
    destinationRegionId: "border",
    deployments: [],
    history: []
  };
}

function ensureStackUids() {
  if (!state.game?.units) return;
  state.game.units.forEach(stack => {
    if (!stack.uid) stack.uid = cryptoId();
  });
}

function ensureMovementSystem() {
  if (!state.game) return null;
  if (!state.game.movementSystem) state.game.movementSystem = makeMovementSystem();
  const ms = state.game.movementSystem;
  ensureStackUids();
  if (!Array.isArray(ms.deployments)) ms.deployments = [];
  if (!Array.isArray(ms.history)) ms.history = [];
  ms.originRegionId = ms.originRegionId || state.game.selectedRegionId || "capital";
  ms.destinationRegionId = ms.destinationRegionId || "border";
  const originUnits = regionUnits(ms.originRegionId);
  if ((!ms.selectedStackUid || !findUnitStackByUid(ms.selectedStackUid)) && originUnits.length) {
    ms.selectedStackUid = originUnits[0].uid;
  }
  return ms;
}

function findUnitStackByUid(uid) {
  ensureStackUids();
  return state.game.units.find(s => s.uid === uid);
}

function movementTravelTime(stack, originId, destinationId) {
  const o = getRegion(originId);
  const d = getRegion(destinationId);
  const unit = getUnit(stack.id);
  const latDelta = Math.abs((o.coords?.[0] || 0) - (d.coords?.[0] || 0));
  const lngDelta = Math.abs((o.coords?.[1] || 0) - (d.coords?.[1] || 0));
  const distanceScore = latDelta + lngDelta / 1.8;
  const base = unit?.class === "Aéreo" ? 1 : unit?.class === "Naval" ? 2 : 2;
  const logisticsBonus = Math.round((state.game.logistics || 0) / 40);
  return clamp(Math.ceil(base + distanceScore / 4.2 - logisticsBonus), 1, 6);
}

function movementStackLabel(stack) {
  const unit = getUnit(stack.id);
  return `${unit?.icon || "🪖"} ${unit?.name || stack.id} · ${t("movement.stack","Lotes")}: ${stack.qty} · ${getRegion(stack.regionId).name}`;
}

function recordMovementHistory(kind, payload) {
  const ms = ensureMovementSystem();
  ms.history.unshift({
    id: cryptoId(),
    kind,
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`,
    ...payload
  });
  ms.history = ms.history.slice(0, 12);
}

function mergeArrivedStack(stackData, regionId) {
  const existing = state.game.units.find(s => s.id === stackData.id && s.regionId === regionId);
  if (existing) {
    existing.qty += stackData.qty;
    existing.condition = Math.round((existing.condition + stackData.condition) / 2);
    existing.veteran = Math.max(existing.veteran || 0, stackData.veteran || 0);
  } else {
    state.game.units.push({ ...stackData, regionId, uid: cryptoId() });
  }
}

function dispatchMovement(kind = "redeploy") {
  const g = state.game;
  const ms = ensureMovementSystem();
  const stack = findUnitStackByUid($("#movementUnitSelect")?.value || ms.selectedStackUid);
  const destinationId = $("#movementDestinationSelect")?.value || ms.destinationRegionId;
  if (!stack) return;
  const origin = getRegion(stack.regionId);
  const destination = getRegion(destinationId);
  if (!origin || !destination || origin.id === destination.id) return;
  ms.originRegionId = origin.id;
  ms.destinationRegionId = destination.id;
  ms.selectedStackUid = stack.uid;

  const existingFront = ensureGroundWar()?.fronts?.find(f => f.status !== "withdrawn");
  const travel = movementTravelTime(stack, origin.id, destination.id);
  const unit = getUnit(stack.id);
  const cost = { finance: Math.max(6, Math.round(stack.qty * (unit?.class === "Aéreo" ? 14 : 8))), energy: Math.max(3, Math.round(travel * 4)), industry: 0 };
  if (g.finance < cost.finance || g.energy < cost.energy) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Not enough resources to move this force." : currentLang === "es-ES" ? "No hay recursos suficientes para mover esta fuerza." : "Recursos insuficientes para mover esta força."));
    saveGame(); renderGame(); return;
  }
  g.finance -= cost.finance;
  g.energy -= cost.energy;

  const payload = {
    id: cryptoId(),
    kind,
    unitId: stack.id,
    unitIcon: unit?.icon || unitMapIcon(unit),
    unitName: unit?.name || stack.id,
    qty: stack.qty,
    condition: stack.condition ?? 100,
    veteran: stack.veteran || 0,
    fromRegionId: origin.id,
    fromRegionName: origin.name,
    toRegionId: destination.id,
    toRegionName: destination.name,
    total: travel,
    remaining: travel,
    progress: 0,
    frontTargetId: kind === "front" ? existingFront?.targetId || null : null,
    frontTargetName: kind === "front" ? existingFront?.targetName || null : null
  };

  g.units = g.units.filter(s => s.uid !== stack.uid);
  ms.deployments.push(payload);
  recordMovementHistory("dispatch", {
    label: `${payload.unitIcon} ${payload.unitName}`,
    text: `${origin.name} → ${destination.name}`,
    eta: travel,
    success: true
  });
  g.events.push(eventText("sistema", `${payload.unitName} saiu de ${origin.name} rumo a ${destination.name}.`));
  saveGame();
  renderGame();
  activatePanel("panelMovement");
}

function cancelMovements() {
  const ms = ensureMovementSystem();
  if (!ms.deployments.length) return;
  ms.deployments.forEach(dep => {
    mergeArrivedStack({ id: dep.unitId, qty: dep.qty, condition: dep.condition, veteran: dep.veteran }, dep.fromRegionId);
  });
  state.game.events.push(eventText("warn", currentLang === "en-US" ? "Transit orders canceled. Forces returned to origin." : currentLang === "es-ES" ? "Órdenes canceladas. Las fuerzas regresaron al origen." : "Ordens canceladas. As forças retornaram à origem."));
  recordMovementHistory("cancel", {
    label: "↩️ Cancelado",
    text: currentLang === "en-US" ? "Transit orders canceled." : currentLang === "es-ES" ? "Tránsitos cancelados." : "Trânsitos cancelados.",
    eta: 0,
    success: true
  });
  ms.deployments = [];
  saveGame();
  renderGame();
  activatePanel("panelMovement");
}

function progressMovementSystem() {
  const g = state.game;
  const ms = ensureMovementSystem();
  const arrived = [];
  ms.deployments.forEach(dep => {
    dep.remaining -= 1;
    dep.progress = clamp(100 - Math.round((dep.remaining / dep.total) * 100), 0, 100);
    if (dep.remaining <= 0) arrived.push(dep);
  });
  ms.deployments = ms.deployments.filter(dep => dep.remaining > 0);
  arrived.forEach(dep => {
    mergeArrivedStack({ id: dep.unitId, qty: dep.qty, condition: dep.condition, veteran: dep.veteran }, dep.toRegionId);
    if (dep.frontTargetId) {
      const front = ensureGroundWar()?.fronts?.find(f => f.targetId === dep.frontTargetId && f.status !== "withdrawn");
      if (front) {
        front.supply = clamp(front.supply + 8 + dep.qty * 2, 0, 100);
        front.progress = clamp(front.progress + 3 + dep.qty, 0, 100);
        front.resistance = clamp(front.resistance - (2 + dep.qty), 0, 100);
      }
    }
    recordMovementHistory("arrival", {
      label: `${dep.unitIcon} ${dep.unitName}`,
      text: `${dep.toRegionName}${dep.frontTargetName ? ` · reforço para ${dep.frontTargetName}` : ""}`,
      eta: 0,
      success: true
    });
    g.events.push(eventText("sistema", `${dep.unitName} chegou em ${dep.toRegionName}${dep.frontTargetName ? ` e reforçou a frente contra ${dep.frontTargetName}` : ""}.`));
  });
}

function renderMovementSystem() {
  const panel = $("#movementPanel");
  if (!panel || !state.game) return;
  const ms = ensureMovementSystem();
  const regions = state.game.regions;
  const originId = ms.originRegionId || state.game.selectedRegionId || regions[0]?.id;
  const originStacks = regionUnits(originId);
  if ((!ms.selectedStackUid || !findUnitStackByUid(ms.selectedStackUid)) && originStacks.length) ms.selectedStackUid = originStacks[0].uid;
  if (!ms.destinationRegionId) ms.destinationRegionId = regions.find(r => r.id !== originId)?.id || originId;
  const activeFront = ensureGroundWar()?.fronts?.find(f => f.status !== "withdrawn");
  const selectedStack = findUnitStackByUid(ms.selectedStackUid);
  const travel = selectedStack ? movementTravelTime(selectedStack, originId, ms.destinationRegionId) : 0;

  panel.innerHTML = `
    <div class="movement-grid">
      <label><span>${t("movement.origin","Origem")}</span>
        <select id="movementOriginSelect">
          ${regions.map(r => `<option value="${r.id}" ${r.id === originId ? "selected" : ""}>${r.name}</option>`).join("")}
        </select>
      </label>
      <label><span>${t("movement.unit","Unidade")}</span>
        <select id="movementUnitSelect">
          ${originStacks.length ? originStacks.map(stack => `<option value="${stack.uid}" ${stack.uid === ms.selectedStackUid ? "selected" : ""}>${movementStackLabel(stack)}</option>`).join("") : `<option value="">${t("movement.noTransit","Nenhuma força em trânsito.")}</option>`}
        </select>
      </label>
      <label><span>${t("movement.destination","Destino")}</span>
        <select id="movementDestinationSelect">
          ${regions.map(r => `<option value="${r.id}" ${r.id === ms.destinationRegionId ? "selected" : ""}>${r.name}</option>`).join("")}
        </select>
      </label>
      <div class="movement-eta">
        <small>${t("movement.travel","Tempo de deslocamento")}</small>
        <strong>${selectedStack ? `${travel} ${t("movement.days","meses")}` : "—"}</strong>
        <span>${activeFront ? `${t("movement.activeFront","Frente ativa")}: ${activeFront.targetName}` : t("ground.noFront", "Nenhuma frente terrestre ativa.")}</span>
      </div>
    </div>

    <div class="movement-actions">
      <button id="movementDeployBtn" ${selectedStack ? "" : "disabled"}>🚛 ${t("movement.deploy","Reposicionar força")}</button>
      <button id="movementFrontBtn" ${(selectedStack && activeFront) ? "" : "disabled"}>🪖 ${t("movement.reinforce","Enviar à frente")}</button>
      <button id="movementCancelBtn" ${ms.deployments.length ? "" : "disabled"}>↩️ ${t("movement.cancel","Cancelar trânsitos")}</button>
    </div>

    <section class="movement-transit">
      <h3>${t("movement.inTransit","Em trânsito")}</h3>
      ${ms.deployments.length ? ms.deployments.map(dep => `
        <article>
          <div><strong>${dep.unitIcon} ${dep.unitName}</strong><span>${dep.fromRegionName} → ${dep.toRegionName}</span></div>
          <small>${t("movement.eta","Chega em")} ${dep.remaining} ${t("movement.days","meses")} · ${dep.qty} ${t("movement.stack","Lotes")}</small>
          <i><b style="width:${dep.progress || 0}%"></b></i>
        </article>`).join("") : `<p class="muted">${t("movement.noTransit","Nenhuma força em trânsito.")}</p>`}
    </section>

    <section class="movement-history">
      <h3>${t("movement.history","Histórico de deslocamentos")}</h3>
      ${ms.history.length ? ms.history.slice(0,6).map(item => `<article><strong>${item.label}</strong><span>${item.at} · ${item.text}</span><small>${item.eta ? `${t("movement.eta","Chega em")} ${item.eta} ${t("movement.days","meses")}` : t("movement.arrival","Chegada")}</small></article>`).join("") : `<p class="muted">${t("movement.noHistory","Nenhum deslocamento realizado.")}</p>`}
    </section>`;
  $("#movementOriginSelect")?.addEventListener("change", e => {
    ms.originRegionId = e.target.value;
    const arr = regionUnits(ms.originRegionId);
    ms.selectedStackUid = arr[0]?.uid || null;
    saveGame();
    renderMovementSystem();
  });
  $("#movementUnitSelect")?.addEventListener("change", e => {
    ms.selectedStackUid = e.target.value || null;
    saveGame();
    renderMovementSystem();
  });
  $("#movementDestinationSelect")?.addEventListener("change", e => {
    ms.destinationRegionId = e.target.value;
    saveGame();
    renderMovementSystem();
  });
  $("#movementDeployBtn")?.addEventListener("click", () => dispatchMovement("redeploy"));
  $("#movementFrontBtn")?.addEventListener("click", () => {
    const front = ensureGroundWar()?.fronts?.find(f => f.status !== "withdrawn");
    if (front) {
      ms.destinationRegionId = "border";
      saveGame();
      dispatchMovement("front");
    }
  });
  $("#movementCancelBtn")?.addEventListener("click", cancelMovements);
}


function makeEnemyOffensiveSystem() {
  return {
    defenseReadiness: 48,
    active: [],
    history: [],
    alertLevel: 1
  };
}

function ensureEnemyOffensives() {
  if (!state.game) return null;
  if (!state.game.enemyOps) state.game.enemyOps = makeEnemyOffensiveSystem();
  const eo = state.game.enemyOps;
  if (!Array.isArray(eo.active)) eo.active = [];
  if (!Array.isArray(eo.history)) eo.history = [];
  eo.defenseReadiness = clamp(eo.defenseReadiness ?? 48, 0, 160);
  eo.alertLevel = clamp(eo.alertLevel ?? 1, 1, 5);
  return eo;
}

function enemyKindLabel(kind) {
  const labels = {
    air: t("defense.kind.air", "Ataque aéreo"),
    ground: t("defense.kind.ground", "Sondagem terrestre"),
    naval: t("defense.kind.naval", "Incursão naval"),
    missile: t("defense.kind.missile", "Alerta de míssil"),
    cyber: t("defense.kind.cyber", "Intrusão cyber")
  };
  return labels[kind] || kind;
}

function enemyKindIcon(kind) {
  return { air: "✈️", ground: "🪖", naval: "🚢", missile: "🚀", cyber: "🛰️" }[kind] || "⚠️";
}

function enemyTargetRegion(kind) {
  const regions = state.game.regions || [];
  if (kind === "naval") return regions.find(r => r.id === "coast") || regions[0];
  if (kind === "ground") return regions.find(r => r.id === "border") || regions[0];
  if (kind === "cyber") return regions.find(r => r.id === "industrial") || regions[0];
  return regions[Math.floor(Math.random() * regions.length)] || getSelectedRegion();
}

function recordEnemyDefenseHistory(entry) {
  const eo = ensureEnemyOffensives();
  eo.history.unshift({ id: cryptoId(), at: `${monthNames[state.game.month % 12]}/${state.game.year}`, ...entry });
  eo.history = eo.history.slice(0, 12);
}

function recordEnemyBattleScene(op, success, text) {
  const attacker = getCountry(op.attackerId);
  const region = getRegion(op.regionId);
  if (!attacker || !region) return;
  const player = getPlayerCountry();
  const scenes = ensureBattleScenes();
  const scene = {
    id: cryptoId(),
    kind: op.kind,
    icon: enemyKindIcon(op.kind),
    label: enemyKindLabel(op.kind),
    details: text || "",
    success: !!success,
    targetId: player.id,
    targetName: region.name,
    targetFlag: player.flag,
    fromCoords: attacker.coords,
    coords: jitter(region.coords, .5),
    intensity: clamp(op.strength, 12, 100),
    smoke: clamp(op.strength + randomInt(6, 22), 18, 100),
    fire: clamp(op.strength + (success ? 18 : 6), 10, 100),
    month: state.game.month,
    year: state.game.year,
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`,
    enemy: true,
    attackerName: attacker.name,
    attackerFlag: attacker.flag
  };
  scenes.unshift(scene);
  state.game.battleScenes = scenes.slice(0, 14);
}

function maybeSpawnEnemyOffensive() {
  const g = state.game;
  const eo = ensureEnemyOffensives();
  if (!g.aiWorld?.length || eo.active.length >= 3) return;
  const threats = topAiThreats(4).filter(ai => ai.hostility > 55 || g.worldTension > 58);
  if (!threats.length) return;
  const pressure = g.worldTension + (threats[0].hostility || 0) + (g.globalWar?.warScore || 0);
  const chance = clamp(Math.round(pressure / 4) - eo.active.length * 18, 8, 62);
  if (Math.random() * 100 > chance) return;
  const attackerAi = threats[Math.floor(Math.random() * Math.min(threats.length, 3))];
  const attacker = getCountry(attackerAi.id);
  if (!attacker) return;
  const kinds = ["air", "ground", "naval", "cyber", "missile"];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const region = enemyTargetRegion(kind);
  const strength = clamp(Math.round((attackerAi.power || attacker.military || 60) / 2 + attackerAi.hostility / 2 + Math.random() * 25), 22, 110);
  const op = {
    id: cryptoId(),
    kind,
    attackerId: attacker.id,
    attackerName: attacker.name,
    attackerFlag: attacker.flag,
    regionId: region.id,
    regionName: region.name,
    fromCoords: attacker.coords,
    toCoords: region.coords,
    strength,
    remaining: randomInt(1, 2),
    total: 2,
    progress: 0
  };
  eo.active.push(op);
  g.events.push(eventText("danger", `${attacker.name}: ${enemyKindLabel(kind)} detectado contra ${region.name}.`));
  recordEnemyDefenseHistory({ kind: "detected", label: `${enemyKindIcon(kind)} ${enemyKindLabel(kind)}`, text: `${attacker.name} → ${region.name}`, success: false, strength });
  recordEnemyBattleScene(op, false, t("defense.detected", "ameaça detectada"));
}

function resolveEnemyOffensive(op) {
  const g = state.game;
  const eo = ensureEnemyOffensives();
  const region = getRegion(op.regionId);
  const attacker = getCountry(op.attackerId);
  const regional = regionalDefense(region.id) + regionalAirCover(region.id) + regionalRadarCover(region.id);
  const domainDefense = op.kind === "air" ? (ensureAirWar()?.airDefense || 0) + g.airPower / 2
    : op.kind === "naval" ? (ensureNavalWar()?.seaControl || 0) + g.navalPower / 2
    : op.kind === "missile" ? (ensureMissileWar()?.shield || 0) + (ensureMissileWar()?.earlyWarning || 0) / 2
    : op.kind === "cyber" ? (ensureCyberOps()?.security || 0) + (ensureCyberOps()?.counterIntel || 0)
    : g.landPower / 2 + g.logistics / 3;
  const defenseScore = g.defense / 2 + regional / 2 + domainDefense / 2 + eo.defenseReadiness + Math.random() * 38;
  const attackScore = op.strength + Math.random() * 45;
  const intercepted = defenseScore >= attackScore;
  if (intercepted) {
    eo.defenseReadiness = clamp(eo.defenseReadiness + randomInt(2, 6), 0, 160);
    g.readiness = clamp(g.readiness + 1, 0, 100);
    const text = `${op.attackerName}: ${enemyKindLabel(op.kind)} ${t("defense.result.intercepted", "ameaça interceptada")} em ${region.name}.`;
    g.events.push(eventText("sistema", text));
    recordEnemyDefenseHistory({ kind: op.kind, label: `${enemyKindIcon(op.kind)} ${enemyKindLabel(op.kind)}`, text, success: true, strength: op.strength });
    recordEnemyBattleScene(op, false, text);
    return;
  }

  const damage = clamp(Math.round((attackScore - defenseScore) / 3) + randomInt(4, 16), 4, 35);
  const base = regionBases(region.id).sort((a,b)=>a.condition-b.condition)[0];
  if (base) base.condition = clamp(base.condition - damage, 0, 100);
  if (op.kind === "cyber") {
    g.intel = clamp(g.intel - randomInt(1, 5), 0, 160);
    g.cyber = clamp(g.cyber - randomInt(1, 4), 0, 160);
  } else if (op.kind === "missile") {
    g.energy = Math.max(0, g.energy - randomInt(8, 22));
    g.industry = Math.max(0, g.industry - randomInt(8, 20));
  } else {
    damageRegionalUnits(region.id, clamp(damage / 2, 3, 16), op.attackerName);
    g.readiness = clamp(g.readiness - randomInt(2, 6), 0, 100);
  }
  g.stability = clamp(g.stability - randomInt(1, 4), 0, 100);
  eo.defenseReadiness = clamp(eo.defenseReadiness - randomInt(2, 7), 0, 160);
  const text = `${op.attackerName}: ${enemyKindLabel(op.kind)} ${t("defense.result.hit", "ataque atingiu o alvo")} em ${region.name}. Dano ${damage}.`;
  g.events.push(eventText("danger", text));
  recordEnemyDefenseHistory({ kind: op.kind, label: `${enemyKindIcon(op.kind)} ${enemyKindLabel(op.kind)}`, text, success: false, strength: op.strength });
  recordEnemyBattleScene(op, true, text);
}

function progressEnemyOffensives() {
  const eo = ensureEnemyOffensives();
  if (!eo) return;
  maybeSpawnEnemyOffensive();
  const resolved = [];
  eo.active.forEach(op => {
    op.remaining -= 1;
    op.progress = clamp(100 - Math.round((op.remaining / Math.max(1, op.total)) * 100), 0, 100);
    if (op.remaining <= 0) resolved.push(op);
  });
  eo.active = eo.active.filter(op => op.remaining > 0);
  resolved.forEach(resolveEnemyOffensive);
  eo.alertLevel = clamp(1 + Math.round(eo.active.length + state.game.worldTension / 34), 1, 5);
}

function defenseAction(kind) {
  const g = state.game;
  const eo = ensureEnemyOffensives();
  const active = eo.active[0];
  const costs = {
    reinforce: { finance: 46, industry: 24, energy: 12 },
    intercept: { finance: 52, industry: 12, energy: 26 },
    alert: { finance: 28, industry: 8, energy: 10 }
  };
  const cost = costs[kind];
  if (g.finance < cost.finance || g.industry < cost.industry || g.energy < cost.energy) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Insufficient resources for defense action." : currentLang === "es-ES" ? "Recursos insuficientes para acción defensiva." : "Recursos insuficientes para ação defensiva."));
    saveGame(); renderGame(); return;
  }
  g.finance -= cost.finance; g.industry -= cost.industry; g.energy -= cost.energy;
  if (kind === "reinforce") {
    eo.defenseReadiness = clamp(eo.defenseReadiness + randomInt(8, 16), 0, 160);
    if (active) active.strength = clamp(active.strength - randomInt(4, 10), 1, 120);
    g.defense = clamp(g.defense + 1, 0, 220);
    g.events.push(eventText("sistema", currentLang === "en-US" ? "Regional defenses reinforced." : currentLang === "es-ES" ? "Defensas regionales reforzadas." : "Defesas regionais reforçadas."));
  }
  if (kind === "intercept") {
    if (active) {
      active.strength = clamp(active.strength - randomInt(12, 24) - Math.round(eo.defenseReadiness / 20), 1, 120);
      active.remaining = Math.max(0, active.remaining - 1);
      g.events.push(eventText("sistema", `${active.attackerName}: interceptação reduziu a ameaça para força ${active.strength}.`));
      if (active.remaining <= 0 || active.strength < 18) {
        eo.active = eo.active.filter(x => x.id !== active.id);
        recordEnemyDefenseHistory({ kind: active.kind, label: `${enemyKindIcon(active.kind)} ${enemyKindLabel(active.kind)}`, text: `${active.attackerName}: ameaça neutralizada antes do impacto.`, success: true, strength: active.strength });
        recordEnemyBattleScene(active, false, "ameaça neutralizada");
      }
    } else {
      eo.defenseReadiness = clamp(eo.defenseReadiness + 5, 0, 160);
    }
  }
  if (kind === "alert") {
    eo.alertLevel = clamp(eo.alertLevel + 1, 1, 5);
    eo.defenseReadiness = clamp(eo.defenseReadiness + randomInt(4, 9), 0, 160);
    g.readiness = clamp(g.readiness + 2, 0, 100);
    g.events.push(eventText("warn", currentLang === "en-US" ? "National alert raised." : currentLang === "es-ES" ? "Alerta nacional elevada." : "Alerta nacional elevada."));
  }
  saveGame();
  renderGame();
  activatePanel("panelDefense");
}

function renderEnemyOffensivesMap(player) {
  const eo = ensureEnemyOffensives();
  if (!state.map || !state.layers.battleEffects || !window.L || !eo) return;
  eo.active.forEach((op, index) => {
    const attacker = getCountry(op.attackerId);
    const region = getRegion(op.regionId);
    if (!attacker || !region) return;
    L.polyline([attacker.coords, region.coords], {
      color: "#ff355c",
      weight: 4,
      opacity: .72,
      dashArray: "7 9",
      className: "enemy-attack-route"
    }).addTo(state.layers.battleEffects).bindPopup(`<strong>${op.attackerFlag} ${op.attackerName}</strong><br>${enemyKindLabel(op.kind)} → ${region.name}`);
    const ratio = .34 + ((Date.now() / 6500 + index * .17) % .45);
    const point = interpolateCoords(attacker.coords, region.coords, ratio);
    const icon = L.divIcon({ className: "", html: `<div class="marker-enemy-offensive">${enemyKindIcon(op.kind)}</div>`, iconSize: [38, 38], iconAnchor: [19, 19] });
    L.marker(point, { icon }).addTo(state.layers.battleEffects).bindPopup(`${op.attackerName}: ${enemyKindLabel(op.kind)} · ${t("defense.strength","Força")} ${op.strength}`);
    const targetIcon = L.divIcon({ className: "", html: `<div class="marker-defense-target">🛡️</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    L.marker(region.coords, { icon: targetIcon }).addTo(state.layers.battleEffects).bindPopup(`${t("defense.targetRegion","Região alvo")}: ${region.name}`);
  });
}

function renderDefensePanel() {
  const panel = $("#defensePanel");
  if (!panel || !state.game) return;
  const eo = ensureEnemyOffensives();
  panel.innerHTML = `
    <div class="defense-readiness">
      <div><small>${t("defense.readiness","Prontidão defensiva")}</small><strong>${eo.defenseReadiness}</strong><span>Alerta ${eo.alertLevel}</span></div>
      <i><b style="width:${clamp(eo.defenseReadiness,0,100)}%"></b></i>
    </div>
    <div class="defense-actions">
      <button data-defense-action="reinforce">🛡️ ${t("defense.reinforce","Reforçar região")}</button>
      <button data-defense-action="intercept">🎯 ${t("defense.intercept","Interceptar ameaça")}</button>
      <button data-defense-action="alert">🚨 ${t("defense.alert","Alerta nacional")}</button>
    </div>
    <section class="defense-active">
      <h3>${t("defense.active","Ameaças ativas")}</h3>
      ${eo.active.length ? eo.active.map(op => `<article class="enemy-op-card">
        <b>${enemyKindIcon(op.kind)}</b>
        <div><strong>${op.attackerFlag || ""} ${op.attackerName}</strong><span>${enemyKindLabel(op.kind)} · ${op.regionName}</span><small>${t("defense.strength","Força")}: ${op.strength} · ${t("defense.eta","Impacto em")} ${op.remaining}m</small><i><em style="width:${op.progress || 0}%"></em></i></div>
      </article>`).join("") : `<p class="muted">${t("defense.noActive","Nenhuma ofensiva inimiga ativa.")}</p>`}
    </section>
    <section class="defense-history">
      <h3>${t("defense.history","Histórico defensivo")}</h3>
      ${eo.history.length ? eo.history.slice(0,7).map(item => `<article class="${item.success ? "success" : "failure"}"><strong>${item.label}</strong><span>${item.at} · ${item.text}</span><small>${t("defense.strength","Força")}: ${item.strength ?? "—"}</small></article>`).join("") : `<p class="muted">${t("defense.noHistory","Nenhuma ação defensiva registrada.")}</p>`}
    </section>`;
  $$("#defensePanel [data-defense-action]").forEach(btn => btn.addEventListener("click", () => defenseAction(btn.dataset.defenseAction)));
}


function makeCoalitionSystem() {
  return {
    selectedCandidateId: null,
    allies: [],
    support: [],
    history: [],
    coalitionReadiness: 0
  };
}

function ensureCoalition() {
  if (!state.game) return null;
  if (!state.game.coalition) state.game.coalition = makeCoalitionSystem();
  const co = state.game.coalition;
  if (!Array.isArray(co.allies)) co.allies = [];
  if (!Array.isArray(co.support)) co.support = [];
  if (!Array.isArray(co.history)) co.history = [];
  co.allies = co.allies.filter(id => getCountry(id) && id !== state.game.countryId);
  co.coalitionReadiness = clamp(co.coalitionReadiness ?? 0, 0, 180);
  const candidates = coalitionCandidates();
  if (!co.selectedCandidateId || !getCountry(co.selectedCandidateId) || co.selectedCandidateId === state.game.countryId) {
    co.selectedCandidateId = candidates[0]?.id || state.countries.find(c => c.id !== state.game.countryId)?.id;
  }
  return co;
}

function coalitionScore(country) {
  const g = state.game;
  const rel = g.relations?.find(r => r.id === country.id);
  const ai = g.aiWorld?.find(a => a.id === country.id);
  const sameBloc = country.bloc === getPlayerCountry().bloc ? 18 : 0;
  const posture = ai?.posture === "aliado" ? 16 : ai?.posture === "hostil" ? -26 : ai?.posture === "alerta" ? -8 : 6;
  return clamp((rel?.relation ?? 50) + sameBloc + posture - Math.round((rel?.tension ?? 30) / 5), 0, 100);
}

function coalitionCandidates(limit = 12) {
  return state.countries
    .filter(c => c.id !== state.game.countryId)
    .map(c => ({ ...c, coalitionScore: coalitionScore(c), relation: state.game.relations?.find(r => r.id === c.id), ai: state.game.aiWorld?.find(a => a.id === c.id) }))
    .sort((a,b) => b.coalitionScore - a.coalitionScore)
    .slice(0, limit);
}

function coalitionHistory(kind, country, text, success = true) {
  const co = ensureCoalition();
  co.history.unshift({
    id: cryptoId(),
    kind,
    countryId: country?.id,
    countryName: country?.name || "",
    countryFlag: country?.flag || "",
    text,
    success,
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`
  });
  co.history = co.history.slice(0, 12);
}

function selectedCoalitionCountry() {
  const co = ensureCoalition();
  return getCountry($("#coalitionCandidateSelect")?.value || co.selectedCandidateId);
}

function coalitionCost(kind) {
  const costs = {
    improve: { finance: 36, industry: 6, energy: 4 },
    invite: { finance: 58, industry: 10, energy: 8 },
    economic: { finance: 24, industry: 4, energy: 4 },
    military: { finance: 42, industry: 16, energy: 14 },
    defense: { finance: 48, industry: 12, energy: 18 }
  };
  return costs[kind] || costs.improve;
}

function payCoalitionCost(cost) {
  const g = state.game;
  if (g.finance < cost.finance || g.industry < cost.industry || g.energy < cost.energy) return false;
  g.finance -= cost.finance;
  g.industry -= cost.industry;
  g.energy -= cost.energy;
  return true;
}

function coalitionSupportLabel(kind) {
  if (kind === "economic") return t("coalition.support.economic", "apoio econômico");
  if (kind === "military") return t("coalition.support.military", "apoio militar");
  if (kind === "defense") return t("coalition.support.defense", "defesa coletiva");
  return kind;
}

function coalitionAction(kind) {
  const g = state.game;
  const co = ensureCoalition();
  const c = selectedCoalitionCountry();
  if (!c) return;
  co.selectedCandidateId = c.id;
  const cost = coalitionCost(kind);
  if (!payCoalitionCost(cost)) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Insufficient resources for coalition action." : currentLang === "es-ES" ? "Recursos insuficientes para acción de coalición." : "Recursos insuficientes para ação de coalizão."));
    saveGame(); renderGame(); return;
  }
  const rel = g.relations.find(r => r.id === c.id);
  const ai = g.aiWorld?.find(a => a.id === c.id);
  if (kind === "improve") {
    if (rel) { rel.relation = clamp(rel.relation + randomInt(8, 15), 0, 100); rel.tension = clamp(rel.tension - randomInt(3, 8), 0, 100); }
    if (ai) ai.hostility = clamp(ai.hostility - randomInt(2, 6), 0, 100);
    co.coalitionReadiness = clamp(co.coalitionReadiness + 2, 0, 180);
    const text = `${c.name}: relação diplomática melhorada.`;
    g.events.push(eventText("sistema", text));
    coalitionHistory(kind, c, text, true);
  }
  if (kind === "invite") {
    const chance = coalitionScore(c) + randomInt(-16, 18);
    if (chance >= 62 && !co.allies.includes(c.id)) {
      co.allies.push(c.id);
      co.coalitionReadiness = clamp(co.coalitionReadiness + 12 + Math.round((c.military || 50) / 8), 0, 180);
      if (rel) rel.relation = clamp(rel.relation + 8, 0, 100);
      if (ai) { ai.posture = "aliado"; ai.hostility = clamp(ai.hostility - 15, 0, 100); }
      const text = `${c.name}: entrou na coalizão.`;
      g.events.push(eventText("sistema", text));
      coalitionHistory(kind, c, text, true);
    } else {
      const text = `${c.name}: recusou aliança formal por enquanto.`;
      g.events.push(eventText("warn", text));
      coalitionHistory(kind, c, text, false);
      if (rel) rel.relation = clamp(rel.relation + 2, 0, 100);
    }
  }
  if (["economic", "military", "defense"].includes(kind)) {
    const isAlly = co.allies.includes(c.id);
    const score = coalitionScore(c) + (isAlly ? 24 : 0);
    if (score < 58) {
      const text = `${c.name}: apoio negado. Relação insuficiente.`;
      g.events.push(eventText("warn", text));
      coalitionHistory(kind, c, text, false);
    } else {
      const support = {
        id: cryptoId(),
        kind,
        allyId: c.id,
        allyName: c.name,
        allyFlag: c.flag,
        fromCoords: c.coords,
        toCoords: getPlayerCountry().coords,
        remaining: kind === "defense" ? 1 : 2,
        total: kind === "defense" ? 1 : 2,
        progress: 0,
        value: kind === "economic" ? randomInt(55, 120) : kind === "military" ? randomInt(2, 5) : randomInt(12, 26)
      };
      co.support.push(support);
      co.coalitionReadiness = clamp(co.coalitionReadiness + (kind === "defense" ? 8 : 5), 0, 180);
      const text = `${c.name}: ${coalitionSupportLabel(kind)} aprovado.`;
      g.events.push(eventText("sistema", text));
      coalitionHistory(kind, c, text, true);
    }
  }
  saveGame();
  renderGame();
  activatePanel("panelCoalition");
}

function progressCoalitionSupport() {
  const g = state.game;
  const co = ensureCoalition();
  if (!co) return;
  co.coalitionReadiness = clamp(co.coalitionReadiness + Math.round(co.allies.length / 2) - (g.worldTension > 75 ? 1 : 0), 0, 180);
  co.support.forEach(s => {
    s.remaining -= 1;
    s.progress = clamp(100 - Math.round((s.remaining / Math.max(1, s.total)) * 100), 0, 100);
  });
  const arrived = co.support.filter(s => s.remaining <= 0);
  co.support = co.support.filter(s => s.remaining > 0);
  arrived.forEach(s => {
    const ally = getCountry(s.allyId);
    if (s.kind === "economic") {
      g.finance += s.value;
      g.industry += Math.round(s.value * .45);
      g.energy += Math.round(s.value * .22);
    }
    if (s.kind === "military") {
      const units = state.units.filter(u => ["Terrestre","Aéreo"].includes(u.class));
      const u = units[randomInt(0, units.length - 1)];
      const region = getRegion("capital");
      const existing = g.units.find(x => x.id === u.id && x.regionId === region.id);
      if (existing) existing.qty += s.value;
      else g.units.push({ id: u.id, regionId: region.id, qty: s.value, veteran: 1, condition: 92, uid: cryptoId() });
      addUnitPower(u);
      g.readiness = clamp(g.readiness + 4, 0, 100);
    }
    if (s.kind === "defense") {
      const eo = ensureEnemyOffensives();
      const active = eo.active[0];
      eo.defenseReadiness = clamp(eo.defenseReadiness + s.value, 0, 180);
      if (active) active.strength = clamp(active.strength - s.value, 1, 120);
      g.defense = clamp(g.defense + 2, 0, 220);
    }
    const text = `${s.allyName}: ${coalitionSupportLabel(s.kind)} chegou.`;
    g.events.push(eventText("sistema", text));
    coalitionHistory("arrival", ally, text, true);
  });
}

function renderCoalitionMapOverlays(player) {
  const co = ensureCoalition();
  if (!state.map || !state.layers.tactical || !window.L || !co) return;
  co.allies.slice(0, 8).forEach(id => {
    const ally = getCountry(id);
    if (!ally) return;
    const icon = L.divIcon({ className: "", html: `<div class="marker-ally">${flagHtml(ally, "marker-flag-img")}</div>`, iconSize: [36,36], iconAnchor: [18,18] });
    L.marker(ally.coords, { icon }).addTo(state.layers.tactical).bindPopup(`<strong>${ally.flag} ${ally.name}</strong><br>${t("coalition.allies","Aliados")}`);
  });
  co.support.forEach((s, index) => {
    const to = s.toCoords || player.coords;
    L.polyline([s.fromCoords, to], { color: "#6affad", weight: 4, opacity: .72, dashArray: "10 12", className: "allied-route" }).addTo(state.layers.tactical)
      .bindPopup(`${t("coalition.route","Rota aliada")} · ${s.allyName}`);
    const ratio = clamp((s.total - s.remaining) / Math.max(1, s.total), .12, .88);
    const point = interpolateCoords(s.fromCoords, to, ratio);
    const icon = L.divIcon({ className: "", html: `<div class="marker-allied-support">${s.kind === "economic" ? "💰" : s.kind === "military" ? "🪖" : "🛡️"}</div>`, iconSize: [38,38], iconAnchor: [19,19] });
    L.marker(point, { icon }).addTo(state.layers.tactical).bindPopup(`${s.allyFlag} ${s.allyName}: ${coalitionSupportLabel(s.kind)} · ${t("coalition.arrives","Chega em")} ${s.remaining}m`);
  });
}

function renderCoalitionPanel() {
  const panel = $("#coalitionPanel");
  if (!panel || !state.game) return;
  const co = ensureCoalition();
  const candidates = coalitionCandidates(10);
  const allies = co.allies.map(getCountry).filter(Boolean);
  panel.innerHTML = `
    <div class="coalition-readiness">
      <div><small>${t("coalition.readiness","Força da coalizão")}</small><strong>${co.coalitionReadiness}</strong><span>${allies.length} ${t("coalition.allies","Aliados")}</span></div>
      <i><b style="width:${clamp(co.coalitionReadiness,0,100)}%"></b></i>
    </div>
    <div class="coalition-selector">
      <label><span>${t("coalition.candidates","Candidatos")}</span>
        <select id="coalitionCandidateSelect">
          ${candidates.map(c => `<option value="${c.id}" ${c.id === co.selectedCandidateId ? "selected" : ""}>${c.flag} ${c.name} · ${t("coalition.score","Aderência")} ${c.coalitionScore}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="coalition-actions">
      <button data-coalition-action="improve">🤝 ${t("coalition.improve","Melhorar relação")}</button>
      <button data-coalition-action="invite">📝 ${t("coalition.invite","Convidar aliança")}</button>
      <button data-coalition-action="economic">💰 ${t("coalition.economic","Pedir apoio econômico")}</button>
      <button data-coalition-action="military">🪖 ${t("coalition.military","Pedir apoio militar")}</button>
      <button data-coalition-action="defense">🛡️ ${t("coalition.defense","Defesa coletiva")}</button>
    </div>
    <section class="coalition-allies">
      <h3>${t("coalition.allies","Aliados")}</h3>
      ${allies.length ? allies.map(a => `<article><b>${flagHtml(a, "ally-flag-img")}</b><div><strong>${a.name}</strong><span>${a.bloc} · ${a.doctrine || ""}</span></div></article>`).join("") : `<p class="muted">${t("coalition.noAllies","Nenhum aliado formal ainda.")}</p>`}
    </section>
    <section class="coalition-support">
      <h3>${t("coalition.support","Apoios ativos")}</h3>
      ${co.support.length ? co.support.map(s => `<article><b>${s.kind === "economic" ? "💰" : s.kind === "military" ? "🪖" : "🛡️"}</b><div><strong>${s.allyFlag} ${s.allyName}</strong><span>${coalitionSupportLabel(s.kind)} · ${t("coalition.arrives","Chega em")} ${s.remaining}m</span><i><em style="width:${s.progress || 0}%"></em></i></div></article>`).join("") : `<p class="muted">${t("coalition.noSupport","Nenhum apoio aliado em trânsito.")}</p>`}
    </section>
    <section class="coalition-history">
      <h3>${t("coalition.history","Histórico aliado")}</h3>
      ${co.history.length ? co.history.slice(0,7).map(item => `<article class="${item.success ? "success" : "failure"}"><strong>${item.countryFlag || "🤝"} ${item.countryName || item.kind}</strong><span>${item.at} · ${item.text}</span></article>`).join("") : `<p class="muted">${t("coalition.noHistory","Nenhuma ação diplomática registrada.")}</p>`}
    </section>`;
  $("#coalitionCandidateSelect")?.addEventListener("change", e => {
    co.selectedCandidateId = e.target.value;
    saveGame();
    renderCoalitionPanel();
  });
  $$("#coalitionPanel [data-coalition-action]").forEach(btn => btn.addEventListener("click", () => coalitionAction(btn.dataset.coalitionAction)));
}



function weatherLabel(kind) {
  return {
    clear: t("environment.clear", "Céu limpo"),
    rain: t("environment.rain", "Chuva"),
    storm: t("environment.storm", "Tempestade"),
    fog: t("environment.fog", "Neblina"),
    heat: t("environment.heat", "Calor extremo"),
    cold: t("environment.cold", "Frio intenso"),
    sand: t("environment.sand", "Poeira/areia")
  }[kind] || kind;
}

function weatherIcon(kind) {
  return { clear: "☀️", rain: "🌧️", storm: "⛈️", fog: "🌫️", heat: "🔥", cold: "❄️", sand: "🌪️" }[kind] || "🌦️";
}

function weatherEffectText(kind) {
  const effects = {
    clear: currentLang === "en-US" ? "normal operations" : currentLang === "es-ES" ? "operaciones normales" : "operações normais",
    rain: currentLang === "en-US" ? "slower land movement and supply" : currentLang === "es-ES" ? "movimiento terrestre y suministros más lentos" : "movimento terrestre e suprimento mais lentos",
    storm: currentLang === "en-US" ? "air/naval risk and route delay" : currentLang === "es-ES" ? "riesgo aéreo/naval y retraso de rutas" : "risco aéreo/naval e atraso de rotas",
    fog: currentLang === "en-US" ? "lower air accuracy and reconnaissance" : currentLang === "es-ES" ? "menor precisión aérea y reconocimiento" : "menor precisão aérea e reconhecimento",
    heat: currentLang === "en-US" ? "higher fatigue and fuel pressure" : currentLang === "es-ES" ? "más fatiga y presión de combustible" : "mais fadiga e pressão de combustível",
    cold: currentLang === "en-US" ? "equipment wear and slower recovery" : currentLang === "es-ES" ? "desgaste de equipos y recuperación lenta" : "desgaste de equipamentos e recuperação lenta",
    sand: currentLang === "en-US" ? "radar/air penalties and maintenance pressure" : currentLang === "es-ES" ? "penaliza radar/aviación y mantenimiento" : "penaliza radar/aviação e manutenção"
  };
  return effects[kind] || effects.clear;
}

function terrainOperationalModifier(region) {
  const terrain = (region?.terrain || "").toLowerCase();
  let mod = 0;
  if (terrain.includes("litoral") || terrain.includes("porto")) mod += 4;
  if (terrain.includes("fábrica") || terrain.includes("logística")) mod += 3;
  if (terrain.includes("fronteira")) mod -= 2;
  if (terrain.includes("corredor")) mod += 1;
  return mod + (region?.logistics || 0) - Math.max(0, 5 - (region?.defenseBonus || 0));
}

function generateRegionWeather(region, month = 0) {
  const season = month % 12;
  const kindPool = ["clear","rain","fog","heat","cold"];
  if (region?.kind === "Naval") kindPool.push("storm","storm");
  if (region?.kind === "Fronteira") kindPool.push("sand","cold");
  if ([5,6,7].includes(season)) kindPool.push("cold","fog");
  if ([11,0,1].includes(season)) kindPool.push("heat","storm");
  const kind = kindPool[randomInt(0, kindPool.length - 1)];
  const baseSeverity = kind === "clear" ? randomInt(0, 12) : kind === "storm" ? randomInt(42, 82) : randomInt(18, 64);
  return {
    regionId: region.id,
    kind,
    severity: clamp(baseSeverity - terrainOperationalModifier(region), 0, 100),
    forecast: randomInt(1, 3),
    updated: `${monthNames[state.game?.month % 12 || 0]}/${state.game?.year || 2027}`
  };
}

function makeEnvironmentSystem(regions = [], country = null) {
  return {
    preparedness: 28,
    fatigue: 10,
    forecastQuality: 30 + Math.round((country?.intel || 40) / 6),
    lastAction: null,
    history: [],
    weather: regions.map((r, idx) => {
      const w = generateRegionWeather(r, idx);
      if (idx === 0) { w.kind = "clear"; w.severity = 6; }
      return w;
    })
  };
}

function ensureEnvironmentSystem() {
  if (!state.game) return null;
  if (!state.game.environmentSystem) state.game.environmentSystem = makeEnvironmentSystem(state.game.regions, getPlayerCountry());
  const es = state.game.environmentSystem;
  if (!Array.isArray(es.weather)) es.weather = [];
  if (!Array.isArray(es.history)) es.history = [];
  state.game.regions.forEach(r => {
    if (!es.weather.find(w => w.regionId === r.id)) es.weather.push(generateRegionWeather(r, state.game.month));
  });
  es.preparedness = clamp(es.preparedness ?? 28, 0, 160);
  es.fatigue = clamp(es.fatigue ?? 10, 0, 100);
  es.forecastQuality = clamp(es.forecastQuality ?? 30, 0, 160);
  return es;
}

function regionWeather(regionId) {
  const es = ensureEnvironmentSystem();
  return es?.weather?.find(w => w.regionId === regionId) || generateRegionWeather(getRegion(regionId), state.game.month);
}

function severeWeatherScore() {
  const es = ensureEnvironmentSystem();
  if (!es?.weather?.length) return 0;
  return Math.round(es.weather.reduce((sum, w) => sum + (w.severity || 0), 0) / es.weather.length);
}

function recordEnvironmentHistory(kind, text, regionId = null) {
  const es = ensureEnvironmentSystem();
  es.history.unshift({
    id: cryptoId(),
    kind,
    text,
    regionName: regionId ? getRegion(regionId)?.name : "",
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`
  });
  es.history = es.history.slice(0, 12);
}

function progressEnvironmentSystem() {
  const g = state.game;
  const es = ensureEnvironmentSystem();
  es.weather = state.game.regions.map(r => {
    const prev = es.weather.find(w => w.regionId === r.id);
    const keep = prev && Math.random() < .42;
    const next = keep ? { ...prev, severity: clamp(prev.severity + randomInt(-12, 14), 0, 100), forecast: Math.max(1, (prev.forecast || 2) - 1), updated: `${monthNames[g.month % 12]}/${g.year}` } : generateRegionWeather(r, g.month);
    return next;
  });
  const severity = severeWeatherScore();
  const unprepared = Math.max(0, severity - es.preparedness);
  es.fatigue = clamp(es.fatigue + Math.round(unprepared / 18) - Math.round(es.preparedness / 80), 0, 100);
  if (unprepared > 20) {
    g.logistics = clamp(g.logistics - Math.round(unprepared / 35), 0, 220);
    g.readiness = clamp(g.readiness - Math.round(unprepared / 28), 0, 100);
  }
  ensureGroundWar()?.fronts?.filter(f => f.status !== "withdrawn").forEach(f => {
    const w = regionWeather("border");
    if (w.severity > 50) {
      f.supply = clamp(f.supply - Math.round((w.severity - es.preparedness) / 24), 0, 100);
      f.progress = clamp(f.progress - Math.max(0, Math.round((w.severity - es.preparedness) / 40)), 0, 100);
    }
  });
  if (severity > 58 && Math.random() < .35) {
    const worst = [...es.weather].sort((a,b)=>b.severity-a.severity)[0];
    g.events.push(eventText("warn", `${getRegion(worst.regionId).name}: ${weatherLabel(worst.kind)} severo afetou operações.`));
  }
}

function environmentAction(kind) {
  const g = state.game;
  const es = ensureEnvironmentSystem();
  const costs = {
    refresh: { finance: 18, industry: 3, energy: 6 },
    prepare: { finance: 48, industry: 22, energy: 12 },
    routes: { finance: 44, industry: 16, energy: 18 },
    window: { finance: 34, industry: 6, energy: 10 }
  };
  const cost = costs[kind] || costs.refresh;
  if (g.finance < cost.finance || g.industry < cost.industry || g.energy < cost.energy) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Insufficient resources for environmental action." : currentLang === "es-ES" ? "Recursos insuficientes para acción ambiental." : "Recursos insuficientes para ação ambiental."));
    saveGame(); renderGame(); return;
  }
  g.finance -= cost.finance; g.industry -= cost.industry; g.energy -= cost.energy;
  let text = "";
  if (kind === "refresh") {
    es.forecastQuality = clamp(es.forecastQuality + randomInt(8, 16), 0, 160);
    text = currentLang === "en-US" ? "Forecast network updated." : currentLang === "es-ES" ? "Red de pronóstico actualizada." : "Rede de previsão atualizada.";
  }
  if (kind === "prepare") {
    es.preparedness = clamp(es.preparedness + randomInt(10, 20), 0, 160);
    es.fatigue = clamp(es.fatigue - randomInt(4, 10), 0, 100);
    g.readiness = clamp(g.readiness + 2, 0, 100);
    text = currentLang === "en-US" ? "Troops equipped for severe weather." : currentLang === "es-ES" ? "Tropas equipadas para clima severo." : "Tropas equipadas para clima severo.";
  }
  if (kind === "routes") {
    es.preparedness = clamp(es.preparedness + randomInt(6, 12), 0, 160);
    g.logistics = clamp(g.logistics + randomInt(2, 5), 0, 220);
    const ls = ensureLogisticsSystem();
    if (ls) ls.bottleneck = clamp(ls.bottleneck - randomInt(3, 8), 0, 100);
    text = currentLang === "en-US" ? "Alternative routes reduced weather bottlenecks." : currentLang === "es-ES" ? "Rutas alternativas redujeron cuellos climáticos." : "Rotas alternativas reduziram gargalos climáticos.";
  }
  if (kind === "window") {
    const selected = regionWeather(state.game.selectedRegionId);
    selected.severity = clamp(selected.severity - randomInt(12, 24), 0, 100);
    es.forecastQuality = clamp(es.forecastQuality + 5, 0, 160);
    text = `${getSelectedRegion().name}: ${currentLang === "en-US" ? "favorable operational window identified." : currentLang === "es-ES" ? "ventana operativa favorable identificada." : "janela operacional favorável identificada."}`;
  }
  es.lastAction = kind;
  recordEnvironmentHistory(kind, text, state.game.selectedRegionId);
  g.events.push(eventText("sistema", text));
  saveGame();
  renderGame();
  activatePanel("panelEnvironment");
}

function renderEnvironmentMapOverlays(player) {
  const es = ensureEnvironmentSystem();
  if (!state.map || !state.layers.weather || !window.L || !es) return;
  es.weather.forEach(w => {
    const region = getRegion(w.regionId);
    if (!region) return;
    const icon = L.divIcon({
      className: "",
      html: `<div class="marker-weather ${w.kind}"><b>${weatherIcon(w.kind)}</b><i>${w.severity}</i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    L.marker(jitter(region.coords, .22), { icon }).addTo(state.layers.weather)
      .bindPopup(`<strong>${weatherIcon(w.kind)} ${weatherLabel(w.kind)}</strong><br>${region.name}<br>${t("environment.severity","Severidade")}: ${w.severity}<br>${weatherEffectText(w.kind)}`);
    if (w.severity > 45) {
      L.circle(region.coords, {
        radius: 45000 + w.severity * 1300,
        color: w.kind === "storm" ? "#8fd3ff" : w.kind === "heat" ? "#ff784f" : w.kind === "cold" ? "#b8e8ff" : "#ffd166",
        fillColor: w.kind === "storm" ? "#5f9dff" : w.kind === "heat" ? "#ff784f" : w.kind === "cold" ? "#b8e8ff" : "#ffd166",
        fillOpacity: .06,
        opacity: .38,
        weight: 2,
        className: "weather-zone-ring"
      }).addTo(state.layers.weather).bindPopup(`${t("environment.mapLayer","Clima/terreno")} · ${region.name}`);
    }
  });
}

function renderEnvironmentPanel() {
  const panel = $("#environmentPanel");
  if (!panel || !state.game) return;
  const es = ensureEnvironmentSystem();
  const worst = [...es.weather].sort((a,b)=>b.severity-a.severity)[0];
  panel.innerHTML = `
    <div class="environment-status">
      <div><small>${t("environment.forecast","Previsão")}</small><strong>${es.forecastQuality}</strong><span>${weatherIcon(worst?.kind)} ${worst ? weatherLabel(worst.kind) : "—"}</span></div>
      <div><small>${t("environment.preparedness","Preparação")}</small><strong>${es.preparedness}</strong><span>${t("environment.fatigue","Fadiga climática")}: ${es.fatigue}</span></div>
    </div>
    <div class="environment-actions">
      <button data-environment-action="refresh">🛰️ ${t("environment.refresh","Atualizar previsão")}</button>
      <button data-environment-action="prepare">🧥 ${t("environment.prepare","Preparar tropas")}</button>
      <button data-environment-action="routes">🚚 ${t("environment.routes","Rotas alternativas")}</button>
      <button data-environment-action="window">⏱️ ${t("environment.window","Janela favorável")}</button>
    </div>
    <section class="environment-regions">
      <h3>${t("environment.regions","Zonas operacionais")}</h3>
      ${state.game.regions.map(r => {
        const w = regionWeather(r.id);
        return `<article class="${w.kind}"><b>${weatherIcon(w.kind)}</b><div><strong>${r.name}</strong><span>${t("environment.condition","Condição")}: ${weatherLabel(w.kind)} · ${t("environment.severity","Severidade")}: ${w.severity}</span><small>${t("environment.terrain","Terreno")}: ${r.terrain} · ${t("environment.effect","Efeito")}: ${weatherEffectText(w.kind)}</small><i><em style="width:${clamp(w.severity,0,100)}%"></em></i></div></article>`;
      }).join("")}
    </section>
    <section class="environment-history">
      <h3>${t("environment.history","Histórico ambiental")}</h3>
      ${es.history.length ? es.history.slice(0,7).map(item => `<article><strong>${item.regionName || t("environment.title","Clima e Terreno")}</strong><span>${item.at} · ${item.text}</span></article>`).join("") : `<p class="muted">${t("environment.noHistory","Nenhuma ação ambiental registrada.")}</p>`}
    </section>`;
  $$("#environmentPanel [data-environment-action]").forEach(btn => btn.addEventListener("click", () => environmentAction(btn.dataset.environmentAction)));
}


function makeIntelSystem(country = null) {
  return {
    confidence: clamp(34 + Math.round((country?.intel || 40) / 4), 0, 160),
    satellite: clamp(24 + Math.round((country?.cyber || 30) / 6), 0, 160),
    sigint: clamp(22 + Math.round((country?.intel || 30) / 5), 0, 160),
    fog: 68,
    selectedTargetId: null,
    scans: [],
    history: []
  };
}

function ensureIntelSystem() {
  if (!state.game) return null;
  if (!state.game.intelSystem) state.game.intelSystem = makeIntelSystem(getPlayerCountry());
  const intel = state.game.intelSystem;
  if (!Array.isArray(intel.scans)) intel.scans = [];
  if (!Array.isArray(intel.history)) intel.history = [];
  intel.confidence = clamp(intel.confidence ?? 40, 0, 160);
  intel.satellite = clamp(intel.satellite ?? 25, 0, 160);
  intel.sigint = clamp(intel.sigint ?? 25, 0, 160);
  intel.fog = clamp(intel.fog ?? 60, 0, 100);
  const target = topAiThreats(1)[0];
  if (!intel.selectedTargetId || !getCountry(intel.selectedTargetId) || intel.selectedTargetId === state.game.countryId) {
    intel.selectedTargetId = target?.id || state.countries.find(c => c.id !== state.game.countryId)?.id;
  }
  return intel;
}

function intelTargets() {
  ensureAiWorld();
  return topAiThreats(14).map(ai => {
    const c = getCountry(ai.id);
    return c ? { ...c, ai, intelScore: clamp((ai.power + ai.hostility + ai.readiness) / 3, 0, 100) } : null;
  }).filter(Boolean);
}

function intelCost(kind) {
  return {
    scan: { finance: 34, industry: 5, energy: 18 },
    recon: { finance: 42, industry: 8, energy: 20 },
    signal: { finance: 36, industry: 6, energy: 14 },
    counter: { finance: 30, industry: 10, energy: 10 }
  }[kind] || { finance: 20, industry: 4, energy: 8 };
}

function intelLabel(kind) {
  return {
    scan: t("intel.scan", "Varredura por satélite"),
    recon: t("intel.recon", "Reconhecimento avançado"),
    signal: t("intel.signal", "Interceptar comunicações"),
    counter: t("intel.counter", "Contraespionagem")
  }[kind] || kind;
}

function recordIntelHistory(kind, target, text, success = true) {
  const intel = ensureIntelSystem();
  const item = {
    id: cryptoId(),
    kind,
    label: intelLabel(kind),
    targetId: target?.id,
    targetName: target?.name || "",
    targetFlag: target?.flag || "",
    text,
    success,
    coords: target?.coords ? jitter(target.coords, .55) : null,
    at: `${monthNames[state.game.month % 12]}/${state.game.year}`
  };
  intel.history.unshift(item);
  intel.history = intel.history.slice(0, 12);
  if (item.coords) {
    intel.scans.unshift(item);
    intel.scans = intel.scans.slice(0, 8);
  }
}

function intelOperation(kind) {
  const g = state.game;
  const intel = ensureIntelSystem();
  const targetId = $("#intelTargetSelect")?.value || intel.selectedTargetId;
  const target = getCountry(targetId);
  if (!target) return;
  intel.selectedTargetId = target.id;
  const cost = intelCost(kind);
  if (g.finance < cost.finance || g.industry < cost.industry || g.energy < cost.energy) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Insufficient resources for intelligence operation." : currentLang === "es-ES" ? "Recursos insuficientes para operación de inteligencia." : "Recursos insuficientes para operação de inteligência."));
    saveGame(); renderGame(); return;
  }
  g.finance -= cost.finance;
  g.industry -= cost.industry;
  g.energy -= cost.energy;
  const ai = g.aiWorld?.find(a => a.id === target.id);
  let text = "";
  if (kind === "scan") {
    intel.satellite = clamp(intel.satellite + randomInt(8, 15), 0, 160);
    intel.confidence = clamp(intel.confidence + randomInt(5, 10), 0, 160);
    intel.fog = clamp(intel.fog - randomInt(8, 16), 0, 100);
    g.intel = clamp(g.intel + 2, 0, 160);
    text = `${target.name}: satélites atualizaram posição de bases, rotas e mobilização.`;
  }
  if (kind === "recon") {
    intel.confidence = clamp(intel.confidence + randomInt(7, 14), 0, 160);
    intel.fog = clamp(intel.fog - randomInt(6, 12), 0, 100);
    if (ai) ai.readiness = clamp(ai.readiness - randomInt(1, 4), 1, 100);
    g.readiness = clamp(g.readiness + 1, 0, 100);
    text = `${target.name}: reconhecimento avançado reduziu incerteza operacional.`;
  }
  if (kind === "signal") {
    intel.sigint = clamp(intel.sigint + randomInt(9, 16), 0, 160);
    intel.confidence = clamp(intel.confidence + randomInt(4, 8), 0, 160);
    intel.fog = clamp(intel.fog - randomInt(4, 10), 0, 100);
    if (ai) ai.hostility = clamp(ai.hostility - randomInt(1, 3), 0, 100);
    const eo = ensureEnemyOffensives();
    eo.active.slice(0,1).forEach(op => op.strength = clamp(op.strength - randomInt(3, 8), 1, 120));
    text = `${target.name}: comunicações interceptadas melhoraram alerta antecipado.`;
  }
  if (kind === "counter") {
    intel.confidence = clamp(intel.confidence + randomInt(3, 7), 0, 160);
    intel.fog = clamp(intel.fog - randomInt(2, 5), 0, 100);
    const cyber = ensureCyberOps();
    cyber.security = clamp(cyber.security + randomInt(5, 12), 0, 160);
    cyber.counterIntel = clamp(cyber.counterIntel + randomInt(4, 9), 0, 160);
    text = `Contraespionagem reforçou segurança interna e reduziu risco de surpresa.`;
  }
  recordIntelHistory(kind, target, text, true);
  g.events.push(eventText("sistema", text));
  saveGame();
  renderGame();
  activatePanel("panelIntel");
}

function progressIntelSystem() {
  const intel = ensureIntelSystem();
  if (!intel) return;
  const threat = topAiThreats(1)[0];
  const pressure = (state.game.worldTension || 0) + (threat?.hostility || 0);
  intel.fog = clamp(intel.fog + Math.round(pressure / 70) - Math.round((intel.satellite + intel.sigint + intel.confidence) / 180), 0, 100);
  intel.confidence = clamp(intel.confidence - (intel.fog > 70 ? 2 : 0) + (intel.sigint > 80 ? 1 : 0), 0, 160);
  if (intel.fog > 76 && Math.random() < .22) {
    state.game.events.push(eventText("warn", currentLang === "en-US" ? "Fog of war increased uncertainty around rival intentions." : currentLang === "es-ES" ? "La niebla de guerra aumentó la incertidumbre sobre rivales." : "Névoa de guerra aumentou a incerteza sobre intenções rivais."));
  }
}

function renderIntelMapOverlays(player) {
  const intel = ensureIntelSystem();
  if (!state.map || !state.layers.intel || !window.L || !intel) return;
  intel.scans.slice(0,8).forEach((scan, index) => {
    if (!scan.coords) return;
    const icon = L.divIcon({ className: "", html: `<div class="marker-intel-scan">🛰️</div>`, iconSize: [38, 38], iconAnchor: [19, 19] });
    L.marker(scan.coords, { icon }).addTo(state.layers.intel).bindPopup(`<strong>${scan.targetFlag || ""} ${scan.targetName}</strong><br>${scan.label}<br>${scan.text}`);
    L.circle(scan.coords, { radius: 85000 + index * 9000, color: "#9b7cff", fillColor: "#9b7cff", fillOpacity: .05, opacity: .34, weight: 2, className: "intel-scan-ring" }).addTo(state.layers.intel);
    if (player?.coords) L.polyline([player.coords, scan.coords], { color: "#9b7cff", weight: 3, opacity: .55, dashArray: "4 9", className: "intel-scan-route" }).addTo(state.layers.intel);
  });
}

function renderAdvancedIntelPanel() {
  const panel = $("#advancedIntelPanel");
  if (!panel || !state.game) return;
  const intel = ensureIntelSystem();
  const targets = intelTargets();
  const target = getCountry(intel.selectedTargetId) || targets[0];
  panel.innerHTML = `
    <div class="advanced-intel-status">
      <div><small>${t("intel.confidence", "Confiança")}</small><strong>${intel.confidence}</strong><i><b style="width:${clamp(intel.confidence,0,100)}%"></b></i></div>
      <div><small>${t("intel.satellite", "Satélites")}</small><strong>${intel.satellite}</strong><i><b style="width:${clamp(intel.satellite,0,100)}%"></b></i></div>
      <div><small>${t("intel.sigint", "SIGINT")}</small><strong>${intel.sigint}</strong><i><b style="width:${clamp(intel.sigint,0,100)}%"></b></i></div>
      <div><small>${t("intel.fog", "Névoa de guerra")}</small><strong>${intel.fog}%</strong><i><b style="width:${clamp(intel.fog,0,100)}%"></b></i></div>
    </div>
    <label class="intel-target"><span>${t("intel.target", "Alvo de inteligência")}</span>
      <select id="intelTargetSelect">
        ${targets.map(c => `<option value="${c.id}" ${c.id === intel.selectedTargetId ? "selected" : ""}>${c.flag} ${c.name} · ${t("intel.confidence","Confiança")} ${c.intelScore}</option>`).join("")}
      </select>
    </label>
    <div class="intel-actions">
      <button data-intel-action="scan">🛰️ ${t("intel.scan", "Varredura por satélite")}</button>
      <button data-intel-action="recon">🔭 ${t("intel.recon", "Reconhecimento avançado")}</button>
      <button data-intel-action="signal">📡 ${t("intel.signal", "Interceptar comunicações")}</button>
      <button data-intel-action="counter">🛡️ ${t("intel.counter", "Contraespionagem")}</button>
    </div>
    <section class="intel-history">
      <h3>${t("intel.history", "Histórico de inteligência")}</h3>
      ${intel.history.length ? intel.history.slice(0,7).map(item => `<article class="${item.success ? "success" : "failure"}"><strong>${item.targetFlag || "🛰️"} ${item.label}</strong><span>${item.at} · ${item.targetName}</span><small>${item.text}</small></article>`).join("") : `<p class="muted">${t("intel.noHistory", "Nenhuma operação de inteligência registrada.")}</p>`}
    </section>`;
  $("#intelTargetSelect")?.addEventListener("change", e => {
    intel.selectedTargetId = e.target.value;
    saveGame();
    renderAdvancedIntelPanel();
  });
  $$("#advancedIntelPanel [data-intel-action]").forEach(btn => btn.addEventListener("click", () => intelOperation(btn.dataset.intelAction)));
}

function makeMapSettings() {
  return {
    countries: true,
    regions: true,
    bases: true,
    threats: true,
    fronts: true,
    airOps: true,
    navalOps: true,
    missiles: true,
    logistics: true,
    tactical: true,
    battleEffects: true,
    weather: true,
    intel: true,
    tech: true
  };
}

function ensureMapSettings() {
  if (!state.game) return makeMapSettings();
  if (!state.game.mapSettings) state.game.mapSettings = makeMapSettings();
  const defaults = makeMapSettings();
  Object.keys(defaults).forEach(key => {
    if (typeof state.game.mapSettings[key] !== "boolean") state.game.mapSettings[key] = defaults[key];
  });
  return state.game.mapSettings;
}

function mapLayerMeta() {
  return [
    ["countries", t("mapops.country", "Países"), "🏳️"],
    ["regions", t("mapops.regions", "Regiões"), "◎"],
    ["bases", t("mapops.bases", "Bases"), "🏗️"],
    ["threats", t("mapops.threats", "Crises"), "⚠️"],
    ["fronts", t("mapops.fronts", "Frentes"), "⚔️"],
    ["airOps", t("mapops.air", "Aérea"), "✈️"],
    ["navalOps", t("mapops.naval", "Naval"), "⚓"],
    ["missiles", t("mapops.missiles", "Mísseis"), "🚀"],
    ["logistics", t("mapops.logisticLayer", "Logística"), "🚚"],
    ["tactical", t("mapops.tactical", "Tropas/rotas"), "🪖"],
    ["battleEffects", t("mapops.battleEffects", "Batalha/ameaças"), "🔥"],
    ["weather", t("mapops.weather", "Clima"), "🌦️"],
    ["intel", t("mapops.intelLayer", "Inteligência"), "🛰️"],
    ["tech", t("mapops.tech", "Tecnologia"), "🧪"]
  ];
}

function applyMapLayerVisibility() {
  if (!state.map || !state.layers || !state.game) return;
  const settings = ensureMapSettings();
  Object.entries(state.layers).forEach(([key, layer]) => {
    if (!layer) return;
    const shouldShow = settings[key] !== false;
    const isShown = state.map.hasLayer(layer);
    if (shouldShow && !isShown) layer.addTo(state.map);
    if (!shouldShow && isShown) state.map.removeLayer(layer);
  });
}

function setMapPreset(preset) {
  const s = ensureMapSettings();
  Object.keys(s).forEach(k => s[k] = false);
  if (preset === "clean") {
    ["countries","regions","bases","weather"].forEach(k => s[k] = true);
  } else if (preset === "battle") {
    ["countries","regions","bases","fronts","airOps","navalOps","missiles","tactical","battleEffects","weather"].forEach(k => s[k] = true);
  } else if (preset === "logistics") {
    ["countries","regions","bases","navalOps","logistics","tactical","weather"].forEach(k => s[k] = true);
  } else {
    Object.keys(s).forEach(k => s[k] = true);
  }
  saveGame();
  renderGame();
  activatePanel("panelMapOps");
}

function toggleMapLayer(key) {
  const s = ensureMapSettings();
  s[key] = !s[key];
  saveGame();
  applyMapLayerVisibility();
  renderMapOpsPanel();
}

function mapFitCoords(coords, zoom = 4) {
  if (!state.map || !coords.length) return;
  state.mapUserMoved = true;
  if (coords.length === 1) state.map.setView(coords[0], zoom, { animate: true });
  else state.map.fitBounds(coords, { padding: [30, 30], maxZoom: 5, animate: true });
  setTimeout(() => state.map?.invalidateSize(), 60);
}

function focusMap(kind) {
  const player = getPlayerCountry();
  const coords = [];
  if (kind === "player") {
    coords.push(player.coords, ...state.game.regions.map(r => r.coords), ...state.game.bases.map(b => b.coords));
  }
  if (kind === "threats") {
    ensureEnemyOffensives()?.active?.forEach(op => { if (op.fromCoords) coords.push(op.fromCoords); if (op.toCoords) coords.push(op.toCoords); });
    state.game.threats?.forEach(th => coords.push(th.coords));
    topAiThreats(4).forEach(ai => { const c = getCountry(ai.id); if (c) coords.push(c.coords); });
  }
  if (kind === "allies") {
    ensureCoalition()?.allies?.forEach(id => { const c = getCountry(id); if (c) coords.push(c.coords); });
    ensureCoalition()?.support?.forEach(s => { if (s.fromCoords) coords.push(s.fromCoords); if (s.toCoords) coords.push(s.toCoords); });
    if (!coords.length) coords.push(player.coords);
  }
  if (kind === "fronts") {
    ensureGroundWar()?.fronts?.forEach(f => { if (f.coords) coords.push(f.coords); const c = getCountry(f.targetId); if (c) coords.push(c.coords); });
    if (!coords.length) coords.push(player.coords);
  }
  if (kind === "weather") {
    ensureEnvironmentSystem()?.weather?.forEach(w => { const r = getRegion(w.regionId); if (r) coords.push(r.coords); });
    if (!coords.length) coords.push(player.coords);
  }
  if (kind === "intel") {
    ensureIntelSystem()?.scans?.forEach(s => { if (s.coords) coords.push(s.coords); });
    if (!coords.length) topAiThreats(4).forEach(ai => { const c = getCountry(ai.id); if (c) coords.push(c.coords); });
    if (!coords.length) coords.push(player.coords);
  }
  if (kind === "tech") {
    const cap = getRegion("capital")?.coords || player.coords;
    const ind = getRegion("industrial")?.coords || jitter(cap, 1.2);
    coords.push(cap, ind);
  }
  mapFitCoords(coords.length ? coords : [player.coords], kind === "player" ? 4 : 3);
}

function mapOpsIntelText() {
  const eo = ensureEnemyOffensives();
  const co = ensureCoalition();
  const gw = ensureGroundWar();
  const scenes = ensureBattleScenes();
  const activeLayers = Object.values(ensureMapSettings()).filter(Boolean).length;
  const parts = [];
  if (eo?.active?.length) parts.push(`${eo.active.length} ${t("defense.active", "Ameaças ativas").toLowerCase()}`);
  if (gw?.fronts?.length) parts.push(`${gw.fronts.length} ${t("mapops.fronts", "Frentes").toLowerCase()}`);
  if (co?.support?.length) parts.push(`${co.support.length} ${t("coalition.support", "Apoios ativos").toLowerCase()}`);
  if (scenes?.length) parts.push(`${scenes.length} ${t("battlefield.effects", "Efeitos visuais").toLowerCase()}`);
  const severity = severeWeatherScore();
  if (severity > 35) parts.push(`${t("mapops.weather", "Clima").toLowerCase()} ${severity}`);
  const intelSystem = ensureIntelSystem();
  if (intelSystem?.fog > 50) parts.push(`${t("intel.fog", "Névoa de guerra").toLowerCase()} ${intelSystem.fog}%`);
  const techSystem = ensureTechSystem();
  if (techSystem) parts.push(`${t("mapops.tech", "Tecnologia").toLowerCase()} ${techPowerIndex()}`);
  return parts.length ? parts.join(" · ") : `${activeLayers} ${t("mapops.activeLayers", "Camadas ativas").toLowerCase()}`;
}

function renderMapOpsPanel() {
  const panel = $("#mapOpsPanel");
  if (!panel || !state.game) return;
  const settings = ensureMapSettings();
  const layers = mapLayerMeta();
  const activeCount = layers.filter(([key]) => settings[key]).length;
  panel.innerHTML = `
    <section class="mapops-status">
      <div><small>${t("mapops.intel", "Leitura estratégica")}</small><strong>${mapOpsIntelText()}</strong><span>${activeCount}/${layers.length} ${t("mapops.activeLayers", "Camadas ativas")}</span></div>
    </section>
    <section class="mapops-presets">
      <h3>${t("mapops.presets", "Presets")}</h3>
      <div class="mapops-button-row">
        <button data-map-preset="all">🌍 ${t("mapops.all", "Guerra total")}</button>
        <button data-map-preset="clean">🧭 ${t("mapops.clean", "Mapa limpo")}</button>
        <button data-map-preset="battle">🔥 ${t("mapops.battle", "Combate")}</button>
        <button data-map-preset="logistics">🚚 ${t("mapops.logistics", "Logística")}</button>
      </div>
    </section>
    <section class="mapops-focus">
      <h3>${t("mapops.focus", "Foco rápido")}</h3>
      <div class="mapops-button-row">
        <button data-map-focus="player">🏳️ ${t("mapops.focusPlayer", "Meu país")}</button>
        <button data-map-focus="threats">⚠️ ${t("mapops.focusThreats", "Ameaças")}</button>
        <button data-map-focus="allies">🤝 ${t("mapops.focusAllies", "Aliados")}</button>
        <button data-map-focus="fronts">⚔️ ${t("mapops.focusFronts", "Frentes")}</button>
        <button data-map-focus="weather">🌦️ ${t("mapops.weather", "Clima")}</button>
        <button data-map-focus="intel">🛰️ ${t("mapops.intelLayer", "Inteligência")}</button>
        <button data-map-focus="tech">🧪 ${t("mapops.tech", "Tecnologia")}</button>
      </div>
    </section>
    <section class="mapops-layers">
      <h3>${t("mapops.layers", "Camadas táticas")}</h3>
      <div class="mapops-layer-grid">
        ${layers.map(([key, label, icon]) => `<button class="${settings[key] ? "on" : "off"}" data-map-layer="${key}"><b>${icon}</b><span>${label}</span><i>${settings[key] ? "ON" : "OFF"}</i></button>`).join("")}
      </div>
    </section>`;
  $$("#mapOpsPanel [data-map-preset]").forEach(btn => btn.addEventListener("click", () => setMapPreset(btn.dataset.mapPreset)));
  $$("#mapOpsPanel [data-map-focus]").forEach(btn => btn.addEventListener("click", () => focusMap(btn.dataset.mapFocus)));
  $$("#mapOpsPanel [data-map-layer]").forEach(btn => btn.addEventListener("click", () => toggleMapLayer(btn.dataset.mapLayer)));
}


function techName(key) {
  const labels = {
    drones: t("tech.drones", "Drones autônomos"),
    stealth: t("tech.stealth", "Furtividade aérea"),
    hypersonic: t("tech.hypersonic", "Mísseis hipersônicos"),
    missileDefense: t("tech.missileDefense", "Defesa antimíssil"),
    aiLogistics: t("tech.aiLogistics", "IA logística"),
    quantumCyber: t("tech.quantumCyber", "Cyber quântico"),
    navalPropulsion: t("tech.navalPropulsion", "Propulsão naval"),
    armorSystems: t("tech.armorSystems", "Blindagem modular")
  };
  return labels[key] || key;
}

function techIcon(key) {
  return {
    drones: "🛸",
    stealth: "🛩️",
    hypersonic: "🚀",
    missileDefense: "🛡️",
    aiLogistics: "🧠",
    quantumCyber: "💠",
    navalPropulsion: "⚓",
    armorSystems: "🪖"
  }[key] || "🧪";
}

function techDomain(key) {
  return {
    drones: "air",
    stealth: "air",
    hypersonic: "missile",
    missileDefense: "defense",
    aiLogistics: "logistics",
    quantumCyber: "cyber",
    navalPropulsion: "naval",
    armorSystems: "ground"
  }[key] || "general";
}

function makeTechSystem(country = null) {
  const keys = ["drones","stealth","hypersonic","missileDefense","aiLogistics","quantumCyber","navalPropulsion","armorSystems"];
  const base = clamp(Math.round((country?.industry || 50) / 16 + (country?.intel || 40) / 18), 1, 12);
  return {
    labs: 1,
    budget: 46,
    focus: "drones",
    history: [],
    techs: keys.map((key, idx) => ({
      key,
      level: idx < 2 ? 1 : 0,
      progress: idx < 2 ? 20 + base : randomInt(0, base),
      applied: idx < 2 ? 1 : 0
    }))
  };
}

function ensureTechSystem() {
  if (!state.game) return null;
  if (!state.game.techSystem) state.game.techSystem = makeTechSystem(getPlayerCountry());
  const ts = state.game.techSystem;
  const keys = ["drones","stealth","hypersonic","missileDefense","aiLogistics","quantumCyber","navalPropulsion","armorSystems"];
  if (!Array.isArray(ts.techs)) ts.techs = [];
  keys.forEach(key => {
    if (!ts.techs.find(tk => tk.key === key)) ts.techs.push({ key, level: 0, progress: 0, applied: 0 });
  });
  if (!Array.isArray(ts.history)) ts.history = [];
  ts.labs = clamp(ts.labs ?? 1, 1, 20);
  ts.budget = clamp(ts.budget ?? 40, 0, 200);
  ts.focus = ts.focus || "drones";
  ts.techs.forEach(tk => {
    tk.level = clamp(tk.level ?? 0, 0, 5);
    tk.progress = clamp(tk.progress ?? 0, 0, 100);
    tk.applied = clamp(tk.applied ?? 0, 0, 5);
  });
  return ts;
}

function getTech(key) {
  return ensureTechSystem()?.techs?.find(tk => tk.key === key);
}

function techPowerIndex() {
  const ts = ensureTechSystem();
  if (!ts) return 0;
  return ts.techs.reduce((sum, tk) => sum + tk.level * 10 + Math.round(tk.progress / 20), 0) + ts.labs * 4 + Math.round(ts.budget / 10);
}

function recordTechHistory(kind, key, text) {
  const ts = ensureTechSystem();
  ts.history.unshift({ id: cryptoId(), kind, key, icon: techIcon(key), name: techName(key), text, at: `${monthNames[state.game.month % 12]}/${state.game.year}` });
  ts.history = ts.history.slice(0, 12);
}

function applyTechLevelEffect(key, level) {
  const g = state.game;
  const amount = Math.max(1, level);
  if (key === "drones") { g.airPower = clamp(g.airPower + amount * 2, 0, 999); g.intel = clamp(g.intel + amount, 0, 220); }
  if (key === "stealth") { g.airPower = clamp(g.airPower + amount * 3, 0, 999); }
  if (key === "hypersonic") { g.missilePower = clamp(g.missilePower + amount * 4, 0, 999); }
  if (key === "missileDefense") { g.defense = clamp(g.defense + amount * 3, 0, 999); ensureMissileWar().shield = clamp(ensureMissileWar().shield + amount * 5, 0, 160); }
  if (key === "aiLogistics") { g.logistics = clamp(g.logistics + amount * 3, 0, 220); const ls = ensureLogisticsSystem(); if (ls) ls.bottleneck = clamp(ls.bottleneck - amount * 4, 0, 100); }
  if (key === "quantumCyber") { g.cyber = clamp(g.cyber + amount * 4, 0, 220); ensureCyberOps().security = clamp(ensureCyberOps().security + amount * 3, 0, 160); }
  if (key === "navalPropulsion") { g.navalPower = clamp(g.navalPower + amount * 4, 0, 999); ensureNavalWar().seaControl = clamp(ensureNavalWar().seaControl + amount * 4, 0, 160); }
  if (key === "armorSystems") { g.landPower = clamp(g.landPower + amount * 4, 0, 999); g.defense = clamp(g.defense + amount * 2, 0, 999); }
}

function advanceTechProgress(key, gain, source = "research") {
  const tk = getTech(key);
  if (!tk) return;
  tk.progress += gain;
  while (tk.progress >= 100 && tk.level < 5) {
    tk.progress -= 100;
    tk.level += 1;
    applyTechLevelEffect(key, tk.level);
    tk.applied = Math.max(tk.applied || 0, tk.level);
    const text = `${techName(key)} ${currentLang === "en-US" ? "reached level" : currentLang === "es-ES" ? "alcanzó nivel" : "alcançou nível"} ${tk.level}.`;
    state.game.events.push(eventText("sistema", text));
    recordTechHistory("level", key, text);
  }
  if (tk.level >= 5) tk.progress = 100;
  if (source !== "monthly") {
    recordTechHistory(source, key, `${techName(key)}: +${gain}% P&D.`);
  }
}

function progressTechSystem() {
  const ts = ensureTechSystem();
  if (!ts) return;
  const staff = ensureStaffSystem();
  const intel = ensureIntelSystem();
  const gain = Math.max(1, Math.round(ts.budget / 26) + ts.labs + Math.round((staffBonus("intel") + (intel.confidence || 0) / 28) / 2));
  advanceTechProgress(ts.focus, gain, "monthly");
  if (Math.random() < .18 && ts.budget > 60) {
    const others = ts.techs.filter(tk => tk.key !== ts.focus && tk.level < 5);
    if (others.length) advanceTechProgress(others[randomInt(0, others.length - 1)].key, 1, "monthly");
  }
}

function techAction(kind, key = null) {
  const g = state.game;
  const ts = ensureTechSystem();
  const selected = key || $("#techFocusSelect")?.value || ts.focus;
  const costs = {
    focus: { finance: 8, industry: 2, energy: 2 },
    fund: { finance: 54, industry: 28, energy: 14 },
    prototype: { finance: 90, industry: 44, energy: 24 },
    transfer: { finance: 36, industry: 8, energy: 6 },
    labs: { finance: 110, industry: 64, energy: 28 }
  };
  const cost = costs[kind] || costs.fund;
  if (g.finance < cost.finance || g.industry < cost.industry || g.energy < cost.energy) {
    g.events.push(eventText("warn", currentLang === "en-US" ? "Insufficient resources for technology action." : currentLang === "es-ES" ? "Recursos insuficientes para acción tecnológica." : "Recursos insuficientes para ação tecnológica."));
    saveGame(); renderGame(); return;
  }
  g.finance -= cost.finance; g.industry -= cost.industry; g.energy -= cost.energy;
  if (kind === "focus") {
    ts.focus = selected;
    recordTechHistory("focus", selected, `${techName(selected)}: ${currentLang === "en-US" ? "new R&D focus." : currentLang === "es-ES" ? "nuevo foco I+D." : "novo foco de P&D."}`);
  }
  if (kind === "fund") {
    ts.budget = clamp(ts.budget + randomInt(8, 16), 0, 200);
    advanceTechProgress(selected, randomInt(12, 22) + ts.labs, "fund");
  }
  if (kind === "prototype") {
    ts.budget = clamp(ts.budget + 4, 0, 200);
    advanceTechProgress(selected, randomInt(24, 42) + Math.round(staffBonus("intel") / 2), "prototype");
    g.readiness = clamp(g.readiness - 1, 0, 100);
  }
  if (kind === "transfer") {
    const allies = ensureCoalition()?.allies?.length || 0;
    const gain = allies ? randomInt(14, 26) + allies * 4 : randomInt(4, 10);
    advanceTechProgress(selected, gain, "transfer");
    if (!allies) g.events.push(eventText("warn", currentLang === "en-US" ? "No formal allies: transfer was limited." : currentLang === "es-ES" ? "Sin aliados formales: transferencia limitada." : "Sem aliados formais: transferência limitada."));
  }
  if (kind === "labs") {
    ts.labs = clamp(ts.labs + 1, 1, 20);
    ts.budget = clamp(ts.budget + 6, 0, 200);
    recordTechHistory("labs", selected, `${t("tech.labsBtn", "Expandir laboratórios")}: ${ts.labs}.`);
  }
  saveGame(); renderGame(); activatePanel("panelTech");
}

function renderTechMapOverlays(player) {
  const ts = ensureTechSystem();
  if (!state.map || !state.layers.tech || !window.L || !ts) return;
  const cap = getRegion("capital")?.coords || player.coords;
  const industrial = getRegion("industrial")?.coords || jitter(cap, 1.2);
  const focus = getTech(ts.focus);
  [cap, industrial].forEach((coords, index) => {
    const icon = L.divIcon({ className: "", html: `<div class="marker-tech-lab">${index ? "🏭" : "🧪"}</div>`, iconSize: [38, 38], iconAnchor: [19, 19] });
    L.marker(jitter(coords, .25), { icon }).addTo(state.layers.tech).bindPopup(`<strong>${t("tech.labs", "Laboratórios")} ${index + 1}</strong><br>${techName(ts.focus)} · ${t("tech.progress", "Progresso")} ${focus?.progress || 0}%`);
  });
  if (focus && focus.progress > 35) {
    L.circle(industrial, { radius: 75000 + focus.progress * 900, color: "#67f0d0", fillColor: "#67f0d0", fillOpacity: .05, opacity: .34, weight: 2, className: "tech-lab-ring" }).addTo(state.layers.tech);
  }
}

function renderTechPanel() {
  const panel = $("#techPanel");
  if (!panel || !state.game) return;
  const ts = ensureTechSystem();
  const focus = getTech(ts.focus);
  panel.innerHTML = `
    <div class="tech-status">
      <div><small>${t("tech.labs","Laboratórios")}</small><strong>${ts.labs}</strong><span>${t("tech.budget","Orçamento P&D")}: ${ts.budget}</span></div>
      <div><small>${t("tech.focus","Foco atual")}</small><strong>${techIcon(ts.focus)} ${techName(ts.focus)}</strong><span>${t("tech.level","Nível")} ${focus?.level || 0} · ${t("tech.progress","Progresso")} ${focus?.progress || 0}%</span></div>
      <div><small>${currentLang === "en-US" ? "Tech index" : currentLang === "es-ES" ? "Índice tech" : "Índice tech"}</small><strong>${techPowerIndex()}</strong><span>${t("tech.mapLayer","Laboratórios")}</span></div>
    </div>
    <label class="tech-focus-select"><span>${t("tech.focus","Foco atual")}</span>
      <select id="techFocusSelect">
        ${ts.techs.map(tk => `<option value="${tk.key}" ${tk.key === ts.focus ? "selected" : ""}>${techIcon(tk.key)} ${techName(tk.key)} · ${t("tech.level","Nível")} ${tk.level}</option>`).join("")}
      </select>
    </label>
    <div class="tech-actions">
      <button data-tech-action="focus">🎯 ${t("tech.focusBtn","Definir foco")}</button>
      <button data-tech-action="fund">💰 ${t("tech.fund","Financiar pesquisa")}</button>
      <button data-tech-action="prototype">⚙️ ${t("tech.prototype","Protótipo rápido")}</button>
      <button data-tech-action="transfer">🤝 ${t("tech.transfer","Transferência aliada")}</button>
      <button data-tech-action="labs">🏗️ ${t("tech.labsBtn","Expandir laboratórios")}</button>
    </div>
    <section class="tech-tree">
      ${ts.techs.map(tk => `<article class="${tk.key === ts.focus ? "active" : ""}">
        <b>${techIcon(tk.key)}</b>
        <div><strong>${techName(tk.key)}</strong><span>${t("tech.level","Nível")} ${tk.level} · ${techDomain(tk.key)}</span><i><em style="width:${clamp(tk.progress,0,100)}%"></em></i></div>
      </article>`).join("")}
    </section>
    <section class="tech-history">
      <h3>${t("tech.history","Histórico tecnológico")}</h3>
      ${ts.history.length ? ts.history.slice(0,7).map(item => `<article><strong>${item.icon} ${item.name}</strong><span>${item.at} · ${item.text}</span></article>`).join("") : `<p class="muted">${t("tech.noHistory","Nenhuma pesquisa registrada.")}</p>`}
    </section>`;
  $("#techFocusSelect")?.addEventListener("change", e => { ts.focus = e.target.value; saveGame(); renderTechPanel(); });
  $$("#techPanel [data-tech-action]").forEach(btn => btn.addEventListener("click", () => techAction(btn.dataset.techAction)));
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
    battleScenes: [],
    enemyOps: makeEnemyOffensiveSystem(),
    coalition: makeCoalitionSystem(),
    mapSettings: makeMapSettings(),
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
  $("#nationConfirmTray")?.replaceChildren();
  $("#nationTopConfirm")?.replaceChildren();
  state.game = makeInitialGame(countryId);
  state.mapUserMoved = false;
  state.mapAutoCentered = false;
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
  ensureNavalWar();
  ensureMissileWar();
  ensureLogisticsSystem();
  ensureMovementSystem();
  ensureEnemyOffensives();
  ensureCoalition();
  ensureEnvironmentSystem();
  ensureIntelSystem();
  ensureStaffSystem();
  ensureTechSystem();
  ensureMapSettings();
  renderSummary();
  renderCommanderGuide();
  renderRegionSelect();
  renderRegionBoard();
  renderBuildList();
  renderProduction();
  renderUnitList();
  renderArsenal();
  renderMaintenance();
  renderLogisticsSystem();
  renderWarEconomy();
  renderCyberOps();
  renderGroundWar();
  renderAirWar();
  renderNavalWar();
  renderMissileWar();
  renderMovementSystem();
  renderDefensePanel();
  renderCoalitionPanel();
  renderEnvironmentPanel();
  renderStaffPanel();
  renderTechPanel();
  renderMapOpsPanel();
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
  const logisticsSystem = ensureLogisticsSystem();
  if (g.month > 1 && (logisticsSystem.bottleneck > 58 || logisticsSystem.fuelReserve < 24 || logisticsSystem.ammoStock < 24)) return { title: t("rec.logistics", "Reforçar logística"), text: t("rec.logisticsText", "Gargalos ou suprimentos baixos podem travar produção e frentes."), action: "logistics", panel: "panelLogistics" };
  const environment = ensureEnvironmentSystem();
  if (g.month > 1 && (severeWeatherScore() > 48 || environment.fatigue > 45)) return { title: t("rec.environment", "Preparar ambiente"), text: t("rec.environmentText", "Condições climáticas severas podem travar operações."), action: "environment", panel: "panelEnvironment" };
  const intelSystem = ensureIntelSystem();
  if (g.month > 1 && (intelSystem.fog > 62 || intelSystem.confidence < 35)) return { title: t("rec.intel", "Melhorar inteligência"), text: t("rec.intelText", "A névoa de guerra está alta."), action: "intel", panel: "panelIntel" };
  const staff = ensureStaffSystem();
  if (g.month > 1 && (staff.fatigue > 64 || staff.morale < 42)) return { title: t("rec.staff", "Reorganizar Estado-Maior"), text: t("rec.staffText", "A fadiga de comando está alta ou a moral está baixa."), action: "staff", panel: "panelStaff" };
  const techSystem = ensureTechSystem();
  if (g.month > 2 && (techPowerIndex() < powerIndex() / 2 || techSystem.budget < 34)) return { title: t("rec.tech", "Investir em tecnologia"), text: t("rec.techText", "Seu nível tecnológico está ficando abaixo da ameaça global."), action: "tech", panel: "panelTech" };
  const cyberOps = ensureCyberOps();
  const mainThreat = topAiThreats(1)[0];
  const enemyOps = ensureEnemyOffensives();
  if (enemyOps?.active?.length) return { title: t("rec.defense", "Responder ameaça"), text: t("rec.defenseText", "Há ofensiva inimiga ativa."), action: "defense", panel: "panelDefense" };
  const coalition = ensureCoalition();
  if (g.month > 2 && mainThreat && mainThreat.hostility > 68 && coalition.allies.length === 0) return { title: t("rec.coalition", "Formar coalizão"), text: t("rec.coalitionText", "Rivais hostis estão pressionando."), action: "coalition", panel: "panelCoalition" };
  if (mainThreat && mainThreat.hostility > 70 && cyberOps.spyNetwork < 45 && g.month > 1) return { title: t("rec.cyber", "Executar inteligência"), text: t("rec.cyberText", "Rivais hostis estão crescendo."), action: "cyber", panel: "panelCyber" };
  const air = ensureAirWar();
  if (g.units.length && g.month > 2 && air.airSupremacy < 55) return { title: t("rec.air", "Buscar superioridade aérea"), text: t("rec.airText", "Domine o céu antes de escalar ataques maiores."), action: "air", panel: "panelAir" };
  const naval = ensureNavalWar();
  if (g.month > 2 && (naval.seaControl < 45 || naval.blockadePressure > 60 || naval.submarineThreat > 60)) return { title: t("rec.naval", "Controlar rotas navais"), text: t("rec.navalText", "O controle marítimo está baixo."), action: "naval", panel: "panelNaval" };
  const missile = ensureMissileWar();
  if (g.month > 2 && (g.worldTension > 62 || (g.globalWar?.nuclearRisk || 0) > 45) && (missile.shield < 55 || missile.stockpile < 12 || missile.earlyWarning < 55)) return { title: t("rec.missile", "Reforçar defesa estratégica"), text: t("rec.missileText", "A tensão está alta."), action: "missile", panel: "panelMissile" };
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
  const mainActionLabel = rec.action === "repair" ? t("guide.repair", "Reparar") : rec.action === "produce" ? t("guide.produce", "Produzir") : rec.action === "month" ? t("nextMonth", "Avançar mês") : rec.action === "economy" ? t("guide.economy", "Economia") : rec.action === "logistics" ? t("guide.logistics", "Logística") : rec.action === "cyber" ? t("guide.cyber", "Cyber") : rec.action === "air" ? t("guide.air", "Aérea") : rec.action === "naval" ? t("guide.naval", "Naval") : rec.action === "missile" ? t("guide.missile", "Mísseis") : rec.action === "ground" ? t("guide.ground", "Frente") : rec.action === "world" ? t("guide.world", "Mundo") : rec.action === "ai" ? t("guide.ai", "IA") : rec.action === "ops" ? t("guide.attack", "Atacar") : t("guide.build", "Construir");
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
      <button id="quickMapBtn"><b>🗺️ ${t("guide.map", "Mapa")}</b><span>${t("guide.mapSub", "filtrar camadas")}</span></button>
      <button id="quickStaffBtn"><b>🎖️ ${t("guide.staff", "Estado-Maior")}</b><span>${t("guide.staffSub", "oficiais e doutrina")}</span></button>
      <button id="quickTechBtn"><b>🧪 ${t("guide.tech", "Tech")}</b><span>${t("guide.techSub", "P&D militar")}</span></button>
      <button id="quickBuildBtn"><b>🏗️ ${t("guide.build", "Construir")}</b><span>${t("guide.buildSub", "base recomendada")}</span></button>
      <button id="quickProduceBtn"><b>🪖 ${t("guide.produce", "Produzir")}</b><span>${t("guide.produceSub", "melhor unidade")}</span></button>
      <button id="quickLogisticsBtn"><b>🚚 ${t("guide.logistics", "Logística")}</b><span>${t("guide.logisticsSub", "suprir tropas")}</span></button>
      <button id="quickEnvironmentBtn"><b>🌦️ ${t("guide.environment", "Ambiente")}</b><span>${t("guide.environmentSub", "clima e terreno")}</span></button>
      <button id="quickRepairBtn"><b>🛠️ ${t("guide.repair", "Reparar")}</b><span>${t("guide.repairSub", "base crítica")}</span></button>
      <button id="quickOpsBtn"><b>⚔️ ${t("guide.attack", "Atacar")}</b><span>${t("guide.attackSub", "abrir operações")}</span></button>
      <button id="quickDefenseBtn"><b>🛡️ ${t("guide.defense", "Defesa")}</b><span>${t("guide.defenseSub", "bloquear ataques")}</span></button>
      <button id="quickCoalitionBtn"><b>🤝 ${t("guide.coalition", "Aliados")}</b><span>${t("guide.coalitionSub", "pedir apoio")}</span></button>
      <button id="quickAirBtn"><b>✈️ ${t("guide.air", "Aérea")}</b><span>${t("guide.airSub", "dominar o céu")}</span></button>
      <button id="quickNavalBtn"><b>⚓ ${t("guide.naval", "Naval")}</b><span>${t("guide.navalSub", "controlar mares")}</span></button>
      <button id="quickMissileBtn"><b>🚀 ${t("guide.missile", "Mísseis")}</b><span>${t("guide.missileSub", "defesa estratégica")}</span></button>
      <button id="quickGroundBtn"><b>🗺️ ${t("guide.ground", "Frente")}</b><span>${t("guide.groundSub", "ocupar território")}</span></button>
      <button id="quickMoveBtn"><b>🚛 ${t("guide.movement", "Mover")}</b><span>${t("guide.movementSub", "redistribuir forças")}</span></button>
      <button id="quickCyberBtn"><b>🕵️ ${t("guide.cyber", "Cyber")}</b><span>${t("guide.cyberSub", "espionar rivais")}</span></button>
      <button id="quickIntelBtn"><b>🛰️ ${t("guide.intel", "Intel")}</b><span>${t("guide.intelSub", "revelar ameaças")}</span></button>
      <button id="quickEconomyBtn"><b>🏭 ${t("guide.economy", "Economia")}</b><span>${t("guide.economySub", "mobilização e inflação")}</span></button>
      <button id="quickWorldBtn"><b>🌐 ${t("guide.world", "Mundo")}</b><span>${t("guide.worldSub", "DEFCON e crise")}</span></button>
      <button id="quickAiBtn"><b>🛰️ ${t("guide.ai", "IA")}</b><span>${t("guide.aiSub", "rivais ativos")}</span></button>
    </div>`;
  $("#primaryRecommendedBtn")?.addEventListener("click", () => runRecommendedAction(rec));
  $("#quickBuildBtn")?.addEventListener("click", quickBuildRecommended);
  $("#quickProduceBtn")?.addEventListener("click", quickProduceRecommended);
  $("#quickLogisticsBtn")?.addEventListener("click", () => activatePanel("panelLogistics"));
  $("#quickEnvironmentBtn")?.addEventListener("click", () => activatePanel("panelEnvironment"));
  $("#quickRepairBtn")?.addEventListener("click", quickRepairPriority);
  $("#quickOpsBtn")?.addEventListener("click", () => activatePanel("panelOps"));
  $("#quickDefenseBtn")?.addEventListener("click", () => activatePanel("panelDefense"));
  $("#quickCoalitionBtn")?.addEventListener("click", () => activatePanel("panelCoalition"));
  $("#quickAirBtn")?.addEventListener("click", () => activatePanel("panelAir"));
  $("#quickNavalBtn")?.addEventListener("click", () => activatePanel("panelNaval"));
  $("#quickMissileBtn")?.addEventListener("click", () => activatePanel("panelMissile"));
  $("#quickGroundBtn")?.addEventListener("click", () => activatePanel("panelGround"));
  $("#quickMoveBtn")?.addEventListener("click", () => activatePanel("panelMovement"));
  $("#quickCyberBtn")?.addEventListener("click", () => activatePanel("panelCyber"));
  $("#quickIntelBtn")?.addEventListener("click", () => activatePanel("panelIntel"));
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
  if (rec.action === "logistics") return activatePanel("panelLogistics");
  if (rec.action === "cyber") return activatePanel("panelCyber");
  if (rec.action === "air") return activatePanel("panelAir");
  if (rec.action === "naval") return activatePanel("panelNaval");
  if (rec.action === "missile") return activatePanel("panelMissile");
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
  const intel = ensureIntelSystem();
  $("#threatFill").style.width = `${clamp(g.worldTension + g.escalation + Math.round(intel.fog / 3), 0, 100)}%`;
  $("#intelGrid").innerHTML = `
    <div class="metric"><small>${currentLang === "en-US" ? "World tension" : currentLang === "es-ES" ? "Tensión mundial" : "Tensão mundial"}</small><strong>${g.worldTension}</strong></div>
    <div class="metric"><small>${t("intel.confidence", "Confiança")}</small><strong>${intel.confidence}</strong></div>
    <div class="metric"><small>${t("intel.fog", "Névoa de guerra")}</small><strong>${intel.fog}%</strong></div>
    <div class="metric"><small>${t("intel.satellite", "Satélites")}</small><strong>${intel.satellite}</strong></div>
    <div class="metric"><small>${t("intel.sigint", "SIGINT")}</small><strong>${intel.sigint}</strong></div>
    <div class="metric"><small>${currentLang === "en-US" ? "Readiness" : currentLang === "es-ES" ? "Preparación" : "Prontidão"}</small><strong>${g.readiness}</strong></div>`;
  renderAdvancedIntelPanel();
  const feed = $("#eventFeed");
  feed.innerHTML = "";
  g.events.slice(-8).reverse().forEach(e => {
    const div = document.createElement("div");
    div.className = `event ${e.kind || ""}`;
    div.textContent = e.text;
    feed.appendChild(div);
  });
}


function interpolateCoords(a, b, ratio) {
  return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
}

function unitMapIcon(unit) {
  if (!unit) return "🪖";
  if (unit.class === "Aéreo") return "✈️";
  if (unit.class === "Naval") return "🚢";
  if (unit.class === "Estratégico") return "🚀";
  return unit.icon || "🪖";
}

function addTacticalRoute(from, to, label, icon = "🚚", offset = 0) {
  if (!state.map || !state.layers.tactical || !from || !to || !window.L) return;
  L.polyline([from, to], {
    color: "#ffd166",
    weight: 3,
    opacity: .72,
    dashArray: "12 14",
    className: "tactical-route"
  }).addTo(state.layers.tactical).bindPopup(label);
  const ratio = .26 + ((Date.now() / 9000 + offset) % .48);
  const markerPoint = interpolateCoords(from, to, ratio);
  const movingIcon = L.divIcon({
    className: "",
    html: `<div class="marker-moving-war" style="--delay:${offset}s">${icon}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
  L.marker(markerPoint, { icon: movingIcon }).addTo(state.layers.tactical).bindPopup(label);
}

function renderTacticalMapOverlays(player) {
  const g = state.game;
  if (!state.layers.tactical || !window.L || !g) return;

  g.construction.forEach(job => {
    const building = getBuilding(job.buildingId);
    const region = getRegion(job.regionId);
    const total = Math.max(1, building?.buildMonths || job.remaining || 1);
    const progress = clamp(100 - Math.round((job.remaining / total) * 100), 0, 100);
    const icon = L.divIcon({
      className: "",
      html: `<div class="marker-construction"><b>${building?.icon || "🏗️"}</b><i>${progress}%</i></div>`,
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    });
    L.marker(jitter(region.coords, .18), { icon }).addTo(state.layers.tactical)
      .bindPopup(`<strong>🏗️ ${building?.name || "Construção"}</strong><br>${region.name}<br>Progresso: ${progress}% · faltam ${job.remaining} mês(es)`);
  });

  g.production.forEach((job, index) => {
    const unit = getUnit(job.unitId);
    const region = getRegion(job.regionId);
    const icon = L.divIcon({
      className: "",
      html: `<div class="marker-production"><b>${unitMapIcon(unit)}</b><i>${job.remaining}m</i></div>`,
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });
    L.marker(jitter(region.coords, .26), { icon }).addTo(state.layers.tactical)
      .bindPopup(`<strong>${unitMapIcon(unit)} ${unit?.name || "Unidade"}</strong><br>${region.name}<br>Produção em andamento · faltam ${job.remaining} mês(es)`);
    addTacticalRoute(region.coords, jitter(region.coords, .8), `${unit?.name || "Unidade"} em deslocamento interno`, unitMapIcon(unit), index * .65);
  });

  g.units.forEach((stack, index) => {
    const unit = getUnit(stack.id);
    const region = getRegion(stack.regionId);
    const icon = L.divIcon({
      className: "",
      html: `<div class="marker-unit-stack"><b>${unitMapIcon(unit)}</b><i>${stack.qty}</i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    L.marker(jitter(region.coords, .30), { icon }).addTo(state.layers.tactical)
      .bindPopup(`<strong>${unitMapIcon(unit)} ${unit?.name || "Força"}</strong><br>${region.name}<br>Quantidade: ${stack.qty} · condição ${stack.condition ?? 100}%`);
  });

  ensureGroundWar()?.fronts?.filter(f => f.status !== "withdrawn").forEach((front, index) => {
    const target = getCountry(front.targetId);
    if (!target) return;
    addTacticalRoute(player.coords, target.coords, `<strong>🪖 Coluna terrestre rumo a ${front.targetName}</strong><br>Avanço: ${front.progress}% · suprimento ${front.supply}%`, "🪖", index * .9);
    addTacticalRoute(player.coords, jitter(target.coords, 1.1), `<strong>🚚 Comboio logístico para ${front.targetName}</strong><br>Suprimento da frente: ${front.supply}%`, "🚚", index * 1.2);
  });

  ensureLogisticsSystem()?.history?.slice(0,3).filter(item => item.coords).forEach((item, index) => {
    addTacticalRoute(player.coords, item.coords, `<strong>🚚 ${item.label}</strong><br>${item.regionName}<br>${item.effect}`, "🚚", index * .7);
  });

  ensureMovementSystem()?.deployments?.forEach((dep, index) => {
    const from = getRegion(dep.fromRegionId);
    const to = getRegion(dep.toRegionId);
    if (!from || !to) return;
    L.polyline([from.coords, to.coords], { color: "#6affad", weight: 3, opacity: .75, dashArray: "8 10", className: "tactical-route movement-route" }).addTo(state.layers.tactical)
      .bindPopup(`<strong>${dep.unitIcon} ${dep.unitName}</strong><br>${dep.fromRegionName} → ${dep.toRegionName}<br>${t("movement.eta","Chega em")} ${dep.remaining} ${t("movement.days","meses")}`);
    const ratio = clamp((dep.total - dep.remaining) / Math.max(1, dep.total), 0.08, 0.92);
    const markerPoint = interpolateCoords(from.coords, to.coords, ratio);
    const movingIcon = L.divIcon({ className: "", html: `<div class="marker-moving-war marker-moving-transport" style="--delay:${index * .45}s">${dep.unitIcon}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    L.marker(markerPoint, { icon: movingIcon }).addTo(state.layers.tactical).bindPopup(`<strong>${dep.unitIcon} ${dep.unitName}</strong><br>${dep.qty} ${t("movement.stack","Lotes")} · ${dep.fromRegionName} → ${dep.toRegionName}`);
  });

  ensureAirWar()?.history?.slice(0,3).filter(item => item.coords).forEach((item, index) => {
    addTacticalRoute(player.coords, item.coords, `<strong>✈️ ${item.label}</strong><br>${item.targetName}`, "✈️", index * .55);
  });

  ensureNavalWar()?.history?.slice(0,3).filter(item => item.coords).forEach((item, index) => {
    addTacticalRoute(player.coords, item.coords, `<strong>🚢 ${item.label}</strong><br>${item.targetName}`, "🚢", index * .8);
  });

  ensureMissileWar()?.history?.slice(0,2).filter(item => item.coords).forEach((item, index) => {
    addTacticalRoute(player.coords, item.coords, `<strong>🚀 ${item.label}</strong><br>${item.targetName}`, "🚀", index * .6);
  });
}

function initMap() {
  if (state.map) return;
  if (!window.L) {
    $("#mapFallback").hidden = false;
    return;
  }
  const c = getPlayerCountry();
  state.map = L.map("realMap", {
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 7,
    dragging: true,
    tap: false,
    inertia: true,
    keyboard: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    boxZoom: true
  }).setView(c.coords, 3);
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
  state.layers.navalOps = L.layerGroup().addTo(state.map);
  state.layers.missiles = L.layerGroup().addTo(state.map);
  state.layers.logistics = L.layerGroup().addTo(state.map);
  state.layers.tactical = L.layerGroup().addTo(state.map);
  state.layers.battleEffects = L.layerGroup().addTo(state.map);
  state.layers.weather = L.layerGroup().addTo(state.map);
  state.layers.intel = L.layerGroup().addTo(state.map);
  state.layers.tech = L.layerGroup().addTo(state.map);
  state.map.dragging.enable();
  state.map.scrollWheelZoom.enable();
  state.map.doubleClickZoom.enable();
  state.map.touchZoom.enable();
  state.map.boxZoom.enable();
  state.map.on("dragstart zoomstart movestart", () => { state.mapUserMoved = true; });
  setTimeout(() => state.map?.invalidateSize(), 60);
  setTimeout(() => state.map?.invalidateSize(), 420);
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
    const icon = L.divIcon({ className: "", html: `<div class="marker-base marker-base-visual"><b>${b.icon}</b><i>${base.level}</i></div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
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
  ensureNavalWar()?.history?.slice(0,5).filter(item => item.coords).forEach(item => {
    const target = getCountry(item.targetId);
    const icon = L.divIcon({ className: "", html: `<div class="marker-naval">⚓</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
    L.marker(item.coords, { icon }).addTo(state.layers.navalOps).bindPopup(`<strong>${target?.flag || ""} ${item.targetName}</strong><br>${item.label}<br>${item.success ? t("naval.success","sucesso") : t("naval.fail","falha")}`);
  });
  ensureMissileWar()?.history?.slice(0,5).filter(item => item.coords).forEach(item => {
    const target = getCountry(item.targetId);
    const icon = L.divIcon({ className: "", html: `<div class="marker-missile">🚀</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
    L.marker(item.coords, { icon }).addTo(state.layers.missiles).bindPopup(`<strong>${target?.flag || ""} ${item.targetName}</strong><br>${item.label}<br>${item.success ? t("missile.success","sucesso") : t("missile.fail","falha")}`);
  });
  ensureLogisticsSystem()?.history?.slice(0,5).filter(item => item.coords).forEach(item => {
    const icon = L.divIcon({ className: "", html: `<div class="marker-logistics">🚚</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
    L.marker(item.coords, { icon }).addTo(state.layers.logistics).bindPopup(`<strong>${item.regionName}</strong><br>${item.label}<br>${item.effect}`);
  });
  renderTacticalMapOverlays(player);
  renderCoalitionMapOverlays(player);
  renderBattlefieldMapOverlays(player);
  renderEnemyOffensivesMap(player);
  renderEnvironmentMapOverlays(player);
  renderIntelMapOverlays(player);
  renderTechMapOverlays(player);
  applyMapLayerVisibility();
  if (!state.mapUserMoved && !state.mapAutoCentered) {
    state.map.setView(player.coords, Math.max(state.map.getZoom(), 3), { animate: false });
    state.mapAutoCentered = true;
  }
  requestAnimationFrame(() => state.map?.invalidateSize());
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
    recon: { finance: 12, energy: 4, tension: 2, power: g.intel + g.cyber + staffBonus("intel") },
    airstrike: { finance: 35, energy: 16, tension: 8, power: g.airPower + g.missilePower / 2 + staffBonus("air") },
    naval: { finance: 42, energy: 18, tension: 9, power: g.navalPower + g.logistics / 2 + staffBonus("naval") },
    combined: { finance: 85, energy: 30, tension: 17, power: g.landPower + g.airPower + g.navalPower + g.missilePower + staffBonus("ground") + staffBonus("air") + staffBonus("naval") }
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
  recordBattleScene(kind, target, success, Math.round((attack + defense) / 2), label, `${report.ownLosses}/${report.enemyDamage}`);
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
  progressEnvironmentSystem();
  progressIntelSystem();
  applyStaffPassiveBonuses();
  progressTechSystem();
  progressConstruction();
  progressProduction();
  progressCyberOps();
  progressLogisticsSystem();
  progressGroundWar();
  progressAirWar();
  progressNavalWar();
  progressMissileWar();
  progressMovementSystem();
  progressEnemyOffensives();
  progressCoalitionSupport();
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
