#!/usr/bin/env bash
set -e
SRC="/c/Users/jonat/Pictures/BANDEIRAS DO MUNDO TODO"
DEST="assets/flags"
mkdir -p "$DEST"
if [ ! -d "$SRC" ]; then
  echo "Pasta de bandeiras não encontrada: $SRC"
  exit 1
fi
# Copia todas as bandeiras e normaliza nome para minúsculo.
find "$SRC" -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.webp" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.svg" -o -iname "*.gif" \) | while read -r file; do
  base=$(basename "$file")
  lower=$(echo "$base" | tr '[:upper:]' '[:lower:]')
  cp "$file" "$DEST/$lower"
done
# Alias útil: alguns pacotes usam gb.png e o jogo também aceita uk como fallback.
[ -f "$DEST/gb.png" ] && cp "$DEST/gb.png" "$DEST/uk.png" || true
[ -f "$DEST/us.png" ] && cp "$DEST/us.png" "$DEST/usa.png" || true
echo "Bandeiras importadas para $DEST"
