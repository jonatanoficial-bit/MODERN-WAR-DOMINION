# Importação de bandeiras — Fase 12

A pasta esperada no PC é:

`C:\Users\jonat\Pictures\BANDEIRAS DO MUNDO TODO`

No Git Bash, depois de extrair o ZIP do jogo dentro da pasta do projeto, rode:

```bash
cd "/c/Users/jonat/Desktop/GAME/¨2026/Modern WAR DOMINION"
bash tools/import-flags-gitbash.sh
```

O jogo procura os arquivos em `assets/flags/` usando ISO alpha-2 minúsculo, por exemplo:

- `br.png` Brasil
- `us.png` Estados Unidos
- `cn.png` China
- `gb.png` Reino Unido
- `fr.png` França
- `de.png` Alemanha

Extensões aceitas: `.png`, `.webp`, `.jpg`, `.jpeg`, `.svg`, `.gif`.

Se a imagem não existir, o jogo usa emoji como fallback.
