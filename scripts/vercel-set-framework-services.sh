#!/usr/bin/env bash
# Ustawia Framework Preset projektu Vercel na "Services" (dla experimentalServices).
# Wymaga: vercel link w katalogu repo i zalogowany vercel cli.
# Użycie: ./scripts/vercel-set-framework-services.sh [nazwa-projektu]
# Bez argumentu: nazwa z .vercel/project.json (po vercel link).
set -e
cd "$(dirname "$0")/.."

NAME="${1:-}"
if [ -z "$NAME" ]; then
  if [ -f .vercel/project.json ]; then
    NAME=$(node -e "console.log(require('./.vercel/project.json').projectId)" 2>/dev/null || true)
    if [ -z "$NAME" ]; then
      NAME=$(grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' .vercel/project.json 2>/dev/null | sed 's/.*"\([^"]*\)"$/\1/')
    fi
  fi
fi
if [ -z "$NAME" ]; then
  echo "Podaj nazwę projektu: ./scripts/vercel-set-framework-services.sh flixhome-asystent"
  echo "Albo uruchom w katalogu z wykonanym 'vercel link' (wtedy .vercel/project.json ma projectId)."
  exit 1
fi

echo "Ustawiam framework na 'services' dla projektu: $NAME"
echo '{"framework":"services"}' | npx vercel api "PATCH /v9/projects/$NAME" -X PATCH --input -
echo "Gotowe. Możesz zdeployować: vercel --prod"
