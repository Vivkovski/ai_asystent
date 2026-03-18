# Wdrożenie: Vercel (frontend) + Supabase + backend

Projekt ma trzy części do wdrożenia:
1. **Supabase** — baza, auth, migracje (już masz projekt).
2. **Backend API** — FastAPI (Vercel Serverless, Railway, Render, lub inny host z Pythonem).
3. **Frontend** — Next.js na **Vercel**.

---

## 1. Supabase

- Masz już projekt w [Supabase](https://supabase.com) (Dashboard).
- **Migracje:** w Supabase → SQL Editor uruchom skrypty z `supabase/migrations/` po kolei (najpierw schema, potem RLS), albo lokalnie: `supabase link` + `supabase db push`.
- **Wartości do skopiowania:**
  - **Project URL** → `SUPABASE_URL` (API) i `NEXT_PUBLIC_SUPABASE_URL` (Web).
  - **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Web).
  - **service_role key** → `SUPABASE_KEY` (API; trzymaj tylko na backendzie).
  - **JWT Secret** (Settings → API) → `SUPABASE_JWT_SECRET` (API).

---

## 2. Vercel — frontend (Next.js)

1. [Vercel](https://vercel.com) → Add New Project → Import z repozytorium GitHub `Vivkovski/ai_asystent`.
2. **Root Directory:** ustaw na **`apps/web`**. Vercel wejdzie w ten katalog; `pnpm install` (z katalogu `apps/web`) i tak użyje workspace z głównego repo, więc zależność `@repo/shared` się zbuduje.
   - **Install Command:** `pnpm install` (domyślne).
   - **Build Command:** `pnpm run build` (uruchomi `next build`).
3. **Environment Variables** w Vercel (dla aplikacji web):
   - `NEXT_PUBLIC_SUPABASE_URL` = URL projektu Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
   - `NEXT_PUBLIC_API_URL` = **URL twojego backendu API** (np. `https://twoj-api.railway.app` lub gdzie hostujesz FastAPI)
4. Deploy. Po wdrożeniu skopiuj **Production URL** (np. `https://ai-asystent.vercel.app`) — przyda się do redirect URI i do API.

**Uwaga (monorepo):** Jeśli root repozytorium to nie `apps/web`, w Vercel w **Root Directory** ustaw `apps/web`. Wtedy Install Command zostaw domyślny (Vercel wykryje pnpm jeśli jest `pnpm-lock.yaml` w repo root; może być potrzebny root = repo i w `apps/web` nie ma osobnego lockfile, więc Install w repo root: `pnpm install`, Build: `pnpm --filter web build`). Sprawdź w dokumentacji Vercel „Monorepo”.

---

## 3. Backend API (FastAPI)

Vercel może hostować też API (Vercel Serverless Functions), ale typowy wybór to osobny host pod Python:

- **Railway** — dodaj projekt z GitHub, wybierz katalog `apps/api`, ustaw start: `uv run uvicorn main:app --host 0.0.0.0` (i np. `uv sync` w build). Dodaj zmienne środowiskowe (patrz runbook).
- **Render** — Web Service, build: `cd apps/api && uv sync`, start: `uvicorn main:app --host 0.0.0.0`.
- **Inne** — dowolny host z Python 3.11+ (np. Fly.io, Cloud Run).

**Zmienne środowiskowe backendu** (np. na Railway/Render):
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_JWT_SECRET`, `ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **`GOOGLE_OAUTH_REDIRECT_URI`** = **pełny URL strony callback w Vercel**, np.  
  `https://twoja-app.vercel.app/admin/integrations/google/callback`

W **Google Cloud Console** w Authorized redirect URIs dodaj dokładnie ten sam URL.

---

## 4. Kolejność

1. Supabase: projekt, migracje, seed (opcjonalnie).
2. Backend: wdrożyć, skopiować URL API.
3. Vercel: wdrożyć frontend z `NEXT_PUBLIC_API_URL` = URL backendu.
4. Ustawić `GOOGLE_OAUTH_REDIRECT_URI` na backendzie na production URL callback (Vercel).
5. W Google Cloud dodać ten redirect URI do OAuth clienta.

---

## 5. Szybki checklist

| Gdzie        | Co ustawić |
|-------------|------------|
| Supabase    | Migracje, URL, anon key, service_role, JWT Secret |
| Vercel (Web) | Root = `apps/web` (lub monorepo build), NEXT_PUBLIC_SUPABASE_*, NEXT_PUBLIC_API_URL |
| Backend     | SUPABASE_*, ENCRYPTION_KEY, GOOGLE_*, GOOGLE_OAUTH_REDIRECT_URI = Vercel callback URL |
| Google Cloud | Authorized redirect URI = ten sam co GOOGLE_OAUTH_REDIRECT_URI |

Po pierwszym deployu sprawdź: logowanie na stronie (Supabase Auth), lista integracji, „Zaloguj się przez Google” (redirect URI musi się zgadzać).
