#!/usr/bin/env bash
# Pobiera z Supabase CLI URL i klucze i wypisuje zmienne do Vercel / .env.
# Uruchom z głównego katalogu repo. JWT Secret weź z Dashboard → API → JWT Secret.
set -e
cd "$(dirname "$0")/.."
REF="${SUPABASE_PROJECT_REF:-}"
if [ -z "$REF" ]; then
  REF=$(supabase projects list -o json 2>/dev/null | grep -o '"ref": "[^"]*"' | head -1 | sed 's/"ref": "//;s/"//')
fi
if [ -z "$REF" ]; then
  echo "Podaj SUPABASE_PROJECT_REF=ref lub ustaw link: supabase link --project-ref REF"
  exit 1
fi
URL="https://${REF}.supabase.co"
KEYS=$(supabase projects api-keys --project-ref "$REF" -o env 2>/dev/null)
ANON=$(echo "$KEYS" | grep '^SUPABASE_ANON_KEY=' | sed 's/^SUPABASE_ANON_KEY=//')
SVC=$(echo "$KEYS" | grep '^SUPABASE_SERVICE_ROLE_KEY=' | sed 's/^SUPABASE_SERVICE_ROLE_KEY=//')
echo "# === Web (Vercel frontend) ==="
echo "NEXT_PUBLIC_SUPABASE_URL=$URL"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON"
echo ""
echo "# === Backend (Vercel API lub inny host) ==="
echo "SUPABASE_URL=$URL"
echo "SUPABASE_KEY=$SVC"
echo ""
echo "# JWT Secret (Dashboard → Project Settings → API → JWT Secret):"
echo "# SUPABASE_JWT_SECRET=..."
echo "# ENCRYPTION_KEY=...  (min 32 znaki, np. openssl rand -base64 32)"
