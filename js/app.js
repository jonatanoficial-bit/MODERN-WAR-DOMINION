(() => {
  'use strict';

  const BUILD = {
    name: 'Modern War Dominion',
    phase: 'Fase 1 — Núcleo do Jogo e Escolha de Nação',
    version: 'v0.1.0-F1-NUCLEO-ESCOLHA-NACAO',
    date: '2026-06-24',
    saveKey: 'modern-war-dominion-save-v1'
  };

  const fallbackCountries = [
    { id: 'ukraine', name: 'Ucrânia', flag: '🇺🇦', bloc: 'Europa Oriental', doctrine: 'Resiliência nacional, defesa territorial e apoio externo', description: 'Campanha mais imersiva desta fase: foco em resistência, logística, diplomacia e defesa de setores estratégicos.', stats: { economy: 48, military: 70, diplomacy: 79, intel: 71, logistics: 63, stability: 68, tech: 65 } },
    { id: 'usa', name: 'Estados Unidos', flag: '🇺🇸', bloc: 'Aliança atlântica', doctrine: 'Projeção global e superioridade tecnológica', description: 'Potência econômica, naval e aérea com grande capacidade logística e influência diplomática.', stats: { economy: 95, military: 94, diplomacy: 86, intel: 90, logistics: 95, stability: 72, tech: 96 } },
    { id: 'brazil', name: 'Brasil', flag: '🇧🇷', bloc: 'América do Sul', doctrine: 'Recursos naturais, diplomacia e crescimento industrial', description: 'Grande população, recursos e território. Precisa transformar potencial econômico em capacidade militar moderna.', stats: { economy: 66, military: 53, diplomacy: 77, intel: 50, logistics: 57, stability: 61, tech: 58 } }
  ];

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const sectorBriefs = {
    'Comando Kyiv': 'Comando Kyiv: centro político e nó de comando. No jogo, melhora estabilidade se logística e diplomacia estiverem fortes.',
    'Setor Kharkiv': 'Setor Kharkiv: zona aérea e industrial. A leitura indica necessidade de defesa antiaérea e inteligência situacional.',
    'Zona Donbas': 'Zona Donbas: área de tensão fictícia no simulador. Alta pressão reduz estabilidade caso a prontidão caia.',
    'Porto Odesa': 'Porto Odesa: porto estratégico no Mar Negro. Logística naval e comércio influenciam orçamento e suprimentos.',
    'Hub Lviv': 'Hub Lviv: corredor logístico ocidental. Ajuda a estabilizar suprimentos e receber apoio diplomático.',
    'Corredor Mar Negro': 'Corredor Mar Negro: rota marítima de risco. Influencia economia, bloqueios futuros e operações navais nas próximas fases.'
  };

  const eventPool = [
    { title: 'Crise de energia regional', text: 'Mercados reagem com cautela. Economia pressionada, mas diplomacia pode compensar.', effects: { economy: -2, diplomacy: 1, stability: -1 } },
    { title: 'Cúpula internacional fictícia', text: 'A comunidade global abre espaço para negociação. Influência diplomática cresce.', effects: { diplomacy: 3, stability: 1 } },
    { title: 'Falha em cadeia logística', text: 'A distância entre bases aumenta custo de manutenção. Logística recebe alerta.', effects: { logistics: -3, military: -1 } },
    { title: 'Avanço tecnológico industrial', text: 'Novos contratos elevam eficiência de produção e pesquisa.', effects: { tech: 2, economy: 2 } },
    { title: 'Campanha de informação hostil', text: 'Narrativas externas pressionam a confiança pública. Inteligência e estabilidade testadas.', effects: { intel: -1, stability: -2, diplomacy: -1 } },
    { title: 'Treinamento conjunto de defesa', text: 'Exercícios integrados melhoram prontidão sem escalar conflito direto.', effects: { military: 2, logistics: 1 } }
  ];

  const actionConfig = {
    economy: { label: 'Fortalecer economia', advisor: 'Ministro da Economia', text: 'Pacote de investimento civil-militar aprovado. A economia melhora, mas o orçamento do mês sente o custo inicial.', effects: { economy: 4, stability: 1 }, budget: -4 },
    military: { label: 'Aumentar prontidão', advisor: 'Chefe do Estado-Maior', text: 'Prontidão elevada com exercícios defensivos e manutenção. A tropa responde melhor, mas o gasto de defesa aumenta.', effects: { military: 4, logistics: -1 }, budget: -5 },
    diplomacy: { label: 'Missão diplomática', advisor: 'Diplomata-chefe', text: 'Delegações foram enviadas para reduzir tensões e ampliar acordos. A reputação externa sobe.', effects: { diplomacy: 4, stability: 1 }, budget: -2 },
    intel: { label: 'Operação de inteligência', advisor: 'Chefe da Inteligência', text: 'Células de análise e satélite fictício ampliaram a leitura estratégica. Riscos de surpresa diminuem.', effects: { intel: 4, tech: 1 }, budget: -3 },
    logistics: { label: 'Reforçar logística', advisor: 'Comandante Logístico', text: 'Rotas de suprimento, transporte e manutenção foram revisadas. O alcance operacional melhora.', effects: { logistics: 5, military: 1 }, budget: -4 }
  };

  const els = {};
  const state = {
    countries: [],
    selected: null,
    turn: 1,
    year: 2026,
    month: 0,
    stats: null,
    budget: 100,
    actionsThisTurn: 0,
    log: []
  };

  function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  function q(id) {
    return document.getElementById(id);
  }

  function initEls() {
    ['screenHome', 'screenNation', 'screenGame', 'newGameBtn', 'continueBtn', 'backHomeBtn', 'nationGrid', 'nationSearch', 'buildChip', 'countryProfile', 'resourceGrid', 'campaignMeta', 'advisorTitle', 'advisorText', 'ackBtn', 'nextTurnBtn', 'eventLog', 'resetBtn', 'sectorPanel', 'mapWrap'].forEach((id) => {
      els[id] = q(id);
    });
  }

  function showScreen(name) {
    ['screenHome', 'screenNation', 'screenGame'].forEach((screen) => els[screen].classList.remove('screen-active'));
    els[name].classList.add('screen-active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hasSave() {
    try {
      return Boolean(localStorage.getItem(BUILD.saveKey));
    } catch (error) {
      return false;
    }
  }

  function saveGame() {
    try {
      const payload = {
        selected: state.selected,
        turn: state.turn,
        year: state.year,
        month: state.month,
        stats: state.stats,
        budget: state.budget,
        log: state.log.slice(0, 30),
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(BUILD.saveKey, JSON.stringify(payload));
      els.continueBtn.disabled = false;
    } catch (error) {
      addLog('Sistema', 'Não foi possível salvar localmente neste navegador.');
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(BUILD.saveKey);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      state.selected = payload.selected;
      state.turn = payload.turn || 1;
      state.year = payload.year || 2026;
      state.month = payload.month || 0;
      state.stats = payload.stats;
      state.budget = payload.budget ?? 100;
      state.log = Array.isArray(payload.log) ? payload.log : [];
      state.actionsThisTurn = 0;
      renderGame();
      showScreen('screenGame');
      return true;
    } catch (error) {
      return false;
    }
  }

  async function loadCountries() {
    try {
      const response = await fetch('data/countries.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Falha ao carregar países');
      state.countries = await response.json();
    } catch (error) {
      state.countries = fallbackCountries;
      addLog('Sistema', 'Lista de países carregada em modo fallback.');
    }
  }

  function statLabel(key) {
    const labels = {
      economy: 'Economia',
      military: 'Militar',
      diplomacy: 'Diplomacia',
      intel: 'Inteligência',
      logistics: 'Logística',
      stability: 'Estabilidade',
      tech: 'Tecnologia'
    };
    return labels[key] || key;
  }

  function renderNations(filter = '') {
    const term = filter.trim().toLowerCase();
    const countries = state.countries.filter((country) => {
      const haystack = `${country.name} ${country.bloc} ${country.doctrine} ${country.description}`.toLowerCase();
      return haystack.includes(term);
    });

    els.nationGrid.innerHTML = countries.map((country) => {
      const stats = country.stats;
      return `
        <button class="nation-card" data-country="${country.id}">
          <span class="flag-pill">${country.flag}</span>
          <div>
            <h2>${country.name}</h2>
            <p>${country.bloc}</p>
          </div>
          <p>${country.description}</p>
          <div class="stat-bars">
            ${['economy', 'military', 'diplomacy', 'logistics'].map((key) => `
              <div class="stat-row">
                <span>${statLabel(key)}</span>
                <div class="bar"><span style="--value:${stats[key]}%"></span></div>
                <b>${stats[key]}</b>
              </div>`).join('')}
          </div>
        </button>`;
    }).join('');
  }

  function selectCountry(id) {
    const country = state.countries.find((item) => item.id === id);
    if (!country) return;
    state.selected = country;
    state.stats = { ...country.stats };
    state.turn = 1;
    state.year = 2026;
    state.month = 0;
    state.budget = 100;
    state.actionsThisTurn = 0;
    state.log = [];
    addLog('Comando', `${country.name} selecionado. Campanha iniciada com doutrina: ${country.doctrine}.`);
    renderGame();
    saveGame();
    showScreen('screenGame');
  }

  function profileThreat() {
    const risk = clamp(100 - ((state.stats.stability + state.stats.diplomacy + state.stats.logistics) / 3));
    let label = 'Baixo';
    if (risk > 66) label = 'Crítico';
    else if (risk > 42) label = 'Elevado';
    else if (risk > 24) label = 'Moderado';
    return { risk, label };
  }

  function renderGame() {
    const country = state.selected;
    if (!country || !state.stats) return;
    const threat = profileThreat();
    els.campaignMeta.textContent = `Turno ${state.turn} · ${monthNames[state.month]} de ${state.year}`;
    els.commandTitle.textContent = `Painel nacional — ${country.name}`;
    els.countryProfile.innerHTML = `
      <div class="country-seal">${country.flag}</div>
      <div class="profile-title">
        <h2>${country.name}</h2>
        <p>${country.bloc} · ${country.doctrine}</p>
      </div>
      <div class="threat-meter">
        <strong>Risco estratégico: ${threat.label}</strong>
        <div class="bar"><span style="--value:${threat.risk}%"></span></div>
      </div>`;

    const resources = [
      ['budget', 'Orçamento', state.budget, 'capacidade de ação'],
      ['economy', 'Economia', state.stats.economy, 'PIB/indústria'],
      ['military', 'Prontidão', state.stats.military, 'forças armadas'],
      ['diplomacy', 'Diplomacia', state.stats.diplomacy, 'influência global'],
      ['intel', 'Inteligência', state.stats.intel, 'satélite/agentes'],
      ['logistics', 'Logística', state.stats.logistics, 'suprimentos'],
      ['stability', 'Estabilidade', state.stats.stability, 'moral nacional'],
      ['tech', 'Tecnologia', state.stats.tech, 'pesquisa militar']
    ];

    els.resourceGrid.innerHTML = resources.map(([key, title, value, sub]) => `
      <article class="resource-card" data-resource="${key}">
        <span>${title}</span>
        <strong>${value}</strong>
        <small>${sub}</small>
      </article>`).join('');

    if (!els.advisorText.textContent.trim()) {
      setAdvisor('Chefe do Estado-Maior', `Campanha iniciada. ${country.name} precisa equilibrar economia, prontidão, diplomacia e logística antes de escalar operações globais.`);
    }
    renderLog();
  }

  function renderLog() {
    els.eventLog.innerHTML = state.log.slice(0, 18).map((entry) => `<p><strong>${entry.title}:</strong> ${entry.text}</p>`).join('');
  }

  function addLog(title, text) {
    state.log.unshift({ title, text, at: new Date().toISOString() });
    if (els.eventLog) renderLog();
  }

  function setAdvisor(title, text) {
    els.advisorTitle.textContent = title;
    els.advisorText.textContent = text;
  }

  function applyEffects(effects = {}) {
    Object.entries(effects).forEach(([key, value]) => {
      if (typeof state.stats[key] === 'number') {
        state.stats[key] = clamp(state.stats[key] + value);
      }
    });
  }

  function runAction(actionKey) {
    const config = actionConfig[actionKey];
    if (!config || !state.stats) return;
    if (state.actionsThisTurn >= 2) {
      setAdvisor('Secretaria do Conselho', 'Limite de duas decisões por mês atingido. Encerre o turno para receber novo relatório global.');
      return;
    }
    if (state.budget + config.budget < 0) {
      setAdvisor('Ministro da Economia', 'Orçamento insuficiente para esta decisão. Fortaleça a economia ou aguarde o próximo turno.');
      return;
    }
    state.actionsThisTurn += 1;
    state.budget = clamp(state.budget + config.budget, 0, 150);
    applyEffects(config.effects);
    addLog(config.label, config.text);
    setAdvisor(config.advisor, config.text);
    renderGame();
    saveGame();
  }

  function nextTurn() {
    state.turn += 1;
    state.month += 1;
    if (state.month > 11) {
      state.month = 0;
      state.year += 1;
    }
    state.actionsThisTurn = 0;
    const income = Math.max(4, Math.round(state.stats.economy / 10));
    const maintenance = Math.max(2, Math.round((state.stats.military + state.stats.logistics) / 45));
    state.budget = clamp(state.budget + income - maintenance, 0, 150);

    const event = eventPool[(state.turn + state.month + state.stats.intel) % eventPool.length];
    applyEffects(event.effects);
    addLog(event.title, event.text);
    setAdvisor('Relatório Mensal', `${event.text} Receita líquida do mês: +${income - maintenance}. Decisões liberadas novamente.`);
    renderGame();
    saveGame();
  }

  function resetCampaign() {
    const ok = window.confirm('Resetar a campanha atual e voltar para a escolha de nação?');
    if (!ok) return;
    try { localStorage.removeItem(BUILD.saveKey); } catch (error) { /* noop */ }
    state.selected = null;
    state.stats = null;
    state.turn = 1;
    state.month = 0;
    state.year = 2026;
    state.budget = 100;
    state.actionsThisTurn = 0;
    state.log = [];
    els.advisorText.textContent = '';
    els.continueBtn.disabled = true;
    showScreen('screenNation');
  }

  function bindEvents() {
    els.newGameBtn.addEventListener('click', () => showScreen('screenNation'));
    els.backHomeBtn.addEventListener('click', () => showScreen('screenHome'));
    els.continueBtn.addEventListener('click', loadGame);
    els.nationSearch.addEventListener('input', (event) => renderNations(event.target.value));
    els.nationGrid.addEventListener('click', (event) => {
      const card = event.target.closest('[data-country]');
      if (card) selectCountry(card.dataset.country);
    });
    document.querySelector('.action-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (button) runAction(button.dataset.action);
    });
    els.nextTurnBtn.addEventListener('click', nextTurn);
    els.resetBtn.addEventListener('click', resetCampaign);
    els.ackBtn.addEventListener('click', () => setAdvisor('Conselho Estratégico', 'Recebido. Selecione uma decisão do mês ou encerre o turno para avançar a simulação.'));
    els.mapWrap.addEventListener('click', (event) => {
      const node = event.target.closest('[data-sector]');
      if (!node) return;
      const name = node.dataset.sector;
      const text = sectorBriefs[name] || 'Setor sem leitura disponível.';
      els.sectorPanel.textContent = text;
      setAdvisor('Analista de Teatro Operacional', text);
      addLog('Mapa Ucrânia', `Leitura aberta: ${name}.`);
      saveGame();
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('service-worker.js').catch(() => undefined);
    }
  }

  async function boot() {
    initEls();
    els.buildChip.textContent = `${BUILD.phase.split('—')[0].trim()} · ${BUILD.version}`;
    bindEvents();
    await loadCountries();
    renderNations();
    els.continueBtn.disabled = !hasSave();
    registerServiceWorker();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
