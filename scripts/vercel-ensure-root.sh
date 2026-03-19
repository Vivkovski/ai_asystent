#!/usr/bin/env bash
# Upewnij się, że projekt Vercel ma Root Directory = repo root (pusty lub .),
# żeby api/backend.py był w deployu. Uruchom z głównego katalogu repo.
set -e
echo "=== Sprawdzenie projektu Vercel ==="
vercel project inspect flixhome-asystent
echo ""
echo "Root Directory powinno być '.' lub puste. Jeśli jest 'apps/web', ustaw w Vercel:"
echo "  Dashboard → flixhome-asystent → Settings → General → Root Directory → wyczyść (zostaw puste)"
echo ""
echo "Redeploy (żeby api/backend.py był w buildzie):"
echo "  vercel deploy --prod"
echo ""
read -p "Uruchomić teraz: vercel deploy --prod? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  vercel deploy --prod
fi
