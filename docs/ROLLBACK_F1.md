# Rollback — Fase 1

Como esta é a primeira fase do projeto, o rollback é simples:

1. Remover a pasta atual do projeto.
2. Restaurar o ZIP original da Fase 1.
3. Se necessário, limpar o save local do navegador:
   - Abrir DevTools.
   - Application / Armazenamento.
   - Local Storage.
   - Remover a chave `modern-war-dominion-save-v1`.

## Git

Caso a fase já tenha sido enviada ao GitHub:

```bash
git log --oneline
git reset --hard <COMMIT_ANTERIOR>
git push --force-with-lease
```

Como é a primeira fase, se não houver commit anterior, basta substituir os arquivos pela build validada.
