# Fase 30.2 — Hotfix definitivo seleção de país no mobile

## Correção
O botão de confirmação agora aparece também dentro do fluxo normal da tela, acima da grade de países.

## Motivo
Alguns navegadores mobile em modo paisagem escondiam ou cortavam a bandeja fixa inferior. A correção deixa o CTA visível sem depender exclusivamente de `position: fixed`.

## QA
- Abrir no celular em paisagem.
- Entrar em País.
- Ver o botão Confirmar país acima dos cards.
- Tocar no país e confirmar.
- Confirmar que a campanha inicia.
