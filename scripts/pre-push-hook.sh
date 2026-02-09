#!/bin/sh
# Pre-push hook: actualiza con el remoto (fetch + pull --rebase) antes de permitir el push.
# Evita subir cambios sobre una versión antigua por olvido de hacer pull.
# Instalación: cp scripts/pre-push-hook.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push

set -e

BRANCH=$(git branch --show-current)
REMOTE="origin"

echo "Pre-push: actualizando con $REMOTE/$BRANCH..."
git fetch "$REMOTE"

if ! git pull --rebase "$REMOTE" "$BRANCH"; then
  echo ""
  echo "El pull --rebase falló (posibles conflictos). Resuélvelos y luego:"
  echo "  git add . && git rebase --continue   (o git rebase --abort para cancelar)"
  echo "  git push $REMOTE $BRANCH"
  exit 1
fi

exit 0
