# Fase 11 — Guia de importação das bandeiras

Sua pasta original no Windows:

`C:\Users\jonat\Pictures\BANDEIRAS DO MUNDO TODO`

Pasta que o jogo usa:

`assets/flags/`

## Como copiar via Git Bash

Abra o Git Bash dentro da pasta do projeto e rode:

```bash
mkdir -p assets/flags
cp -f "/c/Users/jonat/Pictures/BANDEIRAS DO MUNDO TODO/"* assets/flags/
find assets/flags -maxdepth 1 -type f | while IFS= read -r f; do
  dir="$(dirname "$f")"
  base="$(basename "$f")"
  lower="$(echo "$base" | tr '[:upper:]' '[:lower:]')"
  [ "$base" != "$lower" ] && mv -f "$f" "$dir/$lower"
done
```

Ou rode o script pronto:

```bash
bash tools/import-flags-gitbash.sh
```

## Padrão de nomes

O jogo procura automaticamente:

`assets/flags/{codigo}.png`
`assets/flags/{codigo}.webp`
`assets/flags/{codigo}.jpg`
`assets/flags/{codigo}.jpeg`
`assets/flags/{codigo}.svg`
`assets/flags/{codigo}.gif`

Exemplos:

- Brasil: `br.png`
- Estados Unidos: `us.png`
- China: `cn.png`
- Rússia: `ru.png`
- Reino Unido: `gb.png` ou `uk.png`
- Ucrânia: `ua.png`
- Japão: `jp.png`
- Israel: `il.png`

Se a imagem não existir, o jogo mantém o emoji como fallback.
