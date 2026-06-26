# Modern War Dominion — Fase 6

Build completa com mapa real, assets integrados, regiões estratégicas, slots de construção, upgrades de bases e fila de produção militar.

## Como jogar
Abra `index.html` ou publique no GitHub Pages. No celular, use tela deitada/fullscreen.


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


## Fase 17 — Tela de batalha e relatórios visuais

- Adicionado painel Batalha.
- Operações militares agora geram relatório visual.
- O relatório mostra resultado, alvo, operação, força atacante, defesa inimiga, perdas, dano causado, tensão e impacto na prontidão.
- O Quartel-General mostra mini card da última batalha.
- Histórico recente de batalhas preservado no save.
- Tela de batalha traduzida em PT-BR, EN-US e ES-ES.


## Fase 17.1 — Hotfix seleção de país

- Corrigido problema em que o botão de confirmar escolha de país ficava escondido/encavalado.
- Adicionado painel fixo inferior de confirmação do país selecionado.
- Cards de países receberam altura e espaçamento melhores para PC e mobile landscape.
- Clique no card apenas seleciona; botão fixo confirma com segurança.
- Mantida a save key da Fase 17 para preservar campanhas.


## Fase 18 — Economia de Guerra

- Novo painel Economia no comando.
- Novo botão Economia no dock mobile.
- Mobilização nacional: normal, parcial e total.
- Inflação, moral civil, capacidade industrial, pressão energética e fluxo comercial.
- Políticas rápidas: mobilizar, desmobilizar, emitir títulos, converter indústria militar, racionamento e campanha pública.
- Economia agora afeta recursos mensais, estabilidade, prontidão e tensão mundial.
- Compatível com saves da Fase 17 por manter a mesma chave de save e criar economia automaticamente em campanhas existentes.


## Fase 19 — Espionagem e Cyberwar

- Novo painel Cyber/Espionagem.
- Rede de espiões, contrainteligência, segurança digital, ataque cyber e risco de exposição.
- Operações contra rivais: sabotagem de infraestrutura, roubo de tecnologia e operação psicológica.
- Operações podem ser detectadas e elevar tensão mundial.
- Sistema integrado ao HQ mobile, IA dos países e três idiomas.
- Save key mantida para preservar campanhas da Fase 17/18.


## Fase 20 — Guerra Terrestre e Ocupação

- Novo painel Frente/Guerra Terrestre.
- Frentes de invasão com avanço, suprimento, resistência e baixas.
- Ações: iniciar invasão, reforçar frente, pacificar território e retirar frente.
- Frentes aparecem no mapa real com marcador e linha operacional.
- Ocupação reduz poder/prontidão do rival, mas exige pacificação.
- Sistema integrado ao HQ mobile, IA dos países, cyberwar, economia e três idiomas.
- Save key mantida para preservar campanhas da Fase 17/18/19.


## Fase 21 — Guerra Aérea

- Novo painel Aérea/Guerra Aérea.
- Superioridade aérea, pressão aérea inimiga, defesa aérea e prontidão de drones.
- Ações: patrulha aérea, bombardeio de precisão, ataque de drones, interceptação e supressão AA.
- Operações aéreas aparecem no mapa real com marcador.
- Pressão aérea inimiga pode danificar bases se não for controlada.
- Supressão AA reduz resistência e melhora suprimento de frentes terrestres contra o mesmo alvo.
- Sistema integrado ao HQ mobile, guerra terrestre, IA, cyberwar, economia e três idiomas.
- Save key mantida para preservar campanhas da Fase 17/18/19/20.


## Fase 22 — Guerra Naval

- Novo painel Naval/Guerra Naval.
- Controle marítimo, pressão de bloqueio, ameaça submarina, alcance de porta-aviões e segurança de comboios.
- Ações: patrulha naval, bloqueio naval, ataque submarino, ataque de porta-aviões e escolta de comboios.
- Operações navais aparecem no mapa real com marcador.
- Bloqueio reduz economia/prontidão de rivais.
- Escolta de comboios protege comércio e reduz pressão marítima.
- Ataque de porta-aviões também ajuda superioridade aérea.
- Sistema integrado ao HQ mobile, guerra terrestre, guerra aérea, IA, cyberwar, economia e três idiomas.
- Save key mantida para preservar campanhas da Fase 17/18/19/20/21.


## Fase 23 — Mísseis e Defesa Estratégica

- Novo painel Mísseis/Defesa Estratégica.
- Estoque de mísseis, escudo antimíssil, alerta antecipado, dissuasão e risco nuclear.
- Ações: fabricar mísseis, reforçar escudo, ataque convencional de precisão, elevar alerta e postura dissuasória.
- Operações de mísseis aparecem no mapa real com marcador.
- Ataque convencional pode reduzir poder, economia e prontidão do rival.
- Escudo e alerta podem evitar incidentes estratégicos.
- Postura dissuasória aumenta risco, mas pode reduzir hostilidade de rivais.
- Sistema integrado ao HQ mobile, guerra terrestre, guerra aérea, naval, IA, cyberwar, economia e três idiomas.
- Save key mantida para preservar campanhas anteriores.


