# Wdrożenie: Vercel (monorepo) + Supabase

Możesz wdrożyć **jeden projekt** (Vercel Services) albo **dwa projekty** (front + API). Oba warianty = to samo repo (monorepo).

---

## Opcja A: Jeden projekt (Vercel Services)

Jeśli w ustawieniach projektu Vercel masz **Framework Preset „Services”** (lub możesz go włączyć):

- **Jeden projekt** — Next.js i FastAPI na tej samej domenie.
- W `vercel.json` jest `experimentalServices`: serwis **web** (Next.js pod `/`) i **api** (FastAPI pod `/api/backend`).
- Vercel routuje requesty: `/api/backend/*` → Python, reszta → Next.js.
- **W ustawieniach projektu** ustaw **Framework** na **Services** (nie Next.js). Bez tego Services nie zadziała.
- **Nie ustawiaj** `NEXT_PUBLIC_API_URL` — Vercel wstrzykuje `NEXT_PUBLIC_API_URL` jako `/api/backend` (ścieżka względna).
- Zmienne backendu (Supabase, ENCRYPTION_KEY, GOOGLE_* itd.) ustaw w tym samym projekcie; są współdzielone.

Production: **https://flixhome-asystent.vercel.app** (front i API pod tą samą domeną).

---

## Opcja B: Dwa projekty (gdy Services niedostępne)

Gdy nie masz opcji „Services” w Framework Preset:

- **Projekt 1 — frontend:** Framework **Next.js**, Root Directory = repo root. Ustaw **`NEXT_PUBLIC_API_URL`** = URL projektu API + `/api/backend`.
- **Projekt 2 — backend:** Framework **Other**, Root Directory = **`api-vercel`**. Serwuje FastAPI pod `/api/backend`. Ustaw **`CORS_ORIGINS`** = URL frontendu.

Szczegóły w sekcji 2 poniżej.

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

## 2. Vercel — konfiguracja

### 2.1 Jeden projekt (Services)

1. **New Project** z repo GitHub (Root Directory = pusty).
2. **Framework = Services:** w `vercel.json` jest już `"framework": "services"` (nadpisuje ustawienie z dashboardu). Jeśli projekt był wcześniej ustawiony na Next.js, możesz wymusić Services przez CLI:
   ```bash
   ./scripts/vercel-set-framework-services.sh flixhome-asystent
   ```
   (albo bez argumentu po `vercel link` — wtedy bierze projekt z `.vercel/project.json`).
3. **Environment Variables:** ustaw zmienne Supabase (`NEXT_PUBLIC_SUPABASE_*`) oraz backendu (sekcja 4). **Nie ustawiaj** `NEXT_PUBLIC_API_URL` — Vercel wstrzykuje ją jako `/api/backend` przy Services.
4. Deploy. Sprawdź: `https://<twoja-domena>.vercel.app/api/backend/health` → `{"status":"ok"}`.

### 2.2 Dwa projekty (gdy brak opcji Services)

**Projekt frontendowy „flixhome-asystent”**

1. **New Project** z tego samego repo. **Root Directory:** pusty. **Framework Preset:** Next.js.
2. **Environment Variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **`NEXT_PUBLIC_API_URL`** = `https://<url-projektu-api>.vercel.app/api/backend`.
3. Deploy. URL użyj w Google OAuth redirect URI i w CORS (projekt API).

**Projekt API „flixhome-asystent-api”**

1. **New Project** — ten sam repo. **Root Directory:** **`api-vercel`**. **Framework Preset:** Other.
2. **Environment Variables:** jak w sekcji 4 (SUPABASE_*, ENCRYPTION_KEY, **CORS_ORIGINS** = URL frontendu, GOOGLE_*).
3. Deploy. Skopiuj Production URL i ustaw w projekcie frontowym `NEXT_PUBLIC_API_URL` = ten URL + `/api/backend`.

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

## 4. Zmienne dla backendu (projekt „flixhome-asystent-api”)

W Vercel → Project **flixhome-asystent-api** → Settings → Environment Variables ustaw:

- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_JWT_SECRET`, `ENCRYPTION_KEY`
- `CORS_ORIGINS` = URL frontendu, np. `https://flixhome-asystent.vercel.app` (wiele domen: po przecinku)
- opcjonalnie: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` (np. `https://flixhome-asystent.vercel.app/admin/integrations/google/callback`)

**Frontend (projekt flixhome-asystent):** ustaw **`NEXT_PUBLIC_API_URL`** = pełny URL do backendu, np. `https://flixhome-asystent-api.vercel.app/api/backend` (ze ścieżką `/api/backend` na końcu).

---

## 5. Domyślny użytkownik admin

Aby mieć konto do logowania (email + hasło) z rolą **tenant_admin**:

1. Ustaw lokalnie: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service_role z Supabase).
2. Z katalogu repo uruchom:
   ```bash
   cd apps/api && uv run python ../../scripts/seed_admin_user.py
   ```
3. Logowanie w aplikacji: **email** `admin@example.com`, **hasło** `admin1234`.

Skrypt tworzy użytkownika w Supabase Auth (z potwierdzonym emałem) oraz tenant „Demo Tenant” i profil z rolą `tenant_admin`. Jeśli użytkownik z tym emałem już istnieje, skrypt użyje jego ID i zaktualizuje tenant/profil.

---

## 6. Kolejność

1. Supabase: projekt, migracje, seed (opcjonalnie; dla admina: `scripts/seed_admin_user.py`).
2. Vercel: **najpierw** utwórz projekt API (**flixhome-asystent-api**), Root Directory = `api-vercel`, Framework Other, dodaj zmienne backendu + CORS_ORIGINS, zdeployuj i skopiuj URL.
3. Vercel: projekt frontendowy (**flixhome-asystent**), ustaw `NEXT_PUBLIC_API_URL` na URL z kroku 2 oraz zmienne Supabase.
4. Google OAuth: redirect URI = `https://<twoja-domena-frontendu>.vercel.app/admin/integrations/google/callback`.

---

## 7. Szybki checklist

| Gdzie        | Co ustawić |
|-------------|------------|
| Supabase    | Migracje, URL, anon key, service_role, JWT Secret |
| Vercel **flixhome-asystent** (front) | NEXT_PUBLIC_SUPABASE_*, NEXT_PUBLIC_SUPABASE_ANON_KEY, **NEXT_PUBLIC_API_URL** = URL projektu API |
| Vercel **flixhome-asystent-api** (API) | Root Directory = `api-vercel`; SUPABASE_*, ENCRYPTION_KEY, CORS_ORIGINS, GOOGLE_* |
| Google Cloud | Authorized redirect URI = `https://flixhome-asystent.vercel.app/admin/integrations/google/callback` |

Po pierwszym deployu sprawdź: logowanie na stronie (Supabase Auth), lista integracji, „Zaloguj się przez Google” (redirect URI musi się zgadzać).
