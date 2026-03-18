# Runbook — uruchomienie i zmienne środowiskowe

## Wymagania

- Node.js 18+, pnpm
- Python 3.11+ (uv zalecane)
- Konto Supabase (projekt + migracje)

## Kroki uruchomienia

1. **Klon repozytorium**
   ```bash
   git clone <repo> && cd flixhome_asystent
   ```

2. **Zależności**
   ```bash
   pnpm install
   cd apps/api && uv sync
   ```

3. **Zmienne środowiskowe**
   - Skopiuj `.env.example` do `.env` w katalogu głównym i w `apps/api` (lub ustaw jedną `.env` w root i odwołuj się z API).
   - Uzupełnij wartości (patrz sekcja poniżej).

4. **Supabase**
   - Utwórz projekt w Supabase.
   - Uruchom migracje: `supabase db push` (z katalogu zawierającego `supabase/migrations`) lub wykonaj migracje ręcznie w SQL Editor.
   - Opcjonalnie: `supabase/seed.sql` dla danych startowych.

5. **Seed tenantów (opcjonalnie)**
   Z katalogu `apps/api`:
   ```bash
   SEED_USER_ID=<uuid-profilu-supabase> uv run python ../../scripts/seed_tenant.py
   ```

6. **Uruchomienie**
   - **API:** `cd apps/api && uv run uvicorn main:app --reload`
   - **Web:** z roota `pnpm run dev:web` (lub `pnpm --filter web dev`)

7. **Weryfikacja**
   - API: `GET /health` → `{"status":"ok"}`
   - Web: `/login` → logowanie Supabase; po zalogowaniu `/chat`, `/admin/integrations`.

---

## Zmienne środowiskowe

### API (`apps/api`)

| Zmienna | Wymagana | Opis |
|--------|----------|------|
| `SUPABASE_URL` | Tak | URL projektu Supabase (np. `https://xxx.supabase.co`) |
| `SUPABASE_KEY` | Tak | Klucz **service_role** (nie anon) — dostęp do tabel, RLS bypass |
| `SUPABASE_JWT_SECRET` | Tak | JWT Secret z Supabase (Dashboard → Settings → API) — do weryfikacji tokenów |
| `ENCRYPTION_KEY` | Tak | Min. 32 znaki — do szyfrowania credentials integracji (np. `openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` | Dla Drive/Sheets | Client ID z Google Cloud Console (OAuth 2.0) |
| `GOOGLE_CLIENT_SECRET` | Dla Drive/Sheets | Client Secret z Google Cloud Console |
| `GOOGLE_OAUTH_REDIRECT_URI` | Dla „Zaloguj przez Google” | Dokładnie ten sam URL co w Google Cloud Console → Authorized redirect URIs, np. `http://localhost:3000/admin/integrations/google/callback` (dev) lub `https://twoja-domena.com/admin/integrations/google/callback` (prod) |
| `OPENROUTER_API_KEY` | Dla LLM (intent + synthesis) | API key z [openrouter.ai](https://openrouter.ai); bez klucza używany jest MockLLM |
| `OPENROUTER_MODEL` | Nie | Model w OpenRouter (np. `openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet`); domyślnie `openai/gpt-4o-mini` |

### Web (`apps/web` / root)

| Zmienna | Wymagana | Opis |
|--------|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Tak | Ten sam URL co Supabase projektu |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tak | Klucz **anon** (public) — logowanie w przeglądarce |
| `NEXT_PUBLIC_API_URL` | Tak | URL backendu (np. `http://localhost:8000`) |

---

## Observability

- **Request ID:** każda odpowiedź API zawiera nagłówek `x-request-id`; nieobsłużone błędy logowane z tym ID.
- **Audit:** zdarzenia `message_created`, `integration_connected`, `integration_disabled` zapisywane w tabeli `audit_logs` (bez treści wiadomości i credentials).
- **Błędy:** API zwraca kształt `{ "code": "...", "message": "...", "details": ... }`; 500 bez stack trace w odpowiedzi.

---

## Częste problemy

- **401 na /api/v1/me** — sprawdź `SUPABASE_JWT_SECRET` (musi być JWT Secret z Dashboard).
- **Encryption failed przy dodawaniu integracji** — ustaw `ENCRYPTION_KEY` (min. 32 znaki).
- **Google Drive: „refresh_token required”** — użyj przycisku „Zaloguj się przez Google” w adminie (wymaga `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`). W Google Cloud Console dodaj w Authorized redirect URIs dokładnie ten sam URL co `GOOGLE_OAUTH_REDIRECT_URI`.