## Fase 24 — Logística Global e Suprimentos

- Novo painel Logística Global.
- Rede de suprimentos, combustível, munição, transporte, segurança de rotas e gargalos.
- Ações: expandir rede, estocar munição, reservar combustível, proteger rotas, ponte aérea e reparo emergencial.
- Gargalos logísticos reduzem prontidão e podem atrapalhar frentes.
- Ponte aérea reforça frentes terrestres com suprimento baixo.
- Segurança de rotas também conversa com comboios navais.
- Ações logísticas aparecem no mapa real com marcador.
- Sistema integrado ao HQ mobile, guerra terrestre, aérea, naval, mísseis, IA, cyberwar, economia e três idiomas.
- Save key mantida para preservar campanhas da Fase 17 em diante.


## Hotfix Fase 24.1 — Mapa Interativo e Visual Tático

- Corrigido arraste do mapa com mouse e toque.
- O mapa não recentraliza sozinho depois que o jogador move ou aproxima.
- Bases aparecem com ícone mais forte e nível no mapa.
- Construções em andamento aparecem no mapa com progresso.
- Unidades e produção militar aparecem como marcadores táticos.
- Frentes terrestres, comboios logísticos, operações aéreas, navais e mísseis ganharam rotas animadas.
- Visual do mapa ficou mais próximo de estratégia em tempo real, com veículos/colunas se movimentando rumo às frentes.
- Save key mantida para preservar campanhas da Fase 17/18/19/20/21/22/23/24.


## Fase 25 — Teatro Dinâmico e Movimentação Tática

- Novo painel Movimento / Movimentação Tática.
- Reposicionamento de forças entre regiões.
- Envio de reforços para frentes terrestres ativas.
- Colunas em trânsito com progresso e tempo de chegada.
- Tropas, transportes e rotas de deslocamento aparecem no mapa real.
- O teatro de operações ficou mais vivo e próximo de jogos estratégicos com movimentação militar visível.
- Sistema integrado ao HQ mobile, logística, frentes terrestres, guerra aérea, naval, mísseis, IA, economia e três idiomas.
- Save key mantida para preservar campanhas anteriores.


## Fase 26 — Batalha Cinemática no Mapa

- Relatório de batalha agora mostra uma cena visual cinematográfica.
- Ataques geram zonas de combate no mapa real.
- Explosões, fumaça, rotas de ataque e marcadores de impacto aparecem visualmente.
- Operações terrestres, aéreas, navais e mísseis passam a registrar cenas de batalha.
- Histórico visual das últimas cenas de combate.
- O mapa mantém arraste com mouse/toque e ganha leitura de guerra mais clara.
- Sistema integrado ao teatro dinâmico, frentes, logística, ar, naval, mísseis, IA, economia e três idiomas.
- Save key mantida para preservar campanhas anteriores.


## Fase 27 — IA Ofensiva e Defesa Nacional

- Novo painel Defesa Nacional.
- Rivais hostis agora geram ofensivas contra o jogador.
- Ataques inimigos podem ser: aéreo, terrestre, naval, míssil ou cyber.
- Ameaças ativas aparecem no mapa com rota vermelha e marcador em movimento.
- Defesa pode reforçar região, interceptar ameaça e elevar alerta nacional.
- Ofensivas resolvidas podem danificar bases, unidades, energia, indústria, cyber e estabilidade.
- O sistema usa as cenas cinematográficas da Fase 26 para mostrar impacto/defesa no mapa.
- Save key mantida para preservar campanhas anteriores.


## Fase 28 — Alianças e Coalizões Globais

- Novo painel Coalizão / Alianças.
- Países candidatos são avaliados por relação, bloco, tensão e postura da IA.
- Ações: melhorar relação, convidar aliança, pedir apoio econômico, apoio militar e defesa coletiva.
- Apoios aliados aparecem no mapa com rotas verdes e marcadores em deslocamento.
- Apoio econômico entrega finanças, indústria e energia.
- Apoio militar envia lotes de unidades prontas.
- Defesa coletiva reforça a defesa nacional e pode reduzir ameaças inimigas ativas.
- Sistema integrado ao HQ mobile, IA ofensiva, defesa nacional, mapa visual, economia e três idiomas.
- Save key mantida para preservar campanhas anteriores.


## Fase 29 — Sala de Guerra e Camadas do Mapa

- Novo painel Mapa / Sala de Guerra.
- Controle individual de camadas: países, regiões, bases, crises, frentes, aérea, naval, mísseis, logística, tropas/rotas e batalha/ameaças.
- Presets rápidos: Guerra total, Mapa limpo, Combate e Logística.
- Foco rápido em: Meu país, Ameaças, Aliados e Frentes.
- Camadas podem ser ligadas/desligadas sem perder dados da campanha.
- O mapa fica mais limpo, profissional e controlável no PC e no mobile.
- Sistema integrado a IA ofensiva, coalizões, batalha cinematográfica, logística, frentes, bases e unidades.
- Save key mantida para preservar campanhas anteriores.
