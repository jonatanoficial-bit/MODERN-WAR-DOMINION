# Guia de internacionalização — Fase 15

Para adicionar ou corrigir textos, edite:

- `data/lang/pt-BR.json`
- `data/lang/en-US.json`
- `data/lang/es-ES.json`

No HTML, use:

`data-i18n="chave.do.texto"`

Para placeholders:

`data-i18n-placeholder="chave.do.placeholder"`

No JavaScript, use:

`t("chave", "fallback")`

A Fase 15 traduz a interface principal. As próximas fases devem mover eventos, nomes auxiliares, relatórios, tutorial e países para arquivos de idioma.
