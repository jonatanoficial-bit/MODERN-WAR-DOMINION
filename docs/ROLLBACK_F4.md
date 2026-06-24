# Rollback — Fase 4

Se a Fase 4 apresentar problema no GitHub Pages:

1. Volte para a Fase 3:
   `MODERN-WAR-DOMINION-v0.3.0-F3-DIPLOMACIA-GLOBAL.zip`
2. Remova os arquivos atuais da pasta local.
3. Extraia a Fase 3.
4. Suba novamente via Git Bash.

Comandos sugeridos:

```bash
cd "/c/Users/jonat/Desktop/GAME/¨2026/Modern WAR DOMINION"
git status
git add .
git commit -m "Rollback para Fase 3"
git pull --rebase origin main
git push -u origin main
```
