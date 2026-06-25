# Changelog

## v0.6.0 — Fase 6
- Sistema de regiões estratégicas por país.
- Slots regionais para construção de bases.
- Bases com nível, condição e upgrade.
- Produção militar com fila e tempo em meses.
- Mais unidades usando os assets cortados da Fase 5.
- Mapa real preservado com marcadores regionais.


## Fase 7 — Guerra, danos e reparo
- Visual de fundo melhorado no PC com menos camada azul
- Bases com condição, reparo manual e destruição
- Interceptação por radar e base aérea
- Contra-ataques atingem regiões


## Fase 8 — Arsenal detalhado
- Painel Arsenal adicionado ao comando
- Unidade por classe com ataque, defesa, alcance, manutenção, tripulação e requisitos
- Produção agora respeita nível mínimo da base
- Catálogo naval, aéreo, terrestre e estratégico expandido


## Fase 9 — Manutenção, desgaste e reposição
- Novo painel Manutenção
- Custo mensal por força ativa
- Desgaste por tempo, operação e ataque inimigo
- Reposição de lotes com custo e fila
- Baixas reduzem poder militar


## Fase 10 — Terceira Guerra Mundial
- Novo painel Mundo com blocos militares, sanções, ultimatos, invasões e crise nuclear.
- Sistema DEFCON, risco nuclear e pontuação de guerra global.
- Sanções afetam relações e economia; ultimatos podem virar frentes de invasão.
- Invasões progridem mensalmente e podem causar ataques regionais.


## Fase 11 — Bandeiras reais e objetivos de campanha
- Jogo preparado para usar `assets/flags/{codigo}.png` ou webp/jpg/svg/gif.
- Script `tools/import-flags-gitbash.sh` para copiar as bandeiras da pasta do Windows.
- Cards de país, resumo e marcadores do mapa usam imagem real com fallback emoji.
- Painel Mundo ganhou objetivos de campanha com progresso.


## Fase 12 — Jogabilidade mobile e países do mundo
- Países expandidos para praticamente toda a lista ISO disponível
- Painel Guia do comandante com ações rápidas
- Bandeira real vira logo visual do país do jogador
- Importador de bandeiras normaliza nomes para minúsculo
- Interface lateral mais usável no mobile com abas roláveis


## Fase 13 — Mundo Vivo e IA dos Países
- Países controlados pela IA agora evoluem poder, economia, prontidão e postura.
- Novo painel IA com rivais e principais ameaças.
- Eventos mensais deixam a campanha menos parada e mais fácil de entender no mobile.
- Abas laterais ajustadas para rolagem horizontal em celular.


## Fase 14 — Rework total da jogabilidade mobile
- Tela Guia virou Quartel-General mobile.
- Bandeira real aparece como brasão/logo grande do país escolhido.
- Dock inferior com ações principais: Comando, Bases, Produzir, Atacar, Mundo e Mês.
- Roteiro visual da campanha para reduzir confusão.
- Mantidos 249 países/territórios possíveis e importação de bandeiras por código ISO.


## Fase 15 — Sistema trilíngue base

- Adicionado seletor de idioma PT / EN / ES.
- Criados arquivos de tradução em `data/lang/`.
- Interface principal, Guia/HQ, botões, abas, textos de home, mapa e comandos rápidos passam a usar chaves de idioma.
- O jogo mantém os sistemas anteriores: 249 países, bandeiras reais, mapa real, IA mundial, guerra global, arsenal, manutenção e jogabilidade mobile.
- Próxima etapa recomendada: traduzir eventos, países, relatórios de combate e tutorial completo.


## Fase 16 — Tutorial guiado e missões iniciais

- Adicionado tutorial de campanha no Quartel-General Mobile.
- 6 missões iniciais com progresso e recompensas.
- Missões ensinam: construir base, concluir base, produzir unidade, receber tropa, fazer reconhecimento e sobreviver 3 meses.
- Botões diretos reduzem confusão no mobile.
- Tutorial integrado aos três idiomas: PT-BR, EN-US e ES-ES.
