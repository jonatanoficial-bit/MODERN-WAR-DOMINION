(() => {
  'use strict';

  const BUILD = {
    name: 'Modern War Dominion',
    phase: 'Fase 2 — Mapa Mundial Leaflet Style e Países Imersivos',
    version: 'v0.2.0-F2-MAPA-MUNDIAL-PAISES',
    date: '2026-06-24',
    saveKey: 'modern-war-dominion-save-v2-world-map',
    legacySaveKeys: ['modern-war-dominion-save-v2', 'modern-war-dominion-save-v1']
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const statLabels = {
    economy: 'Economia', military: 'Militar', diplomacy: 'Diplomacia', intel: 'Intel', logistics: 'Logística', stability: 'Estabilidade', tech: 'Tecnologia'
  };

  const fallbackCountries = [
    { id: 'brazil', name: 'Brasil', flag: '🇧🇷', capital: 'Brasília', bloc: 'América do Sul', region: 'América do Sul', doctrine: 'Recursos naturais, diplomacia e modernização industrial', description: 'Campanha de ascensão global com recursos, população e diplomacia.', stats: { economy: 66, military: 53, diplomacy: 77, intel: 50, logistics: 57, stability: 61, tech: 58 }, profile: { populationM: 216, gdpT: 2.2, defenseB: 23, activeMilitaryK: 360, reservesK: 1340, nuclear: 'Não', navalPower: 54, airPower: 55, cyber: 52, energy: 86, food: 94, industry: 63 }, map: { x: 34, y: 70 }, traits: ['Recursos', 'Diplomacia', 'Alimentos', 'Potencial'] },
    { id: 'usa', name: 'Estados Unidos', flag: '🇺🇸', capital: 'Washington, D.C.', bloc: 'Aliança Atlântica', region: 'América do Norte', doctrine: 'Projeção global e superioridade tecnológica', description: 'Superpotência de alcance mundial e alto custo de manutenção.', stats: { economy: 95, military: 94, diplomacy: 86, intel: 90, logistics: 95, stability: 72, tech: 96 }, profile: { populationM: 335, gdpT: 27, defenseB: 886, activeMilitaryK: 1328, reservesK: 799, nuclear: 'Sim', navalPower: 96, airPower: 97, cyber: 95, energy: 82, food: 88, industry: 92 }, map: { x: 25, y: 39 }, traits: ['Superpotência', 'Marinha', 'Tecnologia', 'Alianças'] }
  ];

  const fallbackRegions = [
    { id: 'north-america', name: 'América do Norte', x: 24, y: 38, tension: 31, influence: 76, trade: 84, stability: 72, resources: 'Tecnologia, energia, indústria', focus: 'Projeção aérea/naval e defesa continental' },
    { id: 'south-america', name: 'América do Sul', x: 34, y: 71, tension: 24, influence: 48, trade: 61, stability: 58, resources: 'Alimentos, água, energia, minerais', focus: 'Autonomia regional e proteção de recursos' },
    { id: 'europe', name: 'Europa', x: 53, y: 38, tension: 57, influence: 72, trade: 76, stability: 63, resources: 'Indústria avançada, alianças, tecnologia', focus: 'Segurança continental e energia' },
    { id: 'asia-pacific', name: 'Ásia-Pacífico', x: 80, y: 47, tension: 63, influence: 81, trade: 88, stability: 62, resources: 'Chips, manufatura, rotas marítimas', focus: 'Tecnologia, comércio e defesa marítima' }
  ];

  const actionConfig = {
    economy: { label: 'Plano econômico nacional', advisor: 'Ministro da Economia', text: 'Investimento em indústria, energia e cadeias de suprimento. Crescimento melhora, mas consome orçamento.', effects: { economy: 4, logistics: 1, stability: 1 }, budget: -5, region: { trade: 1, influence: 1 } },
    military: { label: 'Modernizar forças armadas', advisor: 'Estado-Maior Conjunto', text: 'Manutenção, prontidão e aquisição de tecnologia defensiva aumentam força militar sem entrar em detalhe operacional real.', effects: { military: 4, tech: 1, logistics: -1 }, budget: -6, region: { tension: 1, influence: 1 } },
    diplomacy: { label: 'Cúpula diplomática', advisor: 'Chanceler', text: 'Missões diplomáticas reduzem tensão regional e ampliam reputação internacional.', effects: { diplomacy: 4, stability: 1 }, budget: -3, region: { tension: -2, influence: 2, trade: 1 } },
    intel: { label: 'Centro de inteligência', advisor: 'Diretor de Inteligência', text: 'Análise estratégica, contra-informação e leitura de risco melhoram previsibilidade global.', effects: { intel: 4, tech: 1 }, budget: -4, region: { tension: -1, stability: 1 } },
    logistics: { label: 'Rede logística global', advisor: 'Comando Logístico', text: 'Portos, ferrovias, centros de manutenção e estoques estratégicos fortalecem alcance operacional.', effects: { logistics: 5, economy: 1 }, budget: -5, region: { trade: 2, stability: 1 } }
  };

  const eventPool = [
    { title: 'Choque de energia', text: 'Preços internacionais pressionam indústria e estabilidade. Países com energia alta sofrem menos.', effects: { economy: -2, stability: -1 }, region: { tension: 2, trade: -1 } },
    { title: 'Crise em rota marítima', text: 'O comércio global fica mais caro e a logística vira prioridade estratégica.', effects: { logistics: -2, economy: -1 }, region: { tension: 3, trade: -2 } },
    { title: 'Fórum multilateral', text: 'Uma rodada diplomática abre espaço para acordos e redução de tensão.', effects: { diplomacy: 3, stability: 1 }, region: { tension: -2, influence: 2 } },
    { title: 'Avanço industrial', text: 'Novas cadeias de produção elevam tecnologia e economia.', effects: { tech: 2, economy: 2 }, region: { trade: 1, influence: 1 } },
    { title: 'Campanha de desinformação', text: 'Narrativas externas testam inteligência, estabilidade e credibilidade pública.', effects: { intel: -1, stability: -2, diplomacy: -1 }, region: { tension: 2, stability: -1 } },
    { title: 'Acordo de suprimentos', text: 'Contratos internacionais aliviam estoques e melhoram a logística.', effects: { logistics: 3, economy: 1 }, region: { trade: 2, tension: -1 } }
  ];

  const els = {};
  const state = {
    countries: [], regions: [], selected: null, stats: null, budget: 100,
    turn: 1, month: 0, year: 2026, actionsThisTurn: 0,
    selectedRegionId: 'europe', log: []
  };

  const q = (id) => document.getElementById(id);
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

  function initEls() {
    ['screenHome','screenNation','screenGame','newGameBtn','continueBtn','backHomeBtn','nationGrid','nationSearch','buildChip','countryProfile','resourceGrid','campaignMeta','advisorTitle','advisorText','ackBtn','nextTurnBtn','eventLog','resetBtn','countryMapLayer','regionMapLayer','globalGrid','regionPanel','actionStack','installBtn'].forEach((id) => { els[id] = q(id); });
  }

  function showScreen(name) {
    ['screenHome','screenNation','screenGame'].forEach((screen) => els[screen].classList.remove('screen-active'));
    els[name].classList.add('screen-active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadData() {
    try {
      const [countriesResponse, regionsResponse] = await Promise.all([fetch('data/countries.json'), fetch('data/world_regions.json')]);
      state.countries = countriesResponse.ok ? await countriesResponse.json() : fallbackCountries;
      state.regions = regionsResponse.ok ? await regionsResponse.json() : fallbackRegions;
    } catch (error) {
      state.countries = fallbackCountries;
      state.regions = fallbackRegions;
    }
  }

  function hasSave() {
    try {
      return Boolean(localStorage.getItem(BUILD.saveKey) || BUILD.legacySaveKeys.some((key) => localStorage.getItem(key)));
    } catch (error) { return false; }
  }

  function saveGame() {
    try {
      localStorage.setItem(BUILD.saveKey, JSON.stringify({
        selected: state.selected, stats: state.stats, budget: state.budget, turn: state.turn,
        month: state.month, year: state.year, actionsThisTurn: state.actionsThisTurn,
        selectedRegionId: state.selectedRegionId, regions: state.regions, log: state.log.slice(0, 50),
        savedAt: new Date().toISOString(), build: BUILD.version
      }));
      els.continueBtn.disabled = false;
    } catch (error) { addLog('Sistema', 'Não foi possível salvar localmente neste navegador.'); }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(BUILD.saveKey) || BUILD.legacySaveKeys.map((key) => localStorage.getItem(key)).find(Boolean);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      const selectedId = payload.selected?.id || payload.selected;
      state.selected = state.countries.find((country) => country.id === selectedId) || payload.selected || state.countries[0];
      state.stats = payload.stats || clone(state.selected.stats);
      state.budget = payload.budget ?? 100;
      state.turn = payload.turn || 1;
      state.month = payload.month || 0;
      state.year = payload.year || 2026;
      state.actionsThisTurn = payload.actionsThisTurn || 0;
      state.selectedRegionId = payload.selectedRegionId || state.selected?.region || 'europe';
      state.regions = Array.isArray(payload.regions) && payload.regions.length ? payload.regions : state.regions;
      state.log = Array.isArray(payload.log) ? payload.log : [];
      addLog('Migração F2', 'Campanha carregada no novo mapa mundial estilo Leaflet/OpenStreetMap com fallback offline.');
      renderGame(); showScreen('screenGame'); saveGame();
      return true;
    } catch (error) { return false; }
  }

  function startCampaign(country) {
    state.selected = country;
    state.stats = clone(country.stats);
    state.budget = 100;
    state.turn = 1;
    state.month = 0;
    state.year = 2026;
    state.actionsThisTurn = 0;
    state.selectedRegionId = regionIdFromCountry(country);
    state.regions = clone(state.regions.length ? state.regions : fallbackRegions);
    state.log = [];
    addLog('Campanha iniciada', `${country.flag} ${country.name} assumiu o comando global. Objetivo: ampliar influência sem quebrar estabilidade nacional.`);
    advisor('Chefe do Estado-Maior', `Bem-vindo ao comando de ${country.name}. Leia o mapa mundial, compare tensão por região e escolha ações de economia, diplomacia, inteligência, logística e defesa.`);
    renderGame(); showScreen('screenGame'); saveGame();
  }

  function regionIdFromCountry(country) {
    const text = `${country.region} ${country.bloc}`.toLowerCase();
    if (text.includes('norte')) return 'north-america';
    if (text.includes('sul')) return 'south-america';
    if (text.includes('europa') && !text.includes('oriente')) return 'europe';
    if (text.includes('oriente')) return 'middle-east';
    if (text.includes('eurásia')) return 'eurasia';
    if (text.includes('pacífico') || text.includes('ásia')) return 'asia-pacific';
    return 'europe';
  }

  function addLog(title, text) {
    state.log.unshift({ title, text, stamp: `${monthNames[state.month]} ${state.year}` });
    state.log = state.log.slice(0, 50);
    renderLog();
  }

  function advisor(title, text) {
    if (!els.advisorTitle) return;
    els.advisorTitle.textContent = title;
    els.advisorText.textContent = text;
  }

  function applyEffects(effects = {}) {
    Object.entries(effects).forEach(([key, value]) => {
      state.stats[key] = clamp((state.stats[key] ?? 50) + value);
    });
  }

  function applyRegionEffects(regionId, effects = {}) {
    const region = state.regions.find((item) => item.id === regionId) || selectedRegion();
    if (!region) return;
    Object.entries(effects).forEach(([key, value]) => {
      region[key] = clamp((region[key] ?? 50) + value);
    });
  }

  function selectedRegion() {
    return state.regions.find((region) => region.id === state.selectedRegionId) || state.regions[0];
  }

  function takeAction(key) {
    const action = actionConfig[key];
    if (!action || state.actionsThisTurn >= 2) {
      advisor('Limite operacional', 'Você já executou as duas ações principais deste mês. Avance o mês para receber nova janela de decisão.');
      return;
    }
    if (state.budget + action.budget < 0) {
      advisor('Orçamento insuficiente', 'O tesouro nacional não comporta esta ação agora. Fortaleça economia ou avance o mês.');
      return;
    }
    state.budget += action.budget;
    state.actionsThisTurn += 1;
    applyEffects(action.effects);
    applyRegionEffects(state.selectedRegionId, action.region);
    addLog(action.advisor, action.text);
    advisor(action.advisor, action.text);
    renderGame(); saveGame();
  }

  function nextTurn() {
    const event = eventPool[(state.turn + Math.floor(Math.random() * eventPool.length)) % eventPool.length];
    applyEffects(event.effects);
    applyRegionEffects(state.selectedRegionId, event.region);
    const economyBonus = Math.round((state.stats.economy + state.stats.logistics + state.stats.stability) / 38);
    const upkeep = Math.round((state.stats.military + state.stats.tech) / 58);
    state.budget = clamp(state.budget + 10 + economyBonus - upkeep, 0, 160);
    state.turn += 1;
    state.month += 1;
    if (state.month > 11) { state.month = 0; state.year += 1; }
    state.actionsThisTurn = 0;
    addLog(event.title, event.text);
    advisor('Relatório mensal', `${event.title}: ${event.text} Orçamento atualizado: ${state.budget}.`);
    renderGame(); saveGame();
  }

  function renderNationCards(filter = '') {
    const term = filter.trim().toLowerCase();
    const visible = state.countries.filter((country) => {
      const haystack = `${country.name} ${country.flag} ${country.bloc} ${country.region} ${country.doctrine} ${country.description} ${(country.traits || []).join(' ')}`.toLowerCase();
      return !term || haystack.includes(term);
    });
    els.nationGrid.innerHTML = visible.map((country) => countryCard(country)).join('');
    els.nationGrid.querySelectorAll('[data-country]').forEach((button) => {
      button.addEventListener('click', () => {
        const country = state.countries.find((item) => item.id === button.dataset.country);
        if (country) startCampaign(country);
      });
    });
  }

  function countryCard(country) {
    const p = country.profile || {};
    const bars = ['economy','military','diplomacy','tech'].map((key) => statBar(key, country.stats[key])).join('');
    return `
      <button class="nation-card" data-country="${country.id}" data-region="${country.region}">
        <div class="nation-top"><span class="flag-pill">${country.flag}</span></div>
        <div><h2>${country.name}</h2><p>${country.doctrine}</p></div>
        <div class="nation-meta">
          <span>Capital<strong>${country.capital}</strong></span>
          <span>Bloco<strong>${country.bloc}</strong></span>
          <span>População jogo<strong>${fmt.format(p.populationM || 0)} mi</strong></span>
          <span>Defesa jogo<strong>US$ ${fmt.format(p.defenseB || 0)} bi</strong></span>
        </div>
        <div class="trait-row">${(country.traits || []).slice(0, 4).map((trait) => `<span>${trait}</span>`).join('')}</div>
        <div class="stat-bars">${bars}</div>
      </button>`;
  }

  function statBar(key, value) {
    return `<div class="stat-row"><span>${statLabels[key] || key}</span><div class="bar"><span style="--value:${clamp(value)}%"></span></div><b>${clamp(value)}</b></div>`;
  }

  function renderGame() {
    if (!state.selected) return;
    els.buildChip.textContent = 'Fase 2 · v0.2.0';
    els.campaignMeta.textContent = `Turno ${state.turn} · ${monthNames[state.month]} de ${state.year} · Orçamento ${state.budget}`;
    renderCountryProfile();
    renderResources();
    renderWorldMap();
    renderRegions();
    renderRegionPanel();
    renderActions();
    renderLog();
  }

  function renderCountryProfile() {
    const c = state.selected;
    const p = c.profile || {};
    els.countryProfile.innerHTML = `
      <div class="country-seal">${c.flag}</div>
      <div class="profile-title">
        <h2>${c.name}</h2>
        <p>${c.capital} · ${c.bloc} · ${c.region}</p>
        <p>${c.description}</p>
        <div class="profile-tags">
          <span>População: ${fmt.format(p.populationM || 0)} mi</span>
          <span>PIB jogo: US$ ${fmt.format(p.gdpT || 0)} tri</span>
          <span>Defesa jogo: US$ ${fmt.format(p.defenseB || 0)} bi</span>
          <span>Ativos: ${fmt.format(p.activeMilitaryK || 0)} mil</span>
          <span>Nuclear: ${p.nuclear || 'N/D'}</span>
        </div>
      </div>`;
  }

  function renderResources() {
    const p = state.selected.profile || {};
    const cards = [
      ['Economia', state.stats.economy, `PIB jogo US$ ${fmt.format(p.gdpT || 0)} tri`],
      ['Militar', state.stats.military, `${fmt.format(p.activeMilitaryK || 0)} mil ativos`],
      ['Diplomacia', state.stats.diplomacy, state.selected.bloc],
      ['Inteligência', state.stats.intel, `Cyber ${p.cyber || 0}/100`],
      ['Logística', state.stats.logistics, `Mar ${p.navalPower || 0} · Ar ${p.airPower || 0}`],
      ['Estabilidade', state.stats.stability, `Alimentos ${p.food || 0}/100`],
      ['Tecnologia', state.stats.tech, `Indústria ${p.industry || 0}/100`],
      ['Orçamento', state.budget, 'Tesouro estratégico']
    ];
    els.resourceGrid.innerHTML = cards.map(([label, value, hint]) => `<article class="resource-card"><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`).join('');
  }

  function renderWorldMap() {
    els.countryMapLayer.innerHTML = state.countries.map((country) => {
      const selected = state.selected?.id === country.id ? ' selected' : '';
      const x = country.map?.x ?? 50;
      const y = country.map?.y ?? 50;
      return `<button class="map-marker${selected}" style="--x:${x}%;--y:${y}%" aria-label="${country.name}" data-map-country="${country.id}" title="${country.name}">${country.flag}</button>`;
    }).join('');
    els.regionMapLayer.innerHTML = state.regions.map((region) => {
      const active = state.selectedRegionId === region.id ? ' active' : '';
      return `<button class="region-marker${active}" style="--x:${region.x}%;--y:${region.y}%" aria-label="${region.name}" data-region="${region.id}" title="${region.name}"></button>`;
    }).join('');
    els.countryMapLayer.querySelectorAll('[data-map-country]').forEach((button) => {
      button.addEventListener('click', () => {
        const country = state.countries.find((item) => item.id === button.dataset.mapCountry);
        if (!country) return;
        const p = country.profile || {};
        advisor(`${country.flag} ${country.name}`, `${country.capital} · ${country.bloc}. Economia ${country.stats.economy}, militar ${country.stats.military}, tecnologia ${country.stats.tech}. População de jogo ${fmt.format(p.populationM || 0)} mi.`);
      });
    });
    els.regionMapLayer.querySelectorAll('[data-region]').forEach((button) => button.addEventListener('click', () => selectRegion(button.dataset.region)));
  }

  function renderRegions() {
    els.globalGrid.innerHTML = state.regions.map((region) => `
      <button class="region-card${state.selectedRegionId === region.id ? ' active' : ''}" data-region-card="${region.id}">
        <h3>${region.name}</h3>
        <div class="region-mini">
          <span>Tensão<strong>${region.tension}</strong></span>
          <span>Influência<strong>${region.influence}</strong></span>
          <span>Comércio<strong>${region.trade}</strong></span>
          <span>Estabilidade<strong>${region.stability}</strong></span>
        </div>
      </button>`).join('');
    els.globalGrid.querySelectorAll('[data-region-card]').forEach((button) => button.addEventListener('click', () => selectRegion(button.dataset.regionCard)));
  }

  function selectRegion(id) {
    state.selectedRegionId = id;
    const region = selectedRegion();
    advisor(`Análise: ${region.name}`, `${region.focus}. Recursos-chave: ${region.resources}. Tensão ${region.tension}, comércio ${region.trade}, influência ${region.influence}.`);
    renderWorldMap(); renderRegions(); renderRegionPanel(); saveGame();
  }

  function renderRegionPanel() {
    const region = selectedRegion();
    if (!region) return;
    els.regionPanel.innerHTML = `
      <p class="eyebrow">Região selecionada</p>
      <h2>${region.name}</h2>
      <p>${region.focus}</p>
      <p class="muted">Recursos: ${region.resources}</p>
      ${statBar('Tensão', region.tension).replace('Tensão', 'Tensão')}
      ${statBar('Influência', region.influence).replace('Influência', 'Influência')}
      ${statBar('Comércio', region.trade).replace('Comércio', 'Comércio')}
      ${statBar('Estabilidade', region.stability).replace('Estabilidade', 'Estab.')}`;
  }

  function renderActions() {
    els.actionStack.innerHTML = Object.entries(actionConfig).map(([key, action]) => `
      <button class="action-btn" data-action="${key}">${action.label}<small>${action.advisor} · custo ${Math.abs(action.budget)} · ações ${state.actionsThisTurn}/2</small></button>`).join('');
    els.actionStack.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => takeAction(button.dataset.action)));
  }

  function renderLog() {
    if (!els.eventLog) return;
    if (!state.log.length) {
      els.eventLog.innerHTML = '<div class="log-entry"><strong>Sistema</strong><p>Nenhum evento registrado ainda.</p></div>';
      return;
    }
    els.eventLog.innerHTML = state.log.map((entry) => `<div class="log-entry"><strong>${entry.title}</strong><p>${entry.stamp} · ${entry.text}</p></div>`).join('');
  }

  function resetCampaign() {
    try { localStorage.removeItem(BUILD.saveKey); } catch (error) { /* noop */ }
    state.selected = null;
    renderNationCards(els.nationSearch.value || '');
    showScreen('screenNation');
  }

  function wireEvents() {
    els.newGameBtn.addEventListener('click', () => { renderNationCards(); showScreen('screenNation'); });
    els.continueBtn.addEventListener('click', () => loadGame());
    els.backHomeBtn.addEventListener('click', () => showScreen('screenHome'));
    els.nationSearch.addEventListener('input', (event) => renderNationCards(event.target.value));
    els.ackBtn.addEventListener('click', () => advisor('Leitura confirmada', 'A equipe registrou o briefing. Escolha uma ação ou avance o mês.'));
    els.nextTurnBtn.addEventListener('click', nextTurn);
    els.resetBtn.addEventListener('click', resetCampaign);

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      els.installBtn.hidden = false;
    });
    els.installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt = null;
      els.installBtn.hidden = true;
    });
  }

  async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('service-worker.js'); } catch (error) { /* PWA optional */ }
    }
  }

  async function boot() {
    initEls();
    els.buildChip.textContent = 'Fase 2 · v0.2.0';
    await loadData();
    wireEvents();
    els.continueBtn.disabled = !hasSave();
    renderNationCards();
    await registerServiceWorker();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
