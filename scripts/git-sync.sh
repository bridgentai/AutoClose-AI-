#!/bin/bash
# Sincroniza con origin/main: trae cambios remotos y sube los locales.
# Uso: ./scripts/git-sync.sh "mensaje del commit"
set -e
cd "$(dirname "$0")/.."
git fetch origin
if [[ -n "$(git status --porcelain)" ]]; then
  git add .
  git commit -m "${1:-sync}"
fi
git pull origin main --no-edit
git push origin main
echo "Listo: main sincronizado con origin/main"
