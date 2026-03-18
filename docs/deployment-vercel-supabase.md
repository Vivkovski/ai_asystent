# Wdrożenie: Vercel (frontend + backend) + Supabase

Projekt ma dwie części na Vercel i jedną w Supabase:
1. **Supabase** — baza, auth, migracje (projekt połączony przez `supabase link`, migracje wdrożone).
2. **Frontend** — Next.js w projekcie Vercel **web** (Root Directory: `apps/web`).
3. **Backend API** — FastAPI w projekcie Vercel **api** (Root Directory: `apps/api`, framework: FastAPI).

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

1. [Vercel](https://vercel.com) → Add New Project → Import z repozytorium GitHub `Vivkovski/ai_asystent` (albo użyj istniejącego projektu **web** po `vercel link`).
2. **Root Directory (obowiązkowe):** w projekcie wejdź w **Settings → General** i w polu **Root Directory** ustaw **`apps/web`**. Zapisz. Dzięki temu Vercel buduje z tego katalogu, a `pnpm install` w `apps/web` i tak widzi workspace (pnpm-workspace.yaml w głównym repo).
   - **Install Command:** domyślne `pnpm install`.
   - **Build Command:** domyślne `pnpm run build` (Next.js).
   - Bez ustawienia Root Directory build się nie uda (brak Next.js w root).
   - Link do ustawień (podmień team/project): `https://vercel.com/pawels-projects-f1177721/web/settings`
3. **Environment Variables** w Vercel (dla aplikacji web):
   - `NEXT_PUBLIC_SUPABASE_URL` = URL projektu Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
   - `NEXT_PUBLIC_API_URL` = **URL twojego backendu API** (np. `https://twoj-api.railway.app` lub gdzie hostujesz FastAPI)
4. Deploy. Po wdrożeniu skopiuj **Production URL** (np. `https://ai-asystent.vercel.app`) — przyda się do redirect URI i do API.

**Uwaga (monorepo):** Jeśli root repozytorium to nie `apps/web`, w Vercel w **Root Directory** ustaw `apps/web`. Wtedy Install Command zostaw domyślny (Vercel wykryje pnpm jeśli jest `pnpm-lock.yaml` w repo root; może być potrzebny root = repo i w `apps/web` nie ma osobnego lockfile, więc Install w repo root: `pnpm install`, Build: `pnpm --filter web build`). Sprawdź w dokumentacji Vercel „Monorepo”.

---

## 3. Wartości zmiennych z Supabase (CLI)

Z głównego katalogu repo uruchom:

```bash
./scripts/supabase-env-for-vercel.sh
```

Skrypt wypisze m.in.:
- **Web:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Backend:** `SUPABASE_URL`, `SUPABASE_KEY` (service_role)

**JWT Secret** weź ręcznie z Supabase Dashboard → Project Settings → API → JWT Secret (potrzebny do weryfikacji tokenów na backendzie).

---

## 4. Backend API (FastAPI) na Vercel

Projekt Vercel **api** jest już utworzony (Root Directory: `apps/api`, framework: FastAPI). Adres produkcji: **https://api-sigma-eosin.vercel.app** (alias).

**Zmienne środowiskowe** — ustaw w Vercel → Project **api** → Settings → Environment Variables:

- `SUPABASE_URL` — z outputu skryptu `./scripts/supabase-env-for-vercel.sh`
- `SUPABASE_KEY` — service_role z tego samego skryptu
- `SUPABASE_JWT_SECRET` — z Dashboard Supabase → API → JWT Secret
- `ENCRYPTION_KEY` — min. 32 znaki (np. `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — jeśli używasz „Zaloguj przez Google”
- **`GOOGLE_OAUTH_REDIRECT_URI`** = `https://web-eight-peach-23.vercel.app/admin/integrations/google/callback` (lub aktualny URL frontu)

Po ustawieniu zmiennych zrób **Redeploy** projektu **api** w Vercel (Deployments → … → Redeploy).

**Frontend** — w projekcie **web** ustaw `NEXT_PUBLIC_API_URL=https://api-sigma-eosin.vercel.app`.

---

## 5. Kolejność

1. Supabase: projekt, migracje, seed (opcjonalnie).
2. Backend: wdrożyć, skopiować URL API.
3. Vercel: wdrożyć frontend z `NEXT_PUBLIC_API_URL` = URL backendu.
4. Ustawić `GOOGLE_OAUTH_REDIRECT_URI` na backendzie na production URL callback (Vercel).
5. W Google Cloud dodać ten redirect URI do OAuth clienta.

---

## 6. Szybki checklist

| Gdzie        | Co ustawić |
|-------------|------------|
| Supabase    | Migracje, URL, anon key, service_role, JWT Secret |
| Vercel (Web) | Root = `apps/web` (lub monorepo build), NEXT_PUBLIC_SUPABASE_*, NEXT_PUBLIC_API_URL |
| Backend     | SUPABASE_*, ENCRYPTION_KEY, GOOGLE_*, GOOGLE_OAUTH_REDIRECT_URI = Vercel callback URL |
| Google Cloud | Authorized redirect URI = ten sam co GOOGLE_OAUTH_REDIRECT_URI |

Po pierwszym deployu sprawdź: logowanie na stronie (Supabase Auth), lista integracji, „Zaloguj się przez Google” (redirect URI musi się zgadzać).
