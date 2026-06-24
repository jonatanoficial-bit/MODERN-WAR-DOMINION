# Modern War Dominion

**Dominação Global: Guerra Moderna** é um jogo de estratégia moderna em HTML/CSS/JS, criado para rodar em celular, PC, tablet, PWA e GitHub Pages.

## Fase atual

- **Fase:** 1 — Núcleo do Jogo e Escolha de Nação
- **Versão:** `v0.1.0-F1-NUCLEO-ESCOLHA-NACAO`
- **Data da build:** 24/06/2026
- **Entrega:** ZIP completo funcional

## O que existe nesta fase

- Tela inicial premium estilo sala de comando militar.
- Seleção de 15 nações jogáveis.
- Painel nacional com orçamento, economia, prontidão, diplomacia, inteligência, logística, estabilidade e tecnologia.
- Primeiro sistema de turnos mensais.
- Ações estratégicas por turno.
- Relatórios de conselheiros.
- Registro de eventos.
- Save local via `localStorage`.
- PWA básico com `manifest.json` e `service-worker.js`.
- Mapa operacional gratuito da Ucrânia em SVG autoral dentro de `/assets/img/`.
- Auditoria de arquivos, validação JSON e smoke test.

## Mapa da Ucrânia

A Fase 1 usa um SVG autoral inspirado no contorno da Ucrânia para trazer mais realidade visual ao jogo. O arquivo está em:

```text
assets/img/ukraine-map-free.svg
```

Ele não usa imagem externa paga, não depende de CDN e foi criado como asset visual próprio para o projeto.

## Como rodar localmente

Abra `index.html` diretamente no navegador ou use um servidor local simples:

```bash
python -m http.server 8080
```

Depois acesse:

```text
http://localhost:8080
```

## Testes

```bash
npm test
npm run audit
npm run smoke
npm run integrity
```

## Estrutura

```text
/
  index.html
  manifest.json
  service-worker.js
  package.json
  README.md
  CHANGELOG.md
  BUILD_INFO.json
  /css
  /js
  /data
  /assets
  /assets/img
  /assets/audio
  /tests
  /tools
  /docs
```

## Observação de segurança e tom

O jogo é uma simulação estratégica fictícia. Países reais aparecem como facções e contexto geopolítico de alto nível, sem instruções reais de violência, sem propaganda política e sem glorificação de conflito.
