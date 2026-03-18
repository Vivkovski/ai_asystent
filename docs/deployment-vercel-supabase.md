# Wdrożenie: Vercel (jeden projekt: frontend + backend) + Supabase

**Jedna aplikacja Vercel** — projekt **flixhome-asystent** serwuje Next.js i FastAPI z tego samego repo:
- **Root Directory:** brak (repo root).
- **Next.js** — build z `apps/web`, output `apps/web/.next`.
- **Backend** — FastAPI pod ścieżką `/api/backend` (plik `api/backend.py` w root repo, mount aplikacji z `apps/api`).
- **GitHub:** repo podlinkowane — push na `main` uruchamia deploy.

Production: **https://flixhome-asystent.vercel.app** (backend: `/api/backend/health`, `/api/backend/api/v1/...`).

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

1. **Projekt Vercel „flixhome-asystent”** — Root Directory = repo root. Build i output ustawione w projekcie (buildCommand, outputDirectory). Repo GitHub podlinkowane.
2. **Backend w tym samym projekcie** — w root repo jest `api/backend.py` i `requirements.txt`; Vercel buduje funkcję Pythona pod `/api/backend/*`.
3. **Environment Variables** — patrz sekcje 3 i 4 (Supabase + backend). Dla frontu: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Przy jednym projekcie **nie** ustawiaj `NEXT_PUBLIC_API_URL`.
4. Deploy. Production URL (np. `https://web-eight-peach-23.vercel.app`) użyj w Google OAuth redirect URI.

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

## 4. Zmienne dla backendu (w tym samym projekcie „web”)

Backend (FastAPI pod `/api/backend`) działa w projekcie **flixhome-asystent**. Ustaw w Vercel → Project **flixhome-asystent** → Settings → Environment Variables:

- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_JWT_SECRET`, `ENCRYPTION_KEY`
- opcjonalnie: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` (np. `https://flixhome-asystent.vercel.app/admin/integrations/google/callback`)

Te zmienne są używane przez funkcję Pythona `api/backend.py`.

**Frontend:** przy jednym projekcie **nie ustawiaj** `NEXT_PUBLIC_API_URL` — wtedy front używa tego samego hosta i ścieżki `/api/backend`. Jeśli API jest osobno (np. drugi projekt), ustaw `NEXT_PUBLIC_API_URL` na URL tego API.

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
2. Vercel: jeden projekt „web”, deploy z repo (build + Python z `vercel.json`).
3. Zmienne: Supabase + backend w ustawieniach projektu „web”.
4. Google OAuth: redirect URI = `https://<twoja-domena>.vercel.app/admin/integrations/google/callback`.

---

## 7. Szybki checklist

| Gdzie        | Co ustawić |
|-------------|------------|
| Supabase    | Migracje, URL, anon key, service_role, JWT Secret |
| Vercel (projekt **flixhome-asystent**) | NEXT_PUBLIC_SUPABASE_*, NEXT_PUBLIC_SUPABASE_ANON_KEY; backend: SUPABASE_*, ENCRYPTION_KEY, GOOGLE_* |
| Google Cloud | Authorized redirect URI = `https://flixhome-asystent.vercel.app/admin/integrations/google/callback` |

Po pierwszym deployu sprawdź: logowanie na stronie (Supabase Auth), lista integracji, „Zaloguj się przez Google” (redirect URI musi się zgadzać).
