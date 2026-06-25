#!/usr/bin/env bash
set -euo pipefail
SOURCE="/c/Users/jonat/Pictures/BANDEIRAS DO MUNDO TODO"
DEST="assets/flags"

mkdir -p "$DEST"

if [ ! -d "$SOURCE" ]; then
  echo "Pasta de origem não encontrada: $SOURCE"
  echo "Confirme se ela existe no Windows: C:\\Users\\jonat\\Pictures\\BANDEIRAS DO MUNDO TODO"
  exit 1
fi

cp -f "$SOURCE"/* "$DEST"/ 2>/dev/null || true

# Normaliza nomes para minúsculo, mantendo extensão.
find "$DEST" -maxdepth 1 -type f | while IFS= read -r f; do
  dir="$(dirname "$f")"
  base="$(basename "$f")"
  lower="$(echo "$base" | tr '[:upper:]' '[:lower:]')"
  if [ "$base" != "$lower" ]; then
    mv -f "$f" "$dir/$lower"
  fi
done

echo "Bandeiras copiadas para $DEST"
echo "Exemplo esperado: assets/flags/br.png, assets/flags/us.png, assets/flags/cn.png"
