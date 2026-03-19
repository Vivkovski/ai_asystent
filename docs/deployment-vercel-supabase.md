# Wdrożenie: Vercel + Supabase (jedna aplikacja Next.js)

Aplikacja to **jeden projekt Next.js** na Vercel: frontend i API (Route Handlers pod `/api/...`) w jednym deployu. Brak osobnego backendu Python.

---

## 1. Supabase

- Utwórz projekt w [Supabase](https://supabase.com) (Dashboard).
- **Migracje:** w Supabase → SQL Editor uruchom skrypty z `supabase/migrations/` po kolei, albo lokalnie: `supabase link` + `supabase db push`.
- **Wartości do skopiowania:**
  - **Project URL** → `SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_URL`
  - **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - **service_role key** → `SUPABASE_KEY` (tylko po stronie serwera, nie w client)
  - **JWT Secret** (Settings → API) → `SUPABASE_JWT_SECRET`

---

## 2. Vercel — jeden projekt

1. **New Project** z repo GitHub. **Root Directory:** pusty (lub katalog repo). **Framework Preset:** Next.js.
2. W `vercel.json` jest `"framework": "nextjs"` — jedna aplikacja, bez experimentalServices.
3. **Environment Variables** (w tym samym projekcie):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_JWT_SECRET`
   - `ENCRYPTION_KEY` (min. 32 znaki)
   - opcjonalnie: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
4. **Nie ustawiaj** `NEXT_PUBLIC_API_URL` — frontend wywołuje API pod tym samym hostem (`/api/v1/...`).
5. Deploy. Sprawdź: `https://<domena>.vercel.app/api/health` → `{"status":"ok"}`.  
   Diagnostyka auth: `https://<domena>.vercel.app/api/health?debug=1`.

---

## 3. Google OAuth

- W Google Cloud Console (OAuth 2.0): **Authorized redirect URIs** = `https://<twoja-domena>.vercel.app/admin/integrations/google/callback`.
- W Vercel ustaw `GOOGLE_OAUTH_REDIRECT_URI` = ten sam URL (bez końcowego slasha).

---

## 4. Domyślny użytkownik admin

Aby mieć konto do logowania z rolą **tenant_admin**:

1. Ustaw lokalnie: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service_role z Supabase).
2. Z katalogu repo (gdzie jest skrypt):  
   `uv run python scripts/seed_admin_user.py` (wymaga Pythona i zmiennych env).
3. Logowanie: email i hasło ustawione w skrypcie (np. `admin@example.com` / `admin1234`).

---

## 5. Szybki checklist

| Gdzie | Co ustawić |
|-------|------------|
| Supabase | Migracje, URL, anon key, service_role, JWT Secret |
| Vercel (jeden projekt) | NEXT_PUBLIC_SUPABASE_*, SUPABASE_*, ENCRYPTION_KEY, GOOGLE_* (opcjonalnie), OPENROUTER_* (opcjonalnie) |
| Google Cloud | Authorized redirect URI = `https://<domena>.vercel.app/admin/integrations/google/callback` |

Po deployu: logowanie (Supabase Auth), czat (`/chat`), panel integracji i „Zaloguj się przez Google”.
