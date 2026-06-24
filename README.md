# Modern War Dominion — Fase 2

**Dominação Global: Guerra Moderna**  
Build: `v0.2.0-F2-MAPA-MUNDIAL-PAISES`  
Data: 24/06/2026

## Correção principal

Na Fase 1 foi interpretado que o mapa deveria ser da Ucrânia. A Fase 2 corrige a direção: o jogo agora usa um **mapa mundial gratuito estilo Leaflet/OpenStreetMap**, com créditos/rodapé, fallback offline vetorial autoral e foco em dominação global.

## Conteúdo da Fase 2

- Mapa mundial tático em `assets/img/world-map-free.svg`.
- Seleção de país com bandeiras grandes.
- Perfis estatísticos de jogo: população, PIB de jogo, defesa, tropas ativas, reserva, energia, alimentos, indústria, cyber, força naval/aérea e status nuclear.
- Mapa com marcadores de países.
- Regiões globais clicáveis: América do Norte, América do Sul, Europa, África, Oriente Médio, Eurásia, Ásia-Pacífico e Oceania.
- Ações mensais: economia, militar, diplomacia, inteligência e logística.
- Eventos mensais globais.
- Save local e migração básica de saves antigos.
- PWA com service worker.

## Observação sobre mapa

Esta build não depende de API paga. O visual é **inspirado em mapas estilo Leaflet/OpenStreetMap**, com fallback offline. Em fase futura, o mesmo painel pode receber a biblioteca Leaflet real com tiles OSM, mantendo a atribuição correta.

## Como rodar

Abra `index.html` no navegador ou use um servidor local:

```bash
npx serve .
```

## Testes

```bash
npm test
npm run audit
npm run integrity
```
